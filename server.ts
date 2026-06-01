import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { randomUUID } from "crypto";
import Stripe from "stripe";
import rateLimit from "express-rate-limit";
import { supabaseAdmin, createUserClient } from "./lib/supabase.js";
import { requireAuth, type AuthenticatedRequest } from "./middleware/auth.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityLog {
  id: string;
  type: "api_request" | "payment_confirmation" | "webhook" | "system";
  message: string;
  metadata?: unknown;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// SSE Client Registry — use Set to avoid duplicates & simplify cleanup
// ---------------------------------------------------------------------------

const sseClients = new Set<express.Response>();

// In-memory ring buffer for recent logs (max 100).
// This is intentionally in-memory — it's ephemeral activity feed, not durable storage.
const recentLogs: ActivityLog[] = [];

function addLog(
  type: ActivityLog["type"],
  message: string,
  metadata?: unknown
) {
  const log: ActivityLog = {
    id: randomUUID(),
    type,
    message,
    metadata,
    timestamp: new Date().toISOString(),
  };

  recentLogs.unshift(log);
  if (recentLogs.length > 100) recentLogs.pop();

  // Broadcast to all connected SSE clients
  const payload = `data: ${JSON.stringify(log)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      // Client disconnected between writes — remove it
      sseClients.delete(client);
    }
  }
}

// Startup logs
addLog("system", "Server started");
addLog("webhook", "Webhook endpoint ready", { status: "success" });

// ---------------------------------------------------------------------------
// Seed data helper — only used in dev when SEED_DB=true
// ---------------------------------------------------------------------------

async function seedDevData() {
  if (process.env.SEED_DB !== "true") return;

  // Check if any invoice already exists (skip if seeded)
  const { count } = await supabaseAdmin
    .from("invoices")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) > 0) {
    console.log("[seed] Skipping — data already exists");
    return;
  }

  console.log("[seed] Inserting seed invoices…");
  await supabaseAdmin.from("invoices").insert([
    {
      id: randomUUID(),
      client: "Acme Corp",
      amount: 1540.0,
      date: "2026-05-29",
      due_date: "2026-06-15",
      status: "UNPAID",
      metadata: {
        invoiceNumber: "INV-2026-0001",
        currency: "USD",
        customerEmail: "billing@acme.com",
        items: [
          { description: "SaaS Platform Setup", quantity: 1, price: 1000 },
          { description: "Premium Support (Q2)", quantity: 3, price: 180 },
        ],
      },
    },
    {
      id: randomUUID(),
      client: "Sabai Digital",
      amount: 7500.0,
      date: "2026-05-21",
      due_date: "2026-05-28",
      status: "PAID",
      metadata: {
        invoiceNumber: "INV-2026-0002",
        currency: "THB",
        customerEmail: "hello@sabaidigital.th",
        items: [{ description: "SEO Optimization", quantity: 1, price: 7500 }],
      },
    },
  ]);
}

// ---------------------------------------------------------------------------
// PayPal helper — reused by create-order and capture-order routes
// ---------------------------------------------------------------------------

function paypalBaseURL(): string {
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

// ---------------------------------------------------------------------------
// Pagination helper — clamps limit to [1, 100], offset to ≥ 0
// ---------------------------------------------------------------------------

function getPagination(query: Record<string, any>, defaultLimit = 20) {
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? "")) || defaultLimit, 1), 100);
  const offset = Math.max(parseInt(String(query.offset ?? "")) || 0, 0);
  return { limit, offset };
}

// ---------------------------------------------------------------------------
// Real webhook delivery with exponential backoff (3 attempts: 0s, 2s, 4s)
// ---------------------------------------------------------------------------

async function deliverWebhook(
  url: string,
  eventType: string,
  payload: unknown,
  logId: string,
  userId: string,
  attempt = 1
): Promise<void> {
  const MAX_ATTEMPTS = 3;
  if (attempt > 1) {
    await new Promise((r) => setTimeout(r, (attempt - 1) * 2_000));
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-FinTrust-Event": eventType,
        "X-FinTrust-Attempt": String(attempt),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000), // 10s per attempt
    });

    // Persist response status back to the log
    await supabaseAdmin
      .from("webhook_logs")
      .update({ response_status: res.status })
      .eq("id", logId)
      .eq("user_id", userId);

    if (res.ok) {
      addLog("webhook", `Webhook delivered to ${url} (attempt ${attempt})`, {
        logId, status: res.status,
      });
    } else if (attempt < MAX_ATTEMPTS) {
      addLog("webhook", `Webhook attempt ${attempt} failed (HTTP ${res.status}), retrying…`, { logId });
      await deliverWebhook(url, eventType, payload, logId, userId, attempt + 1);
    } else {
      addLog("webhook", `Webhook failed after ${MAX_ATTEMPTS} attempts (HTTP ${res.status})`, { logId });
    }
  } catch (err: any) {
    const reason = err.name === "AbortError" ? "timeout (10s)" : err.message;
    if (attempt < MAX_ATTEMPTS) {
      addLog("webhook", `Webhook attempt ${attempt} error: ${reason}, retrying…`, { logId });
      await deliverWebhook(url, eventType, payload, logId, userId, attempt + 1);
    } else {
      addLog("webhook", `Webhook delivery failed: ${reason}`, { logId });
    }
  }
}

// ---------------------------------------------------------------------------
// Customer total_billed helper
// Recalculates and updates total_billed from all PAID invoices for a client.
// Called after every confirmed payment to keep the customers table accurate.
// ---------------------------------------------------------------------------

async function syncCustomerTotalBilled(
  clientName: string,
  userId: string
): Promise<void> {
  try {
    // Sum all PAID invoices for this client
    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("amount")
      .eq("user_id", userId)
      .eq("client", clientName)
      .eq("status", "PAID");

    const total = (invoices ?? []).reduce(
      (sum, inv) => sum + Number(inv.amount),
      0
    );

    // Update the customers row (match by name + user_id)
    await supabaseAdmin
      .from("customers")
      .update({ total_billed: total })
      .eq("user_id", userId)
      .eq("name", clientName);
  } catch (err) {
    // Non-critical — log and continue; don't break the payment flow
    console.error("[syncCustomerTotalBilled]", err);
  }
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());

  // ── Rate limiting ────────────────────────────────────────────────────────
  // Separate limits per surface: public endpoints (unauthenticated) are tighter.

  // Public payment routes — customer-facing, tighter window
  const publicPaymentLimiter = rateLimit({
    windowMs: 60_000,       // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again shortly." },
  });

  // Auth routes (login / register)
  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,  // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many authentication attempts, please try again later." },
  });

  // General API (authenticated operator routes)
  const apiLimiter = rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "API rate limit reached, please slow down." },
  });

  app.use("/api/public", publicPaymentLimiter);
  app.use("/api/auth", authLimiter);
  app.use("/api", apiLimiter);

  // ── Stripe webhook ── raw body MUST come before express.json() ──────────
  // Stripe signs the raw payload; parsing it first breaks signature verification.
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
        res.status(503).json({ error: "Stripe not configured" });
        return;
      }
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const sig = req.headers["stripe-signature"];
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig!,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err: any) {
        addLog("webhook", `Stripe signature verification failed: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const { invoiceId, userId, upgradeTo } = session.metadata ?? {};

        // ── Plan upgrade (subscription mode) ──────────────────────────────
        if (upgradeTo === "pro" && userId) {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: { plan: "pro" },
          });
          addLog("system", `Account upgraded to Pro: ${userId}`);
        }

        // ── Invoice payment (payment mode) ────────────────────────────────
        if (invoiceId && userId) {
          await supabaseAdmin
            .from("invoices")
            .update({ status: "PAID" })
            .eq("id", invoiceId)
            .eq("user_id", userId);

          await supabaseAdmin.from("transactions").insert({
            id: randomUUID(),
            invoice_id: invoiceId,
            amount: (session.amount_total ?? 0) / 100,
            currency: session.currency?.toUpperCase() ?? "USD",
            status: "Success",
            payment_method: "Card",
            client: session.customer_details?.name ?? session.customer_details?.email ?? "Customer",
            user_id: userId,
          });

          const clientName = session.customer_details?.name ?? session.customer_details?.email ?? "Customer";
          await syncCustomerTotalBilled(clientName, userId);

          addLog("payment_confirmation", `Stripe payment confirmed: ${invoiceId}`, {
            sessionId: session.id,
            amount: session.amount_total,
          });
        }
      }
      res.json({ received: true });
    }
  );

  app.use(express.json());

  // ── Payment status polling — public, lightweight, no auth ───────────────
  // Customers poll this every few seconds while looking at the QR code.
  // Returns only { status } to avoid leaking invoice details publicly.
  app.get("/api/public/payment-status/:invoiceId", async (req, res) => {
    const { data } = await supabaseAdmin
      .from("invoices")
      .select("status")
      .eq("id", req.params.invoiceId)
      .maybeSingle();

    res.json({ status: data?.status ?? "NOT_FOUND" });
  });

  // ── Gateway status — returns platform-level status only ─────────────────
  // Per-user Stripe status is in GET /api/gateways/stripe/status (authenticated)
  app.get("/api/gateways/status", (_req, res) => {
    const stripeOk = Boolean(process.env.STRIPE_SECRET_KEY);
    const paypalOk = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
    res.json({
      stripe: {
        connected: stripeOk,
        mode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : stripeOk ? "test" : null,
      },
      paypal: {
        connected: paypalOk,
        environment: paypalOk ? (process.env.PAYPAL_ENVIRONMENT ?? "sandbox") : null,
      },
      promptpay: { connected: true, mode: "local" },
    });
  });

  // ── Public payment routes — for customers (no auth required) ────────────
  // Customers pay via /pay/:id, they don't have Supabase sessions.

  app.post("/api/public/stripe/create-checkout", async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      res.status(503).json({ error: "Stripe is not configured on this server. Add STRIPE_SECRET_KEY to environment variables." });
      return;
    }
    const { invoiceId } = req.body as { invoiceId: string };
    const { data: inv } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    // Resolve Stripe key: prefer operator's own key, fall back to platform key
    let stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
    if (inv?.user_id) {
      const { data: gw } = await supabaseAdmin
        .from("gateway_configs")
        .select("secret_key")
        .eq("user_id", inv.user_id)
        .eq("gateway", "stripe")
        .maybeSingle();
      if (gw?.secret_key) stripeKey = gw.secret_key;
    }

    if (!stripeKey) {
      res.status(503).json({ error: "Stripe is not connected. Go to Settings → Payment Gateways and connect your Stripe account." });
      return;
    }

    if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
    if (inv.status === "PAID") { res.status(409).json({ error: "Invoice already paid" }); return; }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const currency = (inv.metadata?.currency ?? "usd").toLowerCase();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: inv.metadata?.invoiceNumber ?? `Invoice ${inv.id.slice(0, 8).toUpperCase()}`,
            description: `Payment from ${inv.client}`,
          },
          unit_amount: Math.round(Number(inv.amount) * 100),
        },
        quantity: 1,
      }],
      customer_email: inv.metadata?.customerEmail ?? undefined,
      success_url: `${process.env.APP_URL}/pay/${invoiceId}?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/pay/${invoiceId}`,
      metadata: { invoiceId: inv.id, userId: inv.user_id },
    });

    addLog("api_request", `Stripe checkout session created for invoice ${invoiceId}`);
    res.json({ url: session.url });
  });

  app.post("/api/public/paypal/create-order", async (req, res) => {
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      res.status(503).json({ error: "PayPal is not configured on this server. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to environment variables." });
      return;
    }
    const { invoiceId } = req.body as { invoiceId: string };
    const { data: inv } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    if (!inv) { res.status(404).json({ error: "Invoice not found" }); return; }
    if (inv.status === "PAID") { res.status(409).json({ error: "Invoice already paid" }); return; }

    try {
      const token = await getPayPalToken();
      const r = await fetch(`${paypalBaseURL()}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": randomUUID(),
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            reference_id: invoiceId,
            custom_id: `${inv.id}|${inv.user_id}`,
            amount: {
              currency_code: (inv.metadata?.currency ?? "USD").toUpperCase(),
              value: Number(inv.amount).toFixed(2),
            },
            description: `${inv.metadata?.invoiceNumber ?? inv.id} — ${inv.client}`,
          }],
          application_context: { shipping_preference: "NO_SHIPPING" },
        }),
      });
      const data = await r.json();
      if (!r.ok) { res.status(500).json({ error: "Failed to create PayPal order", detail: data }); return; }
      res.json({ orderId: data.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/public/paypal/capture-order/:orderId", async (req, res) => {
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      res.status(503).json({ error: "PayPal not configured" });
      return;
    }
    try {
      const token = await getPayPalToken();
      const r = await fetch(`${paypalBaseURL()}/v2/checkout/orders/${req.params.orderId}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await r.json();

      if (!r.ok || data.status !== "COMPLETED") {
        res.status(500).json({ error: "PayPal capture failed", detail: data });
        return;
      }

      const pu = data.purchase_units?.[0];
      const [invoiceId, userId] = (pu?.custom_id ?? "").split("|");
      const capture = pu?.payments?.captures?.[0];

      if (invoiceId && userId) {
        const { data: inv } = await supabaseAdmin
          .from("invoices")
          .update({ status: "PAID" })
          .eq("id", invoiceId)
          .eq("user_id", userId)
          .select()
          .single();

        if (inv) {
          await supabaseAdmin.from("transactions").insert({
            id: randomUUID(),
            invoice_id: invoiceId,
            amount: parseFloat(capture?.amount?.value ?? String(inv.amount)),
            currency: capture?.amount?.currency_code ?? inv.metadata?.currency ?? "USD",
            status: "Success",
            payment_method: "PayPal",
            client: inv.client,
            user_id: userId,
          });
          await syncCustomerTotalBilled(inv.client, userId);
          addLog("payment_confirmation", `PayPal payment captured: ${invoiceId}`, {
            orderId: req.params.orderId,
            captureId: capture?.id,
          });
        }
      }
      res.json({ status: "COMPLETED" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Request logging middleware — skip GET and log-stream endpoints
  app.use((req, _res, next) => {
    if (req.method !== "GET" && !req.path.startsWith("/api/logs")) {
      addLog("api_request", `${req.method} ${req.path}`, {
        body: req.body,
      });
    }
    next();
  });

  // ---------------------------------------------------------------------------
  // Public routes (no auth)
  // ---------------------------------------------------------------------------

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  // SSE live activity feed — public so the dashboard can show unauthenticated status
  app.get("/api/logs/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Send buffered history on connect
    res.write(
      `data: ${JSON.stringify({ type: "history", logs: recentLogs })}\n\n`
    );

    sseClients.add(res);

    // Heartbeat every 25 s to prevent proxy timeouts
    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // Fallback log fetch (non-streaming)
  app.get("/api/logs", (_req, res) => {
    res.json({ data: recentLogs });
  });

  // ---------------------------------------------------------------------------
  // Protected routes — all routes below require a valid Supabase JWT
  // ---------------------------------------------------------------------------

  const api = express.Router();
  api.use(requireAuth);

  // --- Invoices ---

  api.get("/invoices", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { limit, offset } = getPagination(req.query);
    const { data, error, count } = await supabaseAdmin
      .from("invoices")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ data, total: count ?? 0, limit, offset });
  });

  api.get("/invoices/:id", async (req, res) => {
    const { userId } = req as unknown as AuthenticatedRequest;
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .or(`id.eq.${req.params.id},metadata->>invoiceNumber.eq.${req.params.id}`)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data });
  });

  api.get("/plan/usage", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;

    // Get plan from Supabase user metadata
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const planId: string = (userData?.user?.user_metadata?.plan as string) ?? "free";
    const limit = planId === "pro" ? null : 5; // null = unlimited

    // Count invoices created this calendar month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startOfMonth.toISOString());

    res.json({
      planId,
      invoicesThisMonth: count ?? 0,
      invoiceLimit: limit,
      canCreateInvoice: limit === null || (count ?? 0) < limit,
    });
  });

  api.post("/invoices", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const body = req.body;

    // ── Freemium gate: enforce invoice limit for free accounts ────────────
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const planId: string = (userData?.user?.user_metadata?.plan as string) ?? "free";

    if (planId !== "pro") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count } = await supabaseAdmin
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfMonth.toISOString());

      if ((count ?? 0) >= 5) {
        res.status(403).json({
          error: "Invoice limit reached",
          code: "PLAN_LIMIT_REACHED",
          message: "Free plan allows 5 invoices per month. Upgrade to Pro for unlimited invoices.",
          upgradeRequired: true,
        });
        return;
      }
    }

    const newInvoice = {
      id: randomUUID(),
      client: body.customerName ?? "Unknown",
      amount: Number(body.amount) || 0,
      date: new Date().toISOString().split("T")[0],
      due_date: body.dueDate
        ? new Date(body.dueDate).toISOString().split("T")[0]
        : null,
      status: "UNPAID",
      metadata: {
        invoiceNumber: `INV-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        currency: body.currency ?? "USD",
        customerEmail: body.customerEmail ?? "",
        items: body.items ?? [],
      },
      user_id: userId,
    };

    const { data, error } = await supabaseAdmin
      .from("invoices")
      .insert(newInvoice)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ data });
  });

  api.patch("/invoices/:id", async (req, res) => {
    const { userId } = req as unknown as AuthenticatedRequest;
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .update(req.body)
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data });
  });

  api.delete("/invoices/:id", async (req, res) => {
    const { userId } = req as unknown as AuthenticatedRequest;
    const { error } = await supabaseAdmin
      .from("invoices")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", userId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ message: "Deleted" });
  });

  // --- Payments ---

  api.post("/payments/:id/process", async (req, res) => {
    const { userId } = req as unknown as AuthenticatedRequest;

    // 1. Fetch invoice and verify ownership
    const { data: inv, error: fetchErr } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr) {
      res.status(500).json({ error: fetchErr.message });
      return;
    }
    if (!inv) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    if (inv.status === "PAID") {
      res.status(409).json({ error: "Invoice already paid" });
      return;
    }

    // 2. Mark as PAID
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("invoices")
      .update({ status: "PAID" })
      .eq("id", inv.id)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateErr) {
      res.status(500).json({ error: updateErr.message });
      return;
    }

    // 3. Record transaction
    const txId = randomUUID();
    await supabaseAdmin.from("transactions").insert({
      id: txId,
      invoice_id: inv.id,
      client: inv.client,
      amount: inv.amount,
      currency: inv.metadata?.currency ?? "THB",
      status: "Success",
      payment_method: req.body.gateway ?? "Unknown",
      user_id: userId,
    });

    await syncCustomerTotalBilled(inv.client, userId);
    addLog(
      "payment_confirmation",
      `Payment received for ${inv.metadata?.invoiceNumber ?? inv.id}`,
      {
        amount: inv.amount,
        currency: inv.metadata?.currency,
        invoiceId: inv.id,
        gateway: req.body.gateway ?? "Unknown",
        txId,
      }
    );

    res.json({
      data: updated,
      message: `Payment processed via ${req.body.gateway ?? "Unknown"}`,
      txId,
    });
  });

  // --- Transactions ---

  api.get("/transactions", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { limit, offset } = getPagination(req.query);
    const { data, error, count } = await supabaseAdmin
      .from("transactions")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ data, total: count ?? 0, limit, offset });
  });

  // --- Customers ---

  api.get("/customers", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { limit, offset } = getPagination(req.query);
    const { data, error, count } = await supabaseAdmin
      .from("customers")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ data, total: count ?? 0, limit, offset });
  });

  api.post("/customers", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert({ ...req.body, id: randomUUID(), user_id: userId })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ data });
  });

  // --- Payment Links ---

  api.get("/payment-links", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { limit, offset } = getPagination(req.query);
    const { data, error, count } = await supabaseAdmin
      .from("payment_links")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ data, total: count ?? 0, limit, offset });
  });

  api.post("/payment-links", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { data, error } = await supabaseAdmin
      .from("payment_links")
      .insert({ ...req.body, id: randomUUID(), user_id: userId })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ data });
  });

  // --- Webhook Retry ---

  api.post("/webhooks/retry/:eventId", async (req, res) => {
    const { userId } = req as unknown as AuthenticatedRequest;
    const { eventId } = req.params;

    const { data: log } = await supabaseAdmin
      .from("webhook_logs")
      .select("*")
      .eq("id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!log) {
      res.status(404).json({ error: "Webhook event not found" });
      return;
    }

    addLog("system", `Manual retry initiated for webhook ${eventId}`);

    // Fire asynchronously — don't block the HTTP response
    setImmediate(() =>
      deliverWebhook(log.url, log.event_type, log.payload, eventId, userId)
    );

    res.json({ message: "Retry initiated", eventId });
  });

  // --- QR Payments ---

  api.get("/qr-payments", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { data, error } = await supabaseAdmin
      .from("qr_payments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ data });
  });

  api.post("/qr-payments", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { data, error } = await supabaseAdmin
      .from("qr_payments")
      .insert({ ...req.body, id: randomUUID(), user_id: userId })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ data });
  });

  // ── Per-operator Stripe key management ───────────────────────────────────
  // Each operator saves their own Stripe keys. Keys stored in gateway_configs
  // table (service_role only — never exposed to frontend directly).

  api.post("/gateways/stripe/connect", async (req, res) => {
    const { userId } = req as unknown as AuthenticatedRequest;
    const { publishableKey, secretKey, environment = "live" } = req.body as {
      publishableKey: string;
      secretKey: string;
      environment?: string;
    };

    if (!publishableKey || !secretKey) {
      res.status(400).json({ error: "Both publishableKey and secretKey are required." });
      return;
    }
    if (!secretKey.startsWith("sk_")) {
      res.status(400).json({ error: "Invalid secret key format. Must start with sk_live_ or sk_test_" });
      return;
    }

    // Quick verify — retrieve balance to confirm keys work
    try {
      const stripe = new Stripe(secretKey);
      await stripe.balance.retrieve();
    } catch {
      res.status(400).json({ error: "Stripe keys verification failed. Check that the keys are correct." });
      return;
    }

    const { error } = await supabaseAdmin.from("gateway_configs").upsert(
      { user_id: userId, gateway: "stripe", publishable_key: publishableKey, secret_key: secretKey, environment, updated_at: new Date().toISOString() },
      { onConflict: "user_id,gateway" }
    );

    if (error) { res.status(500).json({ error: error.message }); return; }

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
    const { data } = await supabaseAdmin
      .from("gateway_configs")
      .select("publishable_key, environment, updated_at")
      .eq("user_id", userId)
      .eq("gateway", "stripe")
      .maybeSingle();

    res.json({
      connected: Boolean(data),
      publishableKey: data?.publishable_key ?? null,
      environment: data?.environment ?? null,
      connectedAt: data?.updated_at ?? null,
    });
  });

  // ── PromptPay usage tracking ──────────────────────────────────────────────
  // Called when operator generates a QR in the PromptPay page.
  // Returns usage count + limit so frontend can show progress.

  api.get("/qr-payments/usage", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const planId: string = (userData?.user?.user_metadata?.plan as string) ?? "free";
    const limit = planId === "pro" ? null : 10;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabaseAdmin
      .from("qr_payments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", startOfMonth.toISOString());

    res.json({
      used: count ?? 0,
      limit,
      canGenerate: limit === null || (count ?? 0) < limit,
    });
  });

  // ── Plan upgrade via Stripe Subscription ─────────────────────────────────
  api.post("/plan/upgrade", async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRO_PRICE_ID) {
      res.status(503).json({ error: "Billing not configured. Contact support to upgrade." });
      return;
    }
    const { userId } = req as unknown as AuthenticatedRequest;
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userData?.user?.email;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      customer_email: email ?? undefined,
      success_url: `${process.env.APP_URL}/settings?upgrade=success`,
      cancel_url: `${process.env.APP_URL}/settings?upgrade=cancelled`,
      metadata: { userId, upgradeTo: "pro" },
    });
    res.json({ url: session.url });
  });

  // Stripe webhook also handles customer.subscription.created → set plan=pro
  // (already handled in the webhook route above via checkout.session.completed)

  // Mount protected router
  app.use("/api", api);

  // ---------------------------------------------------------------------------
  // Static / Vite middleware
  // ---------------------------------------------------------------------------

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅  FinTrust server running → http://localhost:${PORT}`);
  });

  await seedDevData();
}

startServer();
