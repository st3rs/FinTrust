import { Router } from "express";
import { createHash, randomUUID } from "crypto";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { RenderRequestSchema } from "../types.js";
import type { AuthenticatedRequest, RenderResponse } from "../types.js";
import { renderTemplate } from "../lib/template.js";
import { htmlToPdf } from "../lib/gotenberg.js";
import { uploadPdf, getSignedUrl } from "../lib/storage.js";
import { supabase } from "../lib/supabase.js";
import { requireAccountScope, MissingAccountScopeError } from "../lib/accountScope.js";

const router = Router();

const TEMPLATES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../templates"
);

// Built-in template IDs served from the filesystem
const BUILTIN_TEMPLATES = new Set(["invoice-default"]);

router.post("/", async (req, res) => {
  // ── Input validation ──────────────────────────────────────────────────────
  const parsed = RenderRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ errors: parsed.error.issues });
    return;
  }

  const { templateId, data, format, options } = parsed.data;

  // Tenant boundary: docgen bypasses RLS, so refuse any request without a
  // usable account scope before touching the database.
  let accountId: string;
  try {
    accountId = requireAccountScope(
      (req as unknown as AuthenticatedRequest).accountId
    );
  } catch (err) {
    if (err instanceof MissingAccountScopeError) {
      res.status(401).json({ error: "Unauthenticated" });
      return;
    }
    throw err;
  }

  // ── Load template body ────────────────────────────────────────────────────
  let templateBody: string;
  let dbTemplateId: string | null = null;

  if (BUILTIN_TEMPLATES.has(templateId)) {
    try {
      templateBody = await readFile(
        join(TEMPLATES_DIR, `${templateId}.html`),
        "utf-8"
      );
    } catch {
      res.status(404).json({ error: `Built-in template '${templateId}' not found` });
      return;
    }
  } else {
    const { data: tpl, error } = await supabase
      .from("templates")
      .select("body")
      .eq("id", templateId)
      .eq("account_id", accountId)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: "Failed to load template" });
      return;
    }
    if (!tpl) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    templateBody = tpl.body as string;
    dbTemplateId = templateId;
  }

  // ── Render HTML ───────────────────────────────────────────────────────────
  const html = renderTemplate(templateBody, data as Record<string, unknown>);

  if (format === "html") {
    res.type("html").send(html);
    return;
  }

  // ── Render PDF via Gotenberg ──────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await htmlToPdf(html, options);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gotenberg error";
    res.status(502).json({ error: message });
    return;
  }

  // ── Compute sha256 and upload ─────────────────────────────────────────────
  const sha256 = createHash("sha256").update(pdfBuffer).digest("hex");
  const documentId = randomUUID();
  const storagePath = `documents/${accountId}/${documentId}.pdf`;

  try {
    await uploadPdf(storagePath, pdfBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage error";
    res.status(502).json({ error: message });
    return;
  }

  // ── Persist audit record ──────────────────────────────────────────────────
  const invoiceId =
    typeof (data as Record<string, unknown>)["invoiceId"] === "string"
      ? ((data as Record<string, unknown>)["invoiceId"] as string)
      : null;

  await supabase.from("generated_documents").insert({
    id: documentId,
    account_id: accountId,
    template_id: dbTemplateId,
    invoice_id: invoiceId,
    storage_path: storagePath,
    sha256,
    byte_size: pdfBuffer.length,
  });

  // ── Return signed URL ─────────────────────────────────────────────────────
  const { signedUrl, expiresAt } = await getSignedUrl(storagePath);

  const response: RenderResponse = {
    documentId,
    signedUrl,
    sha256,
    byteSize: pdfBuffer.length,
    expiresAt,
  };

  res.status(201).json(response);
});

export default router;
