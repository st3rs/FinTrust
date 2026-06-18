import { supabase } from "./supabase.js";

// Signed-URL lifetime (seconds). Configurable via DOCGEN_SIGNED_URL_TTL so ops
// can lengthen it for links emailed to clients without a code change. Defaults
// to 1 hour; clamped to a sane [60s, 7d] range. NOTE: callers must always
// re-mint a URL via GET /v1/documents/:id on demand — never cache or forward a
// previously issued signedUrl. A longer TTL is a convenience, not a license to
// store the URL.
const DEFAULT_SIGNED_URL_TTL = 3600; // 1 hour
const MIN_TTL = 60; // 1 minute
const MAX_TTL = 7 * 24 * 3600; // 7 days

function resolveTtl(): number {
  const raw = process.env["DOCGEN_SIGNED_URL_TTL"];
  if (!raw) return DEFAULT_SIGNED_URL_TTL;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_SIGNED_URL_TTL;
  return Math.min(MAX_TTL, Math.max(MIN_TTL, Math.floor(parsed)));
}

const SIGNED_URL_TTL = resolveTtl();

export async function uploadPdf(
  storagePath: string,
  buffer: Buffer
): Promise<void> {
  const bucket = process.env["SUPABASE_STORAGE_BUCKET"];
  if (!bucket) throw new Error("Missing SUPABASE_STORAGE_BUCKET");

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function getSignedUrl(storagePath: string): Promise<{
  signedUrl: string;
  expiresAt: string;
}> {
  const bucket = process.env["SUPABASE_STORAGE_BUCKET"];
  if (!bucket) throw new Error("Missing SUPABASE_STORAGE_BUCKET");

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);

  if (error || !data) {
    throw new Error(`Failed to create signed URL: ${error?.message ?? "unknown"}`);
  }

  return {
    signedUrl: data.signedUrl,
    expiresAt: new Date(Date.now() + SIGNED_URL_TTL * 1000).toISOString(),
  };
}
