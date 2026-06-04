import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { getSignedUrl } from "../lib/storage.js";
import type { AuthenticatedRequest, DocumentMetadata } from "../types.js";

const router = Router();

// GET /v1/documents/:id — returns metadata + fresh signed URL (1h expiry)
router.get("/:id", async (req, res) => {
  const { accountId } = req as unknown as AuthenticatedRequest;
  const { id } = req.params;

  const { data, error } = await supabase
    .from("generated_documents")
    .select("*")
    .eq("id", id)
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: "Database error" });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const { signedUrl, expiresAt } = await getSignedUrl(data.storage_path as string);

  const response: DocumentMetadata = {
    id: data.id as string,
    accountId: data.account_id as string,
    templateId: (data.template_id as string | null) ?? null,
    invoiceId: (data.invoice_id as string | null) ?? null,
    storagePath: data.storage_path as string,
    sha256: data.sha256 as string,
    byteSize: data.byte_size as number,
    createdAt: data.created_at as string,
    signedUrl,
    expiresAt,
  };

  res.json(response);
});

export default router;
