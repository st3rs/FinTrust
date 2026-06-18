import { Router } from "express";
import type { Request, Response } from "express";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";
import { z } from "zod";
import type { AuthenticatedRequest } from "../types.js";

const router = Router();

const QrRequestSchema = z.object({
  promptpayId: z
    .string()
    .regex(/^\d{10}$|^\d{13}$/, "promptpayId must be 10 digits (phone) or 13 digits (national ID)"),
  amount: z.number().positive().optional(),
  reference: z.string().max(25).optional(),
  width: z.number().int().min(100).max(1000).default(400),
});

/**
 * POST /v1/qr/promptpay
 *
 * Generate a PromptPay QR code image and return the EMVCo payload string.
 * Authenticated via ft_ API key or Supabase JWT.
 *
 * Body: { promptpayId, amount?, reference?, width? }
 * Response: { payload, qrDataUrl, promptpayId, amount }
 */
router.post("/promptpay", async (req: Request, res: Response): Promise<void> => {
  const parsed = QrRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { promptpayId, amount, width } = parsed.data;
  const accountId = (req as AuthenticatedRequest).accountId;

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
      accountId,
    });
  } catch (err) {
    console.error("[qr/promptpay] generation failed:", err);
    res.status(500).json({ error: "QR generation failed" });
  }
});

export default router;
