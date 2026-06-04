import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase.js";

export interface AuthenticatedRequest extends Request {
  userId: string;
  userEmail: string;
  accessToken: string;
}

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Attaches userId, userEmail, and accessToken to the request object.
 *
 * Usage: app.use('/api', requireAuth);
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // Attach to request for downstream handlers
    (req as AuthenticatedRequest).userId = user.id;
    (req as AuthenticatedRequest).userEmail = user.email ?? "";
    (req as AuthenticatedRequest).accessToken = token;

    next();
  } catch (err) {
    console.error("[requireAuth] Unexpected error:", err);
    res.status(500).json({ error: "Authentication service error" });
  }
}

/**
 * requireAdmin: verifies JWT (same as requireAuth) then checks the caller's
 * email against the ADMIN_EMAILS env var (comma-separated list).
 * Returns 401 for missing/invalid token, 403 for non-admin users.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    (req as AuthenticatedRequest).userId = user.id;
    (req as AuthenticatedRequest).userEmail = user.email ?? "";
    (req as AuthenticatedRequest).accessToken = token;

    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    if (!adminEmails.includes(user.email ?? "")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  } catch (err) {
    console.error("[requireAdmin] Unexpected error:", err);
    res.status(500).json({ error: "Authentication service error" });
  }
}
