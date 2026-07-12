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

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();

app.use(cors());

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { invoiceId, userId, upgradeTo } = session.metadata ?? {};

    if (upgradeTo === "pro" && userId) {
      await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { plan: "pro" } });
      addLog("system", `Account upgraded to Pro: ${userId}`);
    }

    if (invoiceId && userId) {
      await supabaseAdmin.from("invoices").update({ status: "PAID" }).eq("id", invoiceId).eq("user_id", userId);
      await supabaseAdmin.from("transactions").insert({
        id: randomUUID(), invoice_id: invoiceId,
        amount: (session.amount_total ?? 0) / 100,
        currency: session.currency?.toUpperCase() ?? "USD",
        status: "Success", payment_method: "Card",
        client: session.customer_details?.name ?? session.customer_details?.email ?? "Customer",
        user_id: userId,
      });
      const clientName = session.customer_details?.name ?? session.customer_details?.email ?? "Customer";
      await syncCustomerTotalBilled(clientName, userId);
      addLog("payment_confirmation", `Stripe payment confirmed: ${invoiceId}`, { sessionId: session.id });
    }
  }
  res.json({ received: true });
});

app.use(express.json());

// ── Public Developer API (/v1/*) ──────────────────────────────────────────────
// Reached directly via the /v1/(.*) rewrite and also under /api/v1 for the
// in-app API tester (same-origin, no extra rewrite needed).
app.use("/v1", apiLimiter, v1);
app.use("/api/v1", v1);

// ── Public routes (no auth) ───────────────────────────────────────────────────

app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));
app.get("/api/logs",   (_req, res) => res.json({ data: recentLogs }));

app.get("/api/public/payment-status/:invoiceId", async (req, res) => {
  const { data } = await supabaseAdmin.from("invoices").select("status").eq("id", req.params.invoiceId).maybeSingle();
  res.json({ status: data?.status ?? "NOT_FOUND" });
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

app.post("/api/public/stripe/create-checkout", async (req, res) => {
  const { invoiceId } = req.body as { invoiceId: string };
  const { data: inv } = await supabaseAdmin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();

  // Prefer operator's own Stripe key; fall back to platform key
  let stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  if (inv?.user_id) {
    const { data: gw } = await supabaseAdmin.from("gateway_configs").select("secret_key").eq("user_id", inv.user_id).eq("gateway", "stripe").maybeSingle();
    if (gw?.secret_key) stripeKey = gw.secret_key;
  }
  if (!stripeKey) { res.status(503).json({ error: "Stripe is not connected. Go to Settings → Payment Gateways to connect your Stripe account." }); return; }
  if (!inv)            { res.status(404).json({ error: "Invoice not found" }); return; }
  if (inv.status === "PAID") { res.status(409).json({ error: "Invoice already paid" }); return; }

  const stripe = new Stripe(stripeKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment", payment_method_types: ["card"],
    line_items: [{ price_data: { currency: (inv.metadata?.currency ?? "usd").toLowerCase(), product_data: { name: inv.metadata?.invoiceNumber ?? `Invoice ${inv.id.slice(0, 8).toUpperCase()}`, description: `Payment from ${inv.client}` }, unit_amount: Math.round(Number(inv.amount) * 100) }, quantity: 1 }],
    customer_email: inv.metadata?.customerEmail ?? undefined,
    success_url: `${process.env.APP_URL}/pay/${invoiceId}?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/pay/${invoiceId}`,
    metadata: { invoiceId: inv.id, userId: inv.user_id },
  });
  res.json({ url: session.url });
});

app.post("/api/public/paypal/create-order", async (req, res) => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    res.status(503).json({ error: "PayPal is not configured." }); return;
  }
  const { invoiceId } = req.body as { invoiceId: string };
  const { data: inv } = await supabaseAdmin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!inv)            { res.status(404).json({ error: "Invoice not found" }); return; }
  if (inv.status === "PAID") { res.status(409).json({ error: "Invoice already paid" }); return; }

  try {
    const token = await getPayPalToken();
    const r = await fetch(`${paypalBaseURL()}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": randomUUID() },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: invoiceId, custom_id: `${inv.id}|${inv.user_id}`, amount: { currency_code: (inv.metadata?.currency ?? "USD").toUpperCase(), value: Number(inv.amount).toFixed(2) }, description: `${inv.metadata?.invoiceNumber ?? inv.id} — ${inv.client}` }],
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
    const [invoiceId, userId] = (pu?.custom_id ?? "").split("|");
    const capture = pu?.payments?.captures?.[0];

    if (invoiceId && userId) {
      const { data: inv } = await supabaseAdmin.from("invoices").update({ status: "PAID" }).eq("id", invoiceId).eq("user_id", userId).select().single();
      if (inv) {
        await supabaseAdmin.from("transactions").insert({ id: randomUUID(), invoice_id: invoiceId, amount: parseFloat(capture?.amount?.value ?? String(inv.amount)), currency: capture?.amount?.currency_code ?? inv.metadata?.currency ?? "USD", status: "Success", payment_method: "PayPal", client: inv.client, user_id: userId });
        await syncCustomerTotalBilled(inv.client, userId);
        addLog("payment_confirmation", `PayPal payment captured: ${invoiceId}`, { orderId: req.params.orderId });
      }
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
  const planId: string = (userData?.user?.user_metadata?.plan as string) ?? "free";
  const limit = planId === "pro" ? null : 5;
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin.from("invoices").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startOfMonth.toISOString());
  res.json({ planId, invoicesThisMonth: count ?? 0, invoiceLimit: limit, canCreateInvoice: limit === null || (count ?? 0) < limit });
});

api.post("/invoices", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const planId: string = (userData?.user?.user_metadata?.plan as string) ?? "free";

  if (planId !== "pro") {
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin.from("invoices").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startOfMonth.toISOString());
    if ((count ?? 0) >= 5) { res.status(403).json({ error: "Invoice limit reached", code: "PLAN_LIMIT_REACHED", message: "Free plan allows 5 invoices per month.", upgradeRequired: true }); return; }
  }

  const body = req.body;
  const newInvoice = { id: randomUUID(), client: body.customerName ?? "Unknown", amount: Number(body.amount) || 0, date: new Date().toISOString().split("T")[0], due_date: body.dueDate ? new Date(body.dueDate).toISOString().split("T")[0] : null, status: "UNPAID", metadata: { invoiceNumber: `INV-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`, currency: body.currency ?? "USD", customerEmail: body.customerEmail ?? "", items: body.items ?? [] }, user_id: userId };
  const { data, error } = await supabaseAdmin.from("invoices").insert(newInvoice).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ data });
});

api.patch("/invoices/:id", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { data, error } = await supabaseAdmin.from("invoices").update(req.body).eq("id", req.params.id).eq("user_id", userId).select().single();
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
api.post("/payments/:id/process", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { data: inv, error: fetchErr } = await supabaseAdmin.from("invoices").select("*").eq("id", req.params.id).eq("user_id", userId).maybeSingle();
  if (fetchErr) { res.status(500).json({ error: fetchErr.message }); return; }
  if (!inv)     { res.status(404).json({ error: "Invoice not found" }); return; }
  if (inv.status === "PAID") { res.status(409).json({ error: "Invoice already paid" }); return; }

  const { data: updated, error: updateErr } = await supabaseAdmin.from("invoices").update({ status: "PAID" }).eq("id", inv.id).eq("user_id", userId).select().single();
  if (updateErr) { res.status(500).json({ error: updateErr.message }); return; }

  const txId = randomUUID();
  await supabaseAdmin.from("transactions").insert({ id: txId, invoice_id: inv.id, client: inv.client, amount: inv.amount, currency: inv.metadata?.currency ?? "THB", status: "Success", payment_method: req.body.gateway ?? "Unknown", user_id: userId });
  await syncCustomerTotalBilled(inv.client, userId);
  addLog("payment_confirmation", `Payment received for ${inv.metadata?.invoiceNumber ?? inv.id}`, { amount: inv.amount, gateway: req.body.gateway ?? "Unknown" });
  res.json({ data: updated, message: `Payment processed via ${req.body.gateway ?? "Unknown"}`, txId });
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
  const { data, error } = await supabaseAdmin.from("customers").insert({ ...req.body, id: randomUUID(), user_id: userId }).select().single();
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
  const { data, error } = await supabaseAdmin.from("payment_links").insert({ ...req.body, id: randomUUID(), user_id: userId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ data });
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
  const { data, error } = await supabaseAdmin.from("qr_payments").insert({ ...req.body, id: randomUUID(), user_id: userId }).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ data });
});

api.get("/qr-payments/usage", async (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const planId: string = (userData?.user?.user_metadata?.plan as string) ?? "free";
  const limit = planId === "pro" ? null : 10;
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin.from("qr_payments").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", startOfMonth.toISOString());
  res.json({ used: count ?? 0, limit, canGenerate: limit === null || (count ?? 0) < limit });
});

// Stripe gateway management
api.post("/gateways/stripe/connect", async (req, res) => {
  const { userId } = req as unknown as AuthenticatedRequest;
  const { publishableKey, secretKey, environment = "live" } = req.body;
  if (!publishableKey || !secretKey) { res.status(400).json({ error: "Both publishableKey and secretKey are required." }); return; }
  if (!secretKey.startsWith("sk_"))  { res.status(400).json({ error: "Invalid secret key format." }); return; }
  try { await new Stripe(secretKey).balance.retrieve(); } catch { res.status(400).json({ error: "Stripe keys verification failed." }); return; }

  const { error } = await supabaseAdmin.from("gateway_configs").upsert({ user_id: userId, gateway: "stripe", publishable_key: publishableKey, secret_key: secretKey, environment, updated_at: new Date().toISOString() }, { onConflict: "user_id,gateway" });
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
  const { data, error } = await supabaseAdmin.from("gateway_configs").select("publishable_key, environment, updated_at").eq("user_id", userId).eq("gateway", "stripe").maybeSingle();
  if (error?.code === "42P01") { res.json({ connected: false, publishableKey: null, environment: null, connectedAt: null, migrationPending: true }); return; }
  res.json({ connected: Boolean(data), publishableKey: data?.publishable_key ?? null, environment: data?.environment ?? null, connectedAt: data?.updated_at ?? null });
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

// Public: returns the invoice merchant's crypto wallets (no auth required)
app.get("/api/public/crypto/wallets/:invoiceId", async (req, res) => {
  const { invoiceId } = req.params;
  const { data: inv } = await supabaseAdmin.from("invoices").select("user_id").eq("id", invoiceId).maybeSingle();
  if (!inv?.user_id) { res.status(404).json({ error: "Invoice not found." }); return; }

  const { data } = await supabaseAdmin
    .from("gateway_configs")
    .select("config")
    .eq("user_id", inv.user_id)
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
      plan: (u.user_metadata?.plan as string) ?? "free",
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
    await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { plan } });
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
