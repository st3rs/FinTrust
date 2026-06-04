import { supabase } from "./supabase.js";

const SIGNED_URL_TTL = 3600; // 1 hour in seconds

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
