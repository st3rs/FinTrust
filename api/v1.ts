/**
 * api/v1.ts — Public Developer API (/v1/*), served from Vercel serverless.
 *
 * Mirrors the docgen service surface so the endpoints documented in ApiDocs
 * work in production without the VPS:
 *   GET  /v1/health
 *   POST /v1/qr/promptpay     — real PromptPay QR (EMVCo payload + PNG data URL)
 *   GET  /v1/documents/:id    — metadata + freshly minted signed URL
 *   POST /v1/render           — proxied to the docgen VPS (DOCGEN_URL);
 *                               503 with guidance when not configured, because
 *                               Gotenberg cannot run on Vercel serverless.
 *
 * Auth matches services/docgen exactly: `ft_` keys hashed with
 * HMAC-SHA256(DOCGEN_API_KEYS_SALT) against api_keys, or a Supabase JWT.
 */

import crypto from "crypto";
import express, { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";

interface ScopedRequest extends Request {
  accountId?: string;
}

// ── Auth: ft_ API key (HMAC) or Supabase JWT ─────────────────────────────────

function hashApiKey(key: string): string {
  const salt = process.env.DOCGEN_API_KEYS_SALT ?? "";
  return crypto.createHmac("sha256", salt).update(key).digest("hex");
}

async function requireV1Auth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }
  const token = header.slice(7);

  if (token.startsWith("ft_")) {
    if (!process.env.DOCGEN_API_KEYS_SALT) {
      res.status(503).json({ error: "API keys are not configured on this deployment (DOCGEN_API_KEYS_SALT missing)" });
      return;
    }
    const { data: apiKey } = await supabaseAdmin
      .from("api_keys")
      .select("id, account_id, revoked_at")
      .eq("key_hash", hashApiKey(token))
      .maybeSingle();

    if (!apiKey) { res.status(401).json({ error: "Invalid API key" }); return; }
    if (apiKey.revoked_at) { res.status(401).json({ error: "API key has been revoked" }); return; }

    void supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id)
      .then(() => { /* fire-and-forget */ });

    (req as ScopedRequest).accountId = apiKey.account_id as string;
    next();
    return;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  (req as ScopedRequest).accountId = user.id;
  next();
}

// ── Router ────────────────────────────────────────────────────────────────────

const v1 = Router();

v1.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "fintrust-api", ts: new Date().toISOString() });
});

// POST /v1/qr/promptpay
const QrRequestSchema = z.object({
  promptpayId: z
    .string()
    .regex(/^\d{10}$|^\d{13}$/, "promptpayId must be 10 digits (phone) or 13 digits (national ID)"),
  amount: z.number().positive().optional(),
  reference: z.string().max(25).optional(),
  width: z.number().int().min(100).max(1000).default(400),
});

v1.post("/qr/promptpay", requireV1Auth, async (req, res) => {
  const parsed = QrRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { promptpayId, amount, width } = parsed.data;

  try {
    const payload = generatePayload(promptpayId, {
      amount: amount && amount > 0 ? amount : undefined,
    });
    const qrDataUrl = await QRCode.toDataURL(payload, {
      width,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
    res.json({
      payload,
      qrDataUrl,
      promptpayId,
      ...(amount !== undefined && { amount }),
      accountId: (req as ScopedRequest).accountId,
    });
  } catch (err) {
    console.error("[v1/qr/promptpay]", err);
    res.status(500).json({ error: "QR generation failed" });
  }
});

// GET /v1/documents/:id — tenant-scoped metadata + fresh signed URL
const SIGNED_URL_TTL = 3600; // 1 hour; re-mint on demand, never cache

v1.get("/documents/:id", requireV1Auth, async (req, res) => {
  const accountId = (req as ScopedRequest).accountId;
  if (!accountId) { res.status(401).json({ error: "Unauthenticated" }); return; }

  const { data, error } = await supabaseAdmin
    .from("generated_documents")
    .select("*")
    .eq("id", req.params.id)
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) { res.status(500).json({ error: "Database error" }); return; }
  if (!data) { res.status(404).json({ error: "Document not found" }); return; }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(data.storage_path as string, SIGNED_URL_TTL);

  if (signErr || !signed) {
    res.status(500).json({ error: "Failed to create signed URL" });
    return;
  }

  res.json({
    id: data.id,
    accountId: data.account_id,
    templateId: data.template_id ?? null,
    invoiceId: data.invoice_id ?? null,
    storagePath: data.storage_path,
    sha256: data.sha256,
    byteSize: data.byte_size,
    createdAt: data.created_at,
    signedUrl: signed.signedUrl,
    expiresAt: new Date(Date.now() + SIGNED_URL_TTL * 1000).toISOString(),
  });
});

// POST /v1/render — proxy to the docgen VPS. Gotenberg cannot run on Vercel
// serverless (hard constraint), so without DOCGEN_URL this returns 503.
v1.post("/render", requireV1Auth, async (req, res) => {
  const docgenUrl = process.env.DOCGEN_URL;
  if (!docgenUrl) {
    res.status(503).json({
      error: "PDF rendering is not available on this deployment",
      detail:
        "POST /v1/render requires the docgen service (Gotenberg) which runs on a separate VPS. " +
        "Set DOCGEN_URL on Vercel to proxy render requests once the VPS is up. " +
        "All other /v1 endpoints work here.",
    });
    return;
  }

  try {
    const upstream = await fetch(`${docgenUrl.replace(/\/$/, "")}/v1/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.authorization ?? "",
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(55_000),
    });
    const body = await upstream.text();
    res.status(upstream.status).type("application/json").send(body);
  } catch (err) {
    console.error("[v1/render proxy]", err);
    res.status(502).json({ error: "docgen service unreachable" });
  }
});

// JSON parsing is applied by the host app before this router is mounted.
export { requireV1Auth };
export default v1;
