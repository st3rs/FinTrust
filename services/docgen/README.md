# FinTrust docgen service

Express service that turns invoice data → Thai PDF via Gotenberg 8 + Supabase Storage.

> This service **cannot run on Vercel serverless**. Deploy as a Docker container on a VPS.
> The Vercel frontend calls it over HTTPS.

## Architecture

```
Frontend (Vercel)  ──POST /v1/render──▶  docgen service (VPS Docker)
                                               │
                              ┌────────────────┤
                              │                │
                     Gotenberg 8          Supabase Storage
                     (Chromium)           (PDF archive)
                              │
                        PDF buffer ──sha256──▶ generated_documents table
```

## Local dev (full stack)

```bash
# 1. Copy env and fill in real values
cp services/docgen/.env.example services/docgen/.env

# 2. Start Gotenberg + docgen together
docker compose up -d

# 3. Tail logs
docker compose logs -f docgen
```

### Running docgen without Docker (hot-reload)

```bash
cd services/docgen
npm install
cp .env.example .env   # fill in values; point GOTENBERG_URL at a running Gotenberg
npm run dev
```

Requires Gotenberg running separately:
```bash
docker run --rm -p 3001:3000 gotenberg/gotenberg:8
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | no (default 8080) | Port to listen on |
| `GOTENBERG_URL` | **yes** | Internal URL of the Gotenberg container |
| `SUPABASE_URL` | **yes** | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Service role key — server only, never expose |
| `SUPABASE_STORAGE_BUCKET` | **yes** | Storage bucket name for PDFs (`documents`) |
| `DOCGEN_API_KEYS_SALT` | **yes** | HMAC salt for hashing `ft_...` API keys |

## Supabase setup (one-time)

1. Run `migrations/002_docgen.sql` in Supabase Dashboard → SQL Editor.
2. Create a Storage bucket named `documents` (private, no public access).

## API

### Auth

All `/v1/*` routes require:

```
Authorization: Bearer <token>
```

Token can be either:
- A `ft_xxx...` API key (validated against the `api_keys` table)
- A Supabase JWT (the user's session `access_token`)

### POST /v1/render

Render a template to PDF (or HTML for debugging).

**Request body**

```json
{
  "templateId": "invoice-default",
  "data": { ... },
  "format": "pdf",
  "options": {
    "paperSize": "A4",
    "marginTop": "15mm"
  }
}
```

**Response `201`**

```json
{
  "documentId": "abc123",
  "signedUrl": "https://...",
  "sha256": "e3b0c4...",
  "byteSize": 48210,
  "expiresAt": "2026-06-04T13:00:00.000Z"
}
```

**Errors**

| Status | Meaning |
|---|---|
| `401` | Missing / invalid / revoked token |
| `404` | Template not found |
| `422` | Invalid request body (Zod errors in `errors` field) |
| `502` | Gotenberg or Storage upstream error |

### GET /v1/documents/:id

Retrieve metadata + fresh signed URL for a previously generated document.

**Response `200`**

```json
{
  "id": "abc123",
  "accountId": "uuid",
  "templateId": null,
  "invoiceId": "INV-2026-0001",
  "storagePath": "documents/uuid/abc123.pdf",
  "sha256": "e3b0c4...",
  "byteSize": 48210,
  "createdAt": "2026-06-04T12:00:00.000Z",
  "signedUrl": "https://...",
  "expiresAt": "2026-06-04T13:00:00.000Z"
}
```

### GET /health

Unauthenticated health check.

```json
{ "status": "ok", "ts": "2026-06-04T12:00:00.000Z" }
```

## Smoke test

After `docker compose up -d`, verify the stack renders a Thai PDF:

```bash
# Replace TOKEN with a valid Supabase JWT or ft_... API key
TOKEN="your-token-here"

curl -s -X POST http://localhost:8080/v1/render \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "invoice-default",
    "format": "pdf",
    "data": {
      "invoiceId": "test-001",
      "invoice": {
        "number": "INV-2026-0001",
        "date": "2026-06-04",
        "dueDate": "2026-06-30",
        "currency": "THB"
      },
      "seller": {
        "name": "บริษัท ตัวอย่าง จำกัด",
        "address": "123 ถนนสุขุมวิท กรุงเทพฯ 10110",
        "taxId": "0105556123456",
        "phone": "02-123-4567",
        "email": "billing@example.co.th"
      },
      "client": {
        "name": "บริษัท ลูกค้า จำกัด",
        "address": "456 ถนนสีลม กรุงเทพฯ 10500",
        "email": "client@example.com"
      },
      "items": [
        { "description": "พัฒนาเว็บไซต์", "quantity": 1, "unitPrice": 50000, "total": 50000 },
        { "description": "ออกแบบ UI/UX", "quantity": 1, "unitPrice": 20000, "total": 20000 }
      ],
      "subtotal": 70000,
      "vatRate": 7,
      "vatAmount": 4900,
      "hasWht": true,
      "whtRate": 3,
      "whtAmount": 2100,
      "total": 72800,
      "notes": "ขอบคุณสำหรับการใช้บริการ",
      "paymentTerms": "ชำระภายใน 30 วัน / Net 30"
    }
  }' | jq .
```

Expected response: `{ documentId, signedUrl, sha256 }` where `signedUrl` points to a valid A4 PDF with Thai text, Sarabun font, VAT/WHT lines.

## VPS deploy

See root `docker-compose.yml`. After building, point your reverse proxy (nginx/Caddy) at port `8080` and set `VITE_DOCGEN_URL` in Vercel to the public HTTPS URL.
