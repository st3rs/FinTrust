import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { getSignedUrl } from "../lib/storage.js";
import { requireAccountScope, MissingAccountScopeError } from "../lib/accountScope.js";
import type { AuthenticatedRequest, DocumentMetadata } from "../types.js";

const router = Router();

// GET /v1/documents/:id — returns metadata + a freshly minted signed URL.
router.get("/:id", async (req, res) => {
  // Tenant boundary: refuse any request without a usable account scope.
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
