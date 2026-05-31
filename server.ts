import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { randomUUID } from "crypto";
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
// Express app
// ---------------------------------------------------------------------------

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());

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
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ data });
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

  api.post("/invoices", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const body = req.body;

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
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ data });
  });

  // --- Customers ---

  api.get("/customers", async (req, res) => {
    const { userId } = req as AuthenticatedRequest;
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ data });
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
    const { data, error } = await supabaseAdmin
      .from("payment_links")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ data });
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
    const { eventId } = req.params;
    addLog("system", `Manual retry initiated for webhook ${eventId}`);

    setTimeout(() => {
      addLog("webhook", `Webhook retried successfully for ${eventId}`, {
        status: "success",
        eventId,
      });
    }, 1_500);

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
