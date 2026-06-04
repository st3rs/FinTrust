import { z } from "zod";

// ── Render request ────────────────────────────────────────────────────────────

export const RenderOptionsSchema = z.object({
  landscape: z.boolean().default(false),
  paperSize: z.enum(["A4", "Letter"]).default("A4"),
  marginTop: z.string().default("15mm"),
  marginBottom: z.string().default("15mm"),
  marginLeft: z.string().default("15mm"),
  marginRight: z.string().default("15mm"),
  scale: z.number().min(0.1).max(2).default(1),
});

export const RenderRequestSchema = z.object({
  templateId: z.string().min(1),
  data: z.record(z.unknown()),
  format: z.enum(["pdf", "html"]).default("pdf"),
  options: RenderOptionsSchema.optional(),
});

export type RenderRequest = z.infer<typeof RenderRequestSchema>;
export type RenderOptions = z.infer<typeof RenderOptionsSchema>;

// ── Responses ─────────────────────────────────────────────────────────────────

export interface RenderResponse {
  documentId: string;
  signedUrl: string;
  sha256: string;
  byteSize: number;
  expiresAt: string;
}

export interface DocumentMetadata {
  id: string;
  accountId: string;
  templateId: string | null;
  invoiceId: string | null;
  storagePath: string;
  sha256: string;
  byteSize: number;
  createdAt: string;
  signedUrl: string;
  expiresAt: string;
}

// ── Invoice template data ─────────────────────────────────────────────────────
// Typed shape expected by invoice-default.html

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceTemplateData {
  invoice: {
    number: string;
    date: string;
    dueDate: string;
    currency: string;
  };
  seller: {
    name: string;
    address?: string;
    taxId?: string;
    phone?: string;
    email?: string;
  };
  client: {
    name: string;
    address?: string;
    taxId?: string;
    email?: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  whtRate?: number;
  whtAmount?: number;
  total: number;
  promptpayQr?: string;
  notes?: string;
  paymentTerms?: string;
}

// ── Auth extension ────────────────────────────────────────────────────────────

import type { Request } from "express";

export interface AuthenticatedRequest extends Request {
  accountId: string;
}
