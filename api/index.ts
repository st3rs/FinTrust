/**
 * api/index.ts — Vercel Serverless Function entry point
 *
 * This is the production Express app for Vercel deployment.
 * Differences from server.ts (local dev):
 *   - No Vite dev middleware
 *   - No app.listen() — Vercel wraps this as a serverless function
 *   - No static file serving — Vercel CDN handles dist/ automatically
 *   - Exports `app` as default
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import Stripe from "stripe";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../middleware/auth.js";
import { runAgentChat, type AgentMessage } from "./agent.js";
import v1 from "./v1.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityLog {
  id: string;
  type: "api_request" | "payment_confirmation" | "webhook" | "system";
  message: string;
  metadata?: unknown;
  timestamp: string;
}

// ─── In-memory activity log ───────────────────────────────────────────────────

const recentLogs: ActivityLog[] = [];

function addLog(type: ActivityLog["type"], message: string, metadata?: unknown) {
  const log: ActivityLog = { id: randomUUID(), type, message, metadata, timestamp: new Date().toISOString() };
  recentLogs.unshift(log);
  if (recentLogs.length > 100) recentLogs.pop();
}

addLog("system", "Vercel serverless instance started");

// ─── PayPal helpers ───────────────────────────────────────────────────────────

function paypalBaseURL() {
  return process.env.PAYPAL_ENVIRONMENT === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getPayPalToken(): Promise<string> {
  const res = await fetch(`${paypalBaseURL()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? "PayPal auth failed");
  return data.access_token;
}

// ─── Pagination helper ────────────────────────────────────────────────────────

function getPagination(query: Record<string, any>, defaultLimit = 20) {
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? "")) || defaultLimit, 1), 100);
  const offset = Math.max(parseInt(String(query.offset ?? "")) || 0, 0);
  return { limit, offset };
}

function getPlanId(user: { app_metadata?: Record<string, unknown> } | null | undefined): "free" | "pro" {
  return user?.app_metadata?.plan === "pro" ? "pro" : "free";
}

async function setUserPlan(userId: string, plan: "free" | "pro") {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { ...(data.user?.app_metadata ?? {}), plan },
  });
}

const InvoiceCreateSchema = z.object({
  customerName: z.string().trim().min(1).max(160),
  customerEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
  amount: z.number().positive().finite(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()).default("THB"),
  invoiceDate: z.string().date().optional(),
  dueDate: z.string().date(),
  items: z.array(z.object({
    description: z.string().trim().min(1).max(500),
    quantity: z.number().positive().finite(),
    price: z.number().nonnegative().finite(),
  })).min(1).max(100),
  notes: z.string().max(5000).optional().default(""),
  taxRate: z.number().min(0).max(100).optional().default(0),
  paymentMethods: z.object({
    card: z.boolean(),
    bank: z.boolean(),
    qr: z.boolean(),
    crypto: z.boolean(),
  }).refine((methods) => Object.values(methods).some(Boolean), "Choose at least one payment method").optional(),
});

const CustomerCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  contact_person: z.string().trim().max(160).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  logo_url: z.string().max(3_000_000).nullable().optional(),
});

const PaymentLinkCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().default(""),
  amount: z.number().positive().finite(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()).default("USD"),
  methods: z.object({
    stripe: z.boolean().optional().default(false),
    paypal: z.boolean().optional().default(false),
    promptpay: z.boolean().optional().default(false),
    crypto: z.boolean().optional().default(false),
  }).refine((methods) => Object.values(methods).some(Boolean), "Choose at least one payment method"),
});

const QRPaymentCreateSchema = z.object({
  promptpay_id: z.string().trim().regex(/^[0-9-]{10,17}$/),
  amount: z.number().nonnegative().finite(),
  reference: z.string().trim().max(160).optional().default(""),
  qr_type: z.enum(["static", "dynamic"]),
  expires_at: z.string().datetime().nullable().optional(),
});

// ─── Webhook delivery ─────────────────────────────────────────────────────────

async function deliverWebhook(
  url: string, eventType: string, payload: unknown,
  logId: string, userId: string, attempt = 1
): Promise<void> {
  const MAX_ATTEMPTS = 3;
  if (attempt > 1) await new Promise((r) => setTimeout(r, (attempt - 1) * 2_000));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-FinTrust-Event": eventType, "X-FinTrust-Attempt": String(attempt) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    await supabaseAdmin.from("webhook_logs").update({ response_status: res.status }).eq("id", logId).eq("user_id", userId);
    if (res.ok) {
      addLog("webhook", `Webhook delivered (attempt ${attempt})`, { logId, status: res.status });
    } else if (attempt < MAX_ATTEMPTS) {
      await deliverWebhook(url, eventType, payload, logId, userId, attempt + 1);
    } else {
      addLog("webhook", `Webhook failed after ${MAX_ATTEMPTS} attempts`, { logId });
    }
  } catch (err: any) {
    if (attempt < MAX_ATTEMPTS) await deliverWebhook(url, eventType, payload, logId, userId, attempt + 1);
    else addLog("webhook", `Webhook delivery failed: ${err.message}`, { logId });
  }
}

// ─── Customer total_billed sync ───────────────────────────────────────────────

async function syncCustomerTotalBilled(clientName: string, userId: string) {
  try {
    const { data: invoices } = await supabaseAdmin.from("invoices").select("amount").eq("user_id", userId).eq("client", clientName).eq("status", "PAID");
    const total = (invoices ?? []).reduce((sum, inv) => sum + Number(inv.amount), 0);
    await supabaseAdmin.from("customers").update({ total_billed: total }).eq("user_id", userId).eq("name", clientName);
  } catch (err) {
    console.error("[syncCustomerTotalBilled]", err);
  }
}

async function recordProviderTransaction(
  provider: "stripe" | "paypal",
  providerEventId: string,
  row: Record<string, unknown>,
  payload: unknown
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .upsert(
      {
        ...row,
        provider,
        provider_event_id: providerEventId,
        verification_source: "provider",
      },
      { onConflict: "provider,provider_event_id", ignoreDuplicates: true }
    )
    .select("id");

  if (error) throw error;
  const inserted = Boolean(data?.length);
  if (inserted) {
    await supabaseAdmin.from("payment_events").upsert(
      {
        provider,
        provider_event_id: providerEventId,
        invoice_id: typeof row.invoice_id === "string" ? row.invoice_id : null,
        user_id: typeof row.user_id === "string" ? row.user_id : null,
        payload,
      },
      { onConflict: "provider,provider_event_id", ignoreDuplicates: true }
    );
  }
  return inserted;
}

async function processStripeCheckout(session: Stripe.Checkout.Session, providerEventId: string) {
  const { invoiceId, userId, upgradeTo, paymentLinkId } = session.metadata ?? {};

  if (upgradeTo === "pro" && userId) {
    await setUserPlan(userId, "pro");
    addLog("system", `Account upgraded to Pro: ${userId}`);
  }

  if (invoiceId && userId && session.payment_status === "paid") {
    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("amount, metadata, client")
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .maybeSingle();
    const expectedAmount = Math.round(Number(invoice?.amount ?? -1) * 100);
    const expectedCurrency = String(invoice?.metadata?.currency ?? "USD").toLowerCase();
    if (!invoice || expectedAmount !== session.amount_total || expectedCurrency !== session.currency) {
      throw new Error(`Stripe payment does not match invoice ${invoiceId}`);
    }

    const inserted = await recordProviderTransaction("stripe", providerEventId, {
      id: randomUUID(), invoice_id: invoiceId,
      amount: (session.amount_total ?? 0) / 100,
      currency: session.currency?.toUpperCase() ?? "USD",
      status: "Success", payment_method: "Card",
      client: session.customer_details?.name ?? session.customer_details?.email ?? invoice.client,
      user_id: userId,
    }, session);
    await supabaseAdmin.from("invoices").update({ status: "PAID" }).eq("id", invoiceId).eq("user_id", userId);
    await syncCustomerTotalBilled(invoice.client, userId);
    if (inserted) addLog("payment_confirmation", `Stripe payment confirmed: ${invoiceId}`, { sessionId: session.id });
  }

  if (paymentLinkId && userId && session.payment_status === "paid") {
    const { data: link } = await supabaseAdmin
      .from("payment_links")
      .select("amount, currency")
      .eq("id", paymentLinkId)
      .eq("user_id", userId)
      .maybeSingle();
    const expectedAmount = Math.round(Number(link?.amount ?? -1) * 100);
    const expectedCurrency = String(link?.currency ?? "USD").toLowerCase();
    if (!link || expectedAmount !== session.amount_total || expectedCurrency !== session.currency) {
      throw new Error(`Stripe payment does not match payment link ${paymentLinkId}`);
    }
    const inserted = await recordProviderTransaction("stripe", providerEventId, {
      id: randomUUID(),
      amount: (session.amount_total ?? 0) / 100,
      currency: session.currency?.toUpperCase() ?? "USD",
      status: "Success", payment_method: "Card",
      client: session.customer_details?.name ?? session.customer_details?.email ?? "Customer",
      user_id: userId,
      payment_link_id: paymentLinkId,
    }, session);
    if (inserted) addLog("payment_confirmation", `Payment link paid: ${paymentLinkId}`, { sessionId: session.id });
  }
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();

const allowedOrigins = new Set(
  [process.env.APP_URL, ...(process.env.CORS_ALLOWED_ORIGINS ?? "").split(",")]
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    if (!origin || process.env.NODE_ENV !== "production" || allowedOrigins.has(origin.replace(/\/$/, ""))) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed"));
  },
}));

// Rate limiters
const publicPaymentLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests." } });
const authLimiter          = rateLimit({ windowMs: 15 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: "Too many auth attempts." } });
const apiLimiter           = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false, message: { error: "API rate limit reached." } });

app.use("/api/public", publicPaymentLimiter);
app.use("/api/auth",   authLimiter);
app.use("/api",        apiLimiter);

// ── Stripe webhook — raw body before express.json() ──────────────────────────
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: "Stripe not configured" }); return;
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    res.status(400).send(`Webhook Error: ${err.message}`); return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await processStripeCheckout(session, `checkout_session:${session.id}`);
    }
    res.json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook]", error);
    res.status(400).json({ error: "Unable to reconcile Stripe payment" });
  }
});

// Merchants using their own Stripe account configure this tenant-specific
// endpoint in Stripe. The webhook secret never leaves the server.
app.post("/api/stripe/webhook/:merchantId", express.raw({ type: "application/json" }), async (req, res) => {
  const { data: config } = await supabaseAdmin
    .from("gateway_configs")
    .select("secret_key, webhook_secret")
    .eq("user_id", req.params.merchantId)
    .eq("gateway", "stripe")
    .maybeSingle();
  if (!config?.secret_key || !config?.webhook_secret) {
    res.status(503).json({ error: "Merchant Stripe webhook is not configured" });
    return;
  }

  try {
    const stripe = new Stripe(config.secret_key);
    const event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"]!, config.webhook_secret);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.userId !== req.params.merchantId) {
        res.status(400).json({ error: "Merchant metadata mismatch" });
        return;
      }
      await processStripeCheckout(session, `checkout_session:${session.id}`);
    }
    res.json({ received: true });
  } catch (error) {
    console.error("[merchant-stripe-webhook]", error);
    res.status(400).json({ error: "Invalid Stripe webhook" });
  }
});

app.use(express.json({ limit: "1mb" }));

// ── Public Developer API (/v1/*) ──────────────────────────────────────────────
// Reached directly via the /v1/(.*) rewrite and also under /api/v1 for the
// in-app API tester (same-origin, no extra rewrite needed).
app.use("/v1", apiLimiter, v1);
app.use("/api/v1", v1);

// ── Public routes (no auth) ───────────────────────────────────────────────────

app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));
app.get("/api/logs", requireAdmin as express.RequestHandler, (_req, res) => res.json({ data: recentLogs }));

app.get("/api/public/payment-status/:invoiceId", async (req, res) => {
  const { data } = await supabaseAdmin.from("invoices").select("status").eq("public_token", req.params.invoiceId).maybeSingle();
  res.json({ status: data?.status ?? "NOT_FOUND" });
});

// Public invoice view. The opaque public_token is the capability URL; never expose
// the merchant's user_id or internal invoice primary key to the payer.
app.get("/api/public/invoices/:token", async (req, res) => {
  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("client, amount, date, due_date, status, metadata, created_at, user_id, public_token")
    .eq("public_token", req.params.token)
    .maybeSingle();

  if (error) { res.status(500).json({ error: "Unable to load invoice" }); return; }
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }

  const [{ data: merchant }, { data: gatewayConfigs }] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(invoice.user_id),
    supabaseAdmin.from("gateway_configs").select("gateway, environment, webhook_secret").eq("user_id", invoice.user_id),
  ]);
  const metadata = (invoice.metadata ?? {}) as Record<string, unknown>;
  const merchantMetadata = merchant?.user?.user_metadata ?? {};
  const configuredGateways = new Map((gatewayConfigs ?? []).map((row) => [row.gateway, row]));
  const requestedMethods = (metadata.paymentMethods ?? {}) as Record<string, unknown>;

  res.json({
    data: {
      id: invoice.public_token,
      invoiceNumber: metadata.invoiceNumber ?? "Invoice",
      amount: Number(invoice.amount),
      currency: metadata.currency ?? "THB",
      status: invoice.status,
      customerName: invoice.client,
      customerEmail: metadata.customerEmail ?? "",
      dueDate: invoice.due_date ?? invoice.date,
      createdAt: invoice.created_at ?? invoice.date,
      items: Array.isArray(metadata.items) ? metadata.items : [],
      paymentMethods: {
        stripe: requestedMethods.card !== false,
        paypal: requestedMethods.paypal === true || requestedMethods.bank === true,
        promptpay: requestedMethods.qr !== false,
        crypto: requestedMethods.crypto === true,
      },
      promptPayId: merchantMetadata.promptpay_id ?? null,
      gatewayStatus: {
        stripe: {
          connected: Boolean(configuredGateways.get("stripe")?.webhook_secret) || Boolean(process.env.STRIPE_SECRET_KEY),
          mode: configuredGateways.get("stripe")?.environment ?? null,
        },
        paypal: {
          connected: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
          environment: process.env.PAYPAL_ENVIRONMENT ?? "sandbox",
        },
        promptpay: { connected: Boolean(merchantMetadata.promptpay_id) },
      },
    },
  });
});

app.get("/api/gateways/status", (_req, res) => {
  const stripeOk = Boolean(process.env.STRIPE_SECRET_KEY);
  const paypalOk = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  res.json({
    stripe:    { connected: stripeOk, mode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : stripeOk ? "test" : null },
    paypal:    { connected: paypalOk, environment: paypalOk ? (process.env.PAYPAL_ENVIRONMENT ?? "sandbox") : null },
    promptpay: { connected: true, mode: "local" },
  });
});

// Public: payment link details for the hosted pay page (no auth).
// Also counts the visit — clicks was previously never incremented.
app.get("/api/public/payment-links/:id", async (req, res) => {
  const { data: link } = await supabaseAdmin
    .from("payment_links")
    .select("id, title, description, amount, currency, methods, is_active, clicks, created_at, user_id")
    .eq("id", req.params.id)
    .maybeSingle();
  if (!link) { res.status(404).json({ error: "Payment link not found" }); return; }
  if (!link.is_active) { res.status(410).json({ error: "This payment link has been disabled" }); return; }

  void supabaseAdmin.from("payment_links").update({ clicks: (link.clicks ?? 0) + 1 }).eq("id", link.id)
    .then(() => { /* fire-and-forget */ });

  const [{ data: merchant }, { data: gatewayConfigs }] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(link.user_id),
    supabaseAdmin.from("gateway_configs").select("gateway, environment, webhook_secret").eq("user_id", link.user_id),
  ]);
  const merchantMetadata = merchant?.user?.user_metadata ?? {};
  const configuredGateways = new Map((gatewayConfigs ?? []).map((row) => [row.gateway, row]));

  res.json({
    data: {
      id: link.id,
      title: link.title,
      description: link.description,
      amount: Number(link.amount),
      currency: link.currency,
      methods: link.methods,
      is_active: link.is_active,
      created_at: link.created_at,
      promptPayId: merchantMetadata.promptpay_id ?? null,
      gatewayStatus: {
        stripe: {
          connected: Boolean(configuredGateways.get("stripe")?.webhook_secret) || Boolean(process.env.STRIPE_SECRET_KEY),
          mode: configuredGateways.get("stripe")?.environment ?? null,
        },
        paypal: {
          connected: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
          environment: process.env.PAYPAL_ENVIRONMENT ?? "sandbox",
        },
        promptpay: { connected: Boolean(merchantMetadata.promptpay_id) },
      },
    },
  });
});

async function resolveStripeKey(userId: string | null | undefined): Promise<string> {
  let stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  if (userId) {
    const { data: gw } = await supabaseAdmin.from("gateway_configs").select("secret_key, webhook_secret").eq("user_id", userId).eq("gateway", "stripe").maybeSingle();
    if (gw?.secret_key && gw?.webhook_secret) stripeKey = gw.secret_key;
  }
  return stripeKey;
}

app.get("/api/public/payment-links/:id/payment-status/:sessionId", async (req, res) => {
  const { data: link } = await supabaseAdmin
    .from("payment_links")
    .select("id, user_id, amount, currency")
    .eq("id", req.params.id)
    .maybeSingle();
  if (!link) { res.status(404).json({ status: "NOT_FOUND" }); return; }
  const stripeKey = await resolveStripeKey(link.user_id);
  if (!stripeKey) { res.status(503).json({ status: "UNAVAILABLE" }); return; }

  try {
    const session = await new Stripe(stripeKey).checkout.sessions.retrieve(req.params.sessionId);
    const matches = session.metadata?.paymentLinkId === link.id
      && session.metadata?.userId === link.user_id
      && session.amount_total === Math.round(Number(link.amount) * 100)
      && session.currency === String(link.currency).toLowerCase();
    if (!matches) { res.status(400).json({ status: "MISMATCH" }); return; }
    if (session.payment_status !== "paid") { res.json({ status: "PENDING" }); return; }
    await processStripeCheckout(session, `checkout_session:${session.id}`);
    res.json({ status: "PAID" });
  } catch (error) {
    console.error("[stripe-payment-link-status]", error);
    res.status(400).json({ status: "INVALID" });
  }
});

app.post("/api/public/stripe/create-checkout", async (req, res) => {
  const { invoiceId } = req.body as { invoiceId?: string };
  if (!invoiceId) { res.status(400).json({ error: "invoiceId is required" }); return; }
  const { data: inv } = await supabaseAdmin.from("invoices").select("*").eq("public_token", invoiceId).maybeSingle();

  // ── Payment link fallback: /pay/:id also serves reusable payment links ────
  if (!inv) {
    const { data: link } = await supabaseAdmin.from("payment_links").select("*").eq("id", invoiceId).maybeSingle();
    if (!link)           { res.status(404).json({ error: "Invoice not found" }); return; }
    if (!link.is_active) { res.status(410).json({ error: "This payment link has been disabled" }); return; }
    if (link.methods?.stripe !== true) { res.status(403).json({ error: "Card payments are disabled for this link" }); return; }

    const linkStripeKey = await resolveStripeKey(link.user_id);
    if (!linkStripeKey) { res.status(503).json({ error: "Stripe is not connected. Go to Settings → Payment Gateways to connect your Stripe account." }); return; }

    const linkStripe = new Stripe(linkStripeKey);
    const linkSession = await linkStripe.checkout.sessions.create({
      mode: "payment", payment_method_types: ["card"],
      line_items: [{ price_data: { currency: (link.currency ?? "usd").toLowerCase(), product_data: { name: link.title, ...(link.description && { description: link.description }) }, unit_amount: Math.round(Number(link.amount) * 100) }, quantity: 1 }],
      success_url: `${process.env.APP_URL}/pay/${link.id}?stripe=success&link=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/pay/${link.id}`,
      metadata: { paymentLinkId: link.id, userId: link.user_id },
    });
    res.json({ url: linkSession.url });
    return;
  }

  const stripeKey = await resolveStripeKey(inv.user_id);
  if (!stripeKey) { res.status(503).json({ error: "Stripe is not connected. Go to Settings → Payment Gateways to connect your Stripe account." }); return; }
  if (inv.status === "PAID") { res.status(409).json({ error: "Invoice already paid" }); return; }
  if (inv.metadata?.paymentMethods?.card === false) { res.status(403).json({ error: "Card payments are disabled for this invoice" }); return; }

  const stripe = new Stripe(stripeKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment", payment_method_types: ["card"],
    line_items: [{ price_data: { currency: (inv.metadata?.currency ?? "usd").toLowerCase(), product_data: { name: inv.metadata?.invoiceNumber ?? `Invoice ${inv.id.slice(0, 8).toUpperCase()}`, description: `Payment from ${inv.client}` }, unit_amount: Math.round(Number(inv.amount) * 100) }, quantity: 1 }],
    customer_email: inv.metadata?.customerEmail ?? undefined,
    success_url: `${process.env.APP_URL}/pay/${inv.public_token}?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/pay/${inv.public_token}`,
    metadata: { invoiceId: inv.id, userId: inv.user_id },
  });
  res.json({ url: session.url });
});

app.post("/api/public/paypal/create-order", async (req, res) => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    res.status(503).json({ error: "PayPal is not configured." }); return;
  }
  const { invoiceId } = req.body as { invoiceId?: string };
  if (!invoiceId) { res.status(400).json({ error: "invoiceId is required" }); return; }
  const { data: inv } = await supabaseAdmin.from("invoices").select("*").eq("public_token", invoiceId).maybeSingle();
  const { data: link } = inv ? { data: null } : await supabaseAdmin.from("payment_links").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv && !link) { res.status(404).json({ error: "Invoice or payment link not found" }); return; }
  if (inv?.status === "PAID") { res.status(409).json({ error: "Invoice already paid" }); return; }
  if (link && !link.is_active) { res.status(410).json({ error: "This payment link has been disabled" }); return; }
  if (inv && inv.metadata?.paymentMethods?.bank !== true && inv.metadata?.paymentMethods?.paypal !== true) { res.status(403).json({ error: "PayPal is disabled for this invoice" }); return; }
  if (link && link.methods?.paypal !== true) { res.status(403).json({ error: "PayPal is disabled for this link" }); return; }

  const amount = Number(inv?.amount ?? link?.amount);
  const currency = String(inv?.metadata?.currency ?? link?.currency ?? "USD").toUpperCase();
  const title = String(inv?.metadata?.invoiceNumber ?? link?.title ?? invoiceId);
  const description = inv ? `${title} — ${inv.client}` : link?.description ?? title;
  const customId = inv ? `invoice|${inv.id}|${inv.user_id}` : `link|${link.id}|${link.user_id}`;

  try {
    const token = await getPayPalToken();
    const r = await fetch(`${paypalBaseURL()}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": randomUUID() },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: inv?.id ?? link.id, custom_id: customId, amount: { currency_code: currency, value: amount.toFixed(2) }, description }],
        application_context: { shipping_preference: "NO_SHIPPING" },
      }),
    });
    const data = await r.json();
    if (!r.ok) { res.status(500).json({ error: "Failed to create PayPal order", detail: data }); return; }
    res.json({ orderId: data.id });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post("/api/public/paypal/capture-order/:orderId", async (req, res) => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    res.status(503).json({ error: "PayPal not configured" }); return;
  }
  try {
    const token = await getPayPalToken();
    const r = await fetch(`${paypalBaseURL()}/v2/checkout/orders/${req.params.orderId}/capture`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const data = await r.json();
    if (!r.ok || data.status !== "COMPLETED") { res.status(500).json({ error: "PayPal capture failed", detail: data }); return; }

    const pu = data.purchase_units?.[0];
    const customParts = String(pu?.custom_id ?? "").split("|");
    const [resourceType, resourceId, userId] = customParts.length === 3
      ? customParts
      : ["invoice", customParts[0], customParts[1]];
    const capture = pu?.payments?.captures?.[0];

    if (resourceType === "invoice" && resourceId && userId) {
      const { data: inv } = await supabaseAdmin.from("invoices").select("*").eq("id", resourceId).eq("user_id", userId).maybeSingle();
      if (inv) {
        const paidAmount = Number(capture?.amount?.value);
        const paidCurrency = String(capture?.amount?.currency_code ?? "").toUpperCase();
        const expectedCurrency = String(inv.metadata?.currency ?? "USD").toUpperCase();
        if (!capture?.id || !Number.isFinite(paidAmount) || paidAmount !== Number(inv.amount) || paidCurrency !== expectedCurrency) {
          res.status(400).json({ error: "PayPal payment does not match invoice" });
          return;
        }
        const captureId = String(capture?.id ?? req.params.orderId);
        const inserted = await recordProviderTransaction("paypal", captureId, { id: randomUUID(), invoice_id: resourceId, amount: paidAmount, currency: paidCurrency, status: "Success", payment_method: "PayPal", client: inv.client, user_id: userId }, data);
        await supabaseAdmin.from("invoices").update({ status: "PAID" }).eq("id", resourceId).eq("user_id", userId);
        await syncCustomerTotalBilled(inv.client, userId);
        if (inserted) addLog("payment_confirmation", `PayPal payment captured: ${resourceId}`, { orderId: req.params.orderId });
      }
    } else if (resourceType === "link" && resourceId && userId) {
      const { data: link } = await supabaseAdmin.from("payment_links").select("*").eq("id", resourceId).eq("user_id", userId).maybeSingle();
      const paidAmount = Number(capture?.amount?.value);
      const paidCurrency = String(capture?.amount?.currency_code ?? "").toUpperCase();
      if (!link || !capture?.id || paidAmount !== Number(link.amount) || paidCurrency !== String(link.currency).toUpperCase()) {
        res.status(400).json({ error: "PayPal payment does not match payment link" });
        return;
      }
      const inserted = await recordProviderTransaction("paypal", String(capture.id), { id: randomUUID(), payment_link_id: resourceId, amount: paidAmount, currency: paidCurrency, status: "Success", payment_method: "PayPal", client: data.payer?.name?.given_name ?? data.payer?.email_address ?? "Customer", user_id: userId }, data);
      if (inserted) addLog("payment_confirmation", `PayPal payment link captured: ${resourceId}`, { orderId: req.params.orderId });
    }
    res.json({ status: "COMPLETED" });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Protected routes (require Supabase JWT) ───────────────────────────────────

const api = express.Router();
api.use(requireAuth);

// Invoices
api.get("/invoices", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { limit, offset } = getPagination(req.query);
  const { data, error, count } = await supabaseAdmin.from("invoices").select("*", { count: "exact" }).eq("user_id", userId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data, total: count ?? 0, limit, offset });
});

api.get("/invoices/:id", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { data, error } = await supabaseAdmin.from("invoices").select("*").eq("user_id", userId).or(`id.eq.${req.params.id},metadata->>invoiceNumber.eq.${req.params.id}`).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data)  { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data });
});

api.get("/plan/usage", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const planId = getPlanId(userData?.user);
  const limit = planId === "pro" ? null : 5;
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin.from("invoices").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startOfMonth.toISOString());
  res.json({ planId, invoicesThisMonth: count ?? 0, invoiceLimit: limit, canCreateInvoice: limit === null || (count ?? 0) < limit });
});

api.post("/invoices", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const planId = getPlanId(userData?.user);

  if (planId !== "pro") {
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin.from("invoices").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startOfMonth.toISOString());
    if ((count ?? 0) >= 5) { res.status(403).json({ error: "Invoice limit reached", code: "PLAN_LIMIT_REACHED", message: "Free plan allows 5 invoices per month.", upgradeRequired: true }); return; }
  }

  const parsed = InvoiceCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: "Invalid invoice", details: parsed.error.flatten() });
    return;
  }

  const body = parsed.data;
  const newInvoice = {
    id: randomUUID(),
    client: body.customerName,
    amount: body.amount,
    date: body.invoiceDate ?? new Date().toISOString().split("T")[0],
    due_date: body.dueDate,
    status: "UNPAID",
    metadata: {
      invoiceNumber: `INV-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      currency: body.currency,
      customerEmail: body.customerEmail ?? "",
      items: body.items,
      notes: body.notes,
      taxRate: body.taxRate,
      paymentMethods: body.paymentMethods,
    },
    user_id: userId,
  };
  const { data, error } = await supabaseAdmin.from("invoices").insert(newInvoice).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ data, paymentUrl: `${process.env.APP_URL}/pay/${data.public_token}` });
});

api.patch("/invoices/:id", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const allowed: Record<string, unknown> = {};
  if (typeof req.body?.client === "string" && req.body.client.trim()) allowed.client = req.body.client.trim();
  if (typeof req.body?.due_date === "string") allowed.due_date = req.body.due_date;
  if (["DRAFT", "UNPAID", "VOID"].includes(req.body?.status)) allowed.status = req.body.status;
  if (Object.keys(allowed).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  const { data, error } = await supabaseAdmin.from("invoices").update(allowed).eq("id", req.params.id).eq("user_id", userId).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data)  { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data });
});

api.delete("/invoices/:id", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { error } = await supabaseAdmin.from("invoices").delete().eq("id", req.params.id).eq("user_id", userId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ message: "Deleted" });
});

// Payments
api.post("/payments/:id/process", (_req, res) => {
  res.status(410).json({
    error: "Direct payment processing is disabled. Payment status is changed only by a verified provider webhook.",
  });
});

// Transactions
api.get("/transactions", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { limit, offset } = getPagination(req.query);
  const { data, error, count } = await supabaseAdmin.from("transactions").select("*", { count: "exact" }).eq("user_id", userId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data, total: count ?? 0, limit, offset });
});

// Customers
api.get("/customers", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { limit, offset } = getPagination(req.query);
  const { data, error, count } = await supabaseAdmin.from("customers").select("*", { count: "exact" }).eq("user_id", userId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data, total: count ?? 0, limit, offset });
});

api.post("/customers", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const parsed = CustomerCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Invalid customer", details: parsed.error.flatten() }); return; }
  const { data, error } = await supabaseAdmin.from("customers").insert({
    ...parsed.data,
    id: randomUUID(),
    status: "Active",
    total_billed: 0,
    user_id: userId,
  }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ data });
});

// Payment Links
api.get("/payment-links", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { limit, offset } = getPagination(req.query);
  const { data, error, count } = await supabaseAdmin.from("payment_links").select("*", { count: "exact" }).eq("user_id", userId).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data, total: count ?? 0, limit, offset });
});

api.post("/payment-links", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const parsed = PaymentLinkCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Invalid payment link", details: parsed.error.flatten() }); return; }
  const { title, amount, currency, methods, description } = parsed.data;

  const row = {
    id: randomUUID(), user_id: userId,
    title, amount, currency, methods,
    ...(description && { description }),
    // Always share FinTrust's hosted page so checkout sessions carry tenant
    // metadata and can be reconciled by the verified provider webhook.
    reference: null,
    is_active: true, clicks: 0,
  };
  const { data, error } = await supabaseAdmin.from("payment_links").insert(row).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ data });
});

api.patch("/payment-links/:id", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const allowed: Record<string, unknown> = {};
  if (typeof req.body?.is_active === "boolean") allowed.is_active = req.body.is_active;
  if (typeof req.body?.title === "string") allowed.title = req.body.title;
  if (Object.keys(allowed).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  const { data, error } = await supabaseAdmin.from("payment_links").update(allowed).eq("id", req.params.id).eq("user_id", userId).select().maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data)  { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data });
});

api.delete("/payment-links/:id", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { error } = await supabaseAdmin.from("payment_links").delete().eq("id", req.params.id).eq("user_id", userId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ message: "Deleted" });
});

// Webhook retry
api.post("/webhooks/retry/:eventId", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { data: log } = await supabaseAdmin.from("webhook_logs").select("*").eq("id", req.params.eventId).eq("user_id", userId).maybeSingle();
  if (!log) { res.status(404).json({ error: "Webhook event not found" }); return; }
  addLog("system", `Manual retry initiated for webhook ${req.params.eventId}`);
  setImmediate(() => deliverWebhook(log.url, log.event_type, log.payload, req.params.eventId, userId));
  res.json({ message: "Retry initiated", eventId: req.params.eventId });
});

// QR Payments
api.get("/qr-payments", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { data, error } = await supabaseAdmin.from("qr_payments").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ data });
});

api.post("/qr-payments", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const parsed = QRPaymentCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: "Invalid QR payment", details: parsed.error.flatten() }); return; }
  if (parsed.data.qr_type === "dynamic" && parsed.data.amount <= 0) {
    res.status(422).json({ error: "Dynamic QR requires a positive amount" }); return;
  }
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (getPlanId(userData?.user) !== "pro") {
    const startOfMonth = new Date(); startOfMonth.setUTCDate(1); startOfMonth.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin.from("qr_payments").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startOfMonth.toISOString());
    if ((count ?? 0) >= 10) { res.status(403).json({ error: "Monthly QR limit reached", code: "PLAN_LIMIT_REACHED" }); return; }
  }
  const { qr_type, expires_at, ...input } = parsed.data;
  const { data, error } = await supabaseAdmin.from("qr_payments").insert({ ...input, qr_type, expires_at: qr_type === "dynamic" ? expires_at ?? null : null, status: qr_type === "static" ? "Active" : "Pending", id: randomUUID(), user_id: userId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ data });
});

api.get("/qr-payments/usage", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const planId = getPlanId(userData?.user);
  const limit = planId === "pro" ? null : 10;
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin.from("qr_payments").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startOfMonth.toISOString());
  res.json({ used: count ?? 0, limit, canGenerate: limit === null || (count ?? 0) < limit });
});

// Stripe gateway management
api.post("/gateways/stripe/connect", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { publishableKey, secretKey, webhookSecret, environment = "live" } = req.body;
  if (!publishableKey || !secretKey || !webhookSecret) { res.status(400).json({ error: "Publishable key, secret key, and webhook signing secret are required." }); return; }
  if (!secretKey.startsWith("sk_"))  { res.status(400).json({ error: "Invalid secret key format." }); return; }
  if (!webhookSecret.startsWith("whsec_")) { res.status(400).json({ error: "Invalid webhook signing secret format." }); return; }
  try { await new Stripe(secretKey).balance.retrieve(); } catch { res.status(400).json({ error: "Stripe keys verification failed." }); return; }

  const { error } = await supabaseAdmin.from("gateway_configs").upsert({ user_id: userId, gateway: "stripe", publishable_key: publishableKey, secret_key: secretKey, webhook_secret: webhookSecret, environment, updated_at: new Date().toISOString() }, { onConflict: "user_id,gateway" });
  if (error) {
    if (error.code === "42P01") { res.status(503).json({ error: "Run migrations/001_gateway_configs.sql in Supabase SQL Editor first." }); }
    else { res.status(500).json({ error: error.message }); }
    return;
  }
  addLog("system", `Stripe connected for user ${userId}`, { environment });
  res.json({ connected: true, environment });
});

api.delete("/gateways/stripe/disconnect", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  await supabaseAdmin.from("gateway_configs").delete().eq("user_id", userId).eq("gateway", "stripe");
  res.json({ disconnected: true });
});

api.get("/gateways/stripe/status", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { data, error } = await supabaseAdmin.from("gateway_configs").select("publishable_key, environment, updated_at, webhook_secret").eq("user_id", userId).eq("gateway", "stripe").maybeSingle();
  if (error) { res.json({ connected: false, publishableKey: null, environment: null, connectedAt: null, webhookConfigured: false, migrationPending: true }); return; }
  res.json({ connected: Boolean(data?.webhook_secret), publishableKey: data?.publishable_key ?? null, environment: data?.environment ?? null, connectedAt: data?.updated_at ?? null, webhookConfigured: Boolean(data?.webhook_secret), webhookUrl: `${process.env.APP_URL}/api/stripe/webhook/${userId}` });
});

// ── Crypto wallet gateway ─────────────────────────────────────────────────────

api.post("/gateways/crypto/save", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { wallets } = req.body as { wallets: Record<string, string> };
  if (!wallets || typeof wallets !== "object") {
    res.status(400).json({ error: "wallets object is required." });
    return;
  }

  // Whitelist accepted coin keys
  const allowed = ["usdt_trc20", "usdt_erc20", "btc", "eth", "bnb_bsc"];
  const sanitized: Record<string, string> = {};
  for (const key of allowed) {
    const val = wallets[key];
    if (typeof val === "string") sanitized[key] = val.trim();
  }

  const { error } = await supabaseAdmin.from("gateway_configs").upsert(
    { user_id: userId, gateway: "crypto", config: sanitized, updated_at: new Date().toISOString() },
    { onConflict: "user_id,gateway" }
  );
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ saved: true, wallets: sanitized });
});

api.get("/gateways/crypto/status", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { data } = await supabaseAdmin
    .from("gateway_configs")
    .select("config, updated_at")
    .eq("user_id", userId)
    .eq("gateway", "crypto")
    .maybeSingle();
  res.json({ wallets: (data?.config ?? {}) as Record<string, string>, updatedAt: data?.updated_at ?? null });
});

// Public: returns the merchant's crypto wallets for an invoice OR payment link (no auth)
app.get("/api/public/crypto/wallets/:invoiceId", async (req, res) => {
  const { invoiceId } = req.params;
  const { data: inv } = await supabaseAdmin.from("invoices").select("user_id").eq("public_token", invoiceId).maybeSingle();
  let merchantId: string | null = inv?.user_id ?? null;

  if (!merchantId) {
    const { data: link } = await supabaseAdmin.from("payment_links").select("user_id").eq("id", invoiceId).maybeSingle();
    merchantId = link?.user_id ?? null;
  }
  if (!merchantId) { res.status(404).json({ error: "Invoice not found." }); return; }

  const { data } = await supabaseAdmin
    .from("gateway_configs")
    .select("config")
    .eq("user_id", merchantId)
    .eq("gateway", "crypto")
    .maybeSingle();
  res.json({ wallets: (data?.config ?? {}) as Record<string, string> });
});

// Plan upgrade
api.post("/plan/upgrade", async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRO_PRICE_ID) {
    res.status(503).json({ error: "Billing not configured." }); return;
  }
  const { userId } = req as unknown as AuthenticatedRequest;
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({ mode: "subscription", payment_method_types: ["card"], line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }], customer_email: userData?.user?.email ?? undefined, success_url: `${process.env.APP_URL}/settings?upgrade=success`, cancel_url: `${process.env.APP_URL}/settings?upgrade=cancelled`, metadata: { userId, upgradeTo: "pro" } });
  res.json({ url: session.url });
});

app.use("/api", api);

// ─── AI Agent ─────────────────────────────────────────────────────────────────

const agentLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Agent rate limit reached. Please wait a moment." },
});

app.post(
  "/api/agent/chat",
  agentLimiter,
  requireAuth as express.RequestHandler,
  async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { messages } = req.body as { messages?: AgentMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array is required" });
      return;
    }

    const valid = messages.every(
      (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    );
    if (!valid) {
      res.status(400).json({ error: "Each message must have role (user|assistant) and content (string)" });
      return;
    }

    try {
      const result = await runAgentChat(messages, userId);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Agent error";
      console.error("[agent]", err);
      res.status(500).json({ error: msg });
    }
  }
);

const AGENT_FREE_TASKS_PER_MONTH = 5;

app.post("/api/agent/act/start", agentLimiter, requireAuth as express.RequestHandler, async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const task = typeof req.body?.task === "string" ? req.body.task.trim() : "";
  if (!task) { res.status(400).json({ error: "task (string) is required" }); return; }

  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const planId = getPlanId(userData?.user);
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const { count, error: countError } = await supabaseAdmin
    .from("agent_tasks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  if (countError) {
    res.status(countError.code === "42P01" ? 503 : 500).json({
      error: countError.code === "42P01" ? "Database migration required: migrations/006_agent_tasks.sql" : countError.message,
    });
    return;
  }

  if (planId !== "pro" && (count ?? 0) >= AGENT_FREE_TASKS_PER_MONTH) {
    res.status(403).json({
      error: "Agent task limit reached",
      code: "PLAN_LIMIT_REACHED",
      upgradeRequired: true,
      used: count ?? 0,
      limit: AGENT_FREE_TASKS_PER_MONTH,
    });
    return;
  }

  const { error: insertError } = await supabaseAdmin
    .from("agent_tasks")
    .insert({ user_id: userId, task: task.slice(0, 500) });
  if (insertError) { res.status(500).json({ error: insertError.message }); return; }

  res.json({
    allowed: true,
    planId,
    used: planId === "pro" ? null : (count ?? 0) + 1,
    limit: planId === "pro" ? null : AGENT_FREE_TASKS_PER_MONTH,
  });
});

const llmProxyLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "LLM rate limit reached. Please wait a moment." },
});

app.post(
  "/api/llm/v1/chat/completions",
  llmProxyLimiter,
  requireAuth as express.RequestHandler,
  async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) { res.status(503).json({ error: "LLM not configured" }); return; }

    const { userId } = req as AuthenticatedRequest;
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const planId = getPlanId(userData?.user);
    if (planId !== "pro") {
      const startOfMonth = new Date();
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);
      const [{ count: taskCount }, { count: requestCount }] = await Promise.all([
        supabaseAdmin.from("agent_tasks").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startOfMonth.toISOString()),
        supabaseAdmin.from("agent_llm_requests").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startOfMonth.toISOString()),
      ]);
      if ((taskCount ?? 0) === 0) { res.status(403).json({ error: "Start an Act Mode task first." }); return; }
      if ((requestCount ?? 0) >= 100) { res.status(429).json({ error: "Monthly Act Mode model limit reached." }); return; }
      const { error: usageError } = await supabaseAdmin.from("agent_llm_requests").insert({ user_id: userId });
      if (usageError) { res.status(503).json({ error: "Act Mode usage tracking is unavailable." }); return; }
    }

    const baseURL = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const body: Record<string, unknown> = {
      ...(req.body as Record<string, unknown>),
      model: process.env.LLM_MODEL ?? "gpt-4o-mini",
    };

    if (/qwen/i.test(String(body.model)) && body.reasoning === undefined) {
      body.reasoning = { enabled: false };
    }

    try {
      const upstream = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55_000),
      });
      const responseBody = await upstream.arrayBuffer();
      res.status(upstream.status);
      res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
      res.send(Buffer.from(responseBody));
    } catch (error) {
      console.error("[llm-proxy]", error);
      res.status(502).json({ error: "LLM provider unavailable" });
    }
  }
);

// ─── Super Admin routes ───────────────────────────────────────────────────────

const adminApi = express.Router();
adminApi.use(requireAdmin as express.RequestHandler);

adminApi.get("/verify", (req, res) => {
  const { userEmail } = req as AuthenticatedRequest;
  res.json({ isAdmin: true, email: userEmail });
});

adminApi.get("/stats", async (_req, res) => {
  try {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const { data: transactions } = await supabaseAdmin.from("transactions").select("amount, status, payment_method, created_at, user_id");
    const successTxns = (transactions ?? []).filter((t) => t.status === "Success");
    const totalRevenue = successTxns.reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const monthlyRevenue = successTxns.filter((t) => new Date(t.created_at) >= startOfMonth).reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const { count: totalInvoices } = await supabaseAdmin.from("invoices").select("*", { count: "exact", head: true });
    const { count: paidInvoices } = await supabaseAdmin.from("invoices").select("*", { count: "exact", head: true }).eq("status", "PAID");
    const activeMerchantIds = new Set(successTxns.map((t) => t.user_id).filter(Boolean));
    const gatewayBreakdown = successTxns.reduce<Record<string, number>>((acc, t) => {
      const gw = t.payment_method ?? "Unknown"; acc[gw] = (acc[gw] ?? 0) + (t.amount ?? 0); return acc;
    }, {});
    res.json({ totalMerchants: users.length, activeMerchants: activeMerchantIds.size, totalRevenue, monthlyRevenue, totalTransactions: successTxns.length, totalInvoices: totalInvoices ?? 0, paidInvoices: paidInvoices ?? 0, gatewayBreakdown });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

adminApi.get("/merchants", async (_req, res) => {
  try {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const { data: invoiceRows } = await supabaseAdmin.from("invoices").select("user_id, amount, status");
    const stats = new Map<string, { totalBilled: number; invoiceCount: number; paidCount: number }>();
    for (const inv of invoiceRows ?? []) {
      const s = stats.get(inv.user_id) ?? { totalBilled: 0, invoiceCount: 0, paidCount: 0 };
      s.invoiceCount++;
      if (inv.status === "PAID") { s.paidCount++; s.totalBilled += inv.amount ?? 0; }
      stats.set(inv.user_id, s);
    }
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());
    const merchants = users.map((u) => ({
      id: u.id, email: u.email ?? "", companyName: (u.user_metadata?.company_name as string) ?? "",
      plan: getPlanId(u),
      isSuspended: u.banned_until != null && new Date(u.banned_until) > new Date(),
      isAdmin: adminEmails.includes(u.email ?? ""),
      createdAt: u.created_at, lastSignIn: u.last_sign_in_at ?? null,
      ...(stats.get(u.id) ?? { totalBilled: 0, invoiceCount: 0, paidCount: 0 }),
    }));
    res.json({ data: merchants, total: merchants.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

adminApi.get("/transactions", async (req, res) => {
  const { limit, offset } = getPagination(req.query);
  try {
    const { data, error, count } = await supabaseAdmin.from("transactions").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ data, total: count ?? 0, limit, offset });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

adminApi.get("/gateways", async (_req, res) => {
  const { data: configs } = await supabaseAdmin.from("gateway_configs").select("gateway, user_id, environment, updated_at");
  const byGateway = (configs ?? []).reduce<Record<string, { count: number; env: string }>>((acc, c) => {
    if (!acc[c.gateway]) acc[c.gateway] = { count: 0, env: c.environment ?? "live" };
    acc[c.gateway].count++; return acc;
  }, {});
  res.json({
    gateways: [
      { id: "stripe", name: "Stripe", status: process.env.STRIPE_SECRET_KEY ? "active" : "not_configured", merchantCount: byGateway["stripe"]?.count ?? 0, environment: byGateway["stripe"]?.env ?? null },
      { id: "paypal", name: "PayPal", status: process.env.PAYPAL_CLIENT_ID ? "active" : "not_configured", merchantCount: byGateway["paypal"]?.count ?? 0, environment: "live" },
      { id: "promptpay", name: "PromptPay", status: "active", merchantCount: 0, environment: "production" },
      { id: "crypto", name: "Crypto Pay", status: "development", merchantCount: 0, environment: null },
    ],
    sseClients: 0,
    recentLogCount: recentLogs.length,
  });
});

adminApi.patch("/merchants/:userId/plan", async (req, res) => {
  const { userId } = req.params;
  const { plan } = req.body as { plan: "free" | "pro" };
  if (!["free", "pro"].includes(plan)) { res.status(400).json({ error: "plan must be 'free' or 'pro'" }); return; }
  try {
    await setUserPlan(userId, plan);
    addLog("system", `Admin set plan=${plan} for ${userId}`);
    res.json({ success: true, userId, plan });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

adminApi.patch("/merchants/:userId/status", async (req, res) => {
  const { userId } = req.params;
  const { action } = req.body as { action: "suspend" | "unsuspend" };
  if (!["suspend", "unsuspend"].includes(action)) { res.status(400).json({ error: "action must be 'suspend' or 'unsuspend'" }); return; }
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: action === "suspend" ? "876000h" : "none" });
    addLog("system", `Admin ${action}ed merchant ${userId}`);
    res.json({ success: true, userId, action });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.use("/api/admin", adminApi);

// ─── Export for Vercel ────────────────────────────────────────────────────────
export default app;
