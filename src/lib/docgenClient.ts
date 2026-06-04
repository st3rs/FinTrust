// Typed fetch wrapper for the FinTrust docgen service.
// Base URL comes from VITE_DOCGEN_URL — set this to the VPS address in production.
// In local dev: http://localhost:8080

const BASE_URL = (import.meta.env["VITE_DOCGEN_URL"] as string | undefined) ?? "";

export interface RenderRequest {
  templateId: string;
  data: Record<string, unknown>;
  format?: "pdf" | "html";
  options?: {
    landscape?: boolean;
    paperSize?: "A4" | "Letter";
    marginTop?: string;
    marginBottom?: string;
    marginLeft?: string;
    marginRight?: string;
  };
}

export interface RenderResponse {
  documentId: string;
  signedUrl: string;
  sha256: string;
  byteSize: number;
  expiresAt: string;
}

export interface DocumentMetadata extends RenderResponse {
  accountId: string;
  templateId: string | null;
  invoiceId: string | null;
  storagePath: string;
  createdAt: string;
}

class DocgenError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "DocgenError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  accessToken: string
): Promise<T> {
  if (!BASE_URL) {
    throw new DocgenError(
      "VITE_DOCGEN_URL is not set — cannot reach docgen service",
      0
    );
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" })) as { error?: string };
    throw new DocgenError(body.error ?? `docgen ${res.status}`, res.status);
  }

  return res.json() as Promise<T>;
}

export function renderDocument(
  req: RenderRequest,
  accessToken: string
): Promise<RenderResponse> {
  return request<RenderResponse>(
    "/v1/render",
    { method: "POST", body: JSON.stringify(req) },
    accessToken
  );
}

export function getDocument(
  documentId: string,
  accessToken: string
): Promise<DocumentMetadata> {
  return request<DocumentMetadata>(
    `/v1/documents/${documentId}`,
    { method: "GET" },
    accessToken
  );
}
