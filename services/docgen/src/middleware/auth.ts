import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabase.js";
import type { AuthenticatedRequest } from "../types.js";

function hashApiKey(key: string): string {
  const salt = process.env["DOCGEN_API_KEYS_SALT"] ?? "";
  return crypto.createHmac("sha256", salt).update(key).digest("hex");
}

// Accepts either:
//   ft_xxx...  → validates against api_keys table (HMAC hash)
//   <jwt>      → validates as Supabase JWT (for frontend callers)
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const token = header.slice(7);

  // ── API key path ──────────────────────────────────────────────────────────
  if (token.startsWith("ft_")) {
    const hash = hashApiKey(token);

    const { data: apiKey } = await supabase
      .from("api_keys")
      .select("id, account_id, revoked_at")
      .eq("key_hash", hash)
      .maybeSingle();

    if (!apiKey) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    if (apiKey.revoked_at) {
      res.status(401).json({ error: "API key has been revoked" });
      return;
    }

    // Fire-and-forget — don't block the request on this
    supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKey.id)
      .then(() => {/* intentional no-op */});

    (req as AuthenticatedRequest).accountId = apiKey.account_id as string;
    next();
    return;
  }

  // ── Supabase JWT path ─────────────────────────────────────────────────────
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  (req as AuthenticatedRequest).accountId = user.id;
  next();
}
