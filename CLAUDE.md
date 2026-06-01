# FinTrust — Claude Code Instructions

## Project Overview

**FinTrust** is a full-stack invoice & payment management platform targeting Thailand and ASEAN markets.
It supports PromptPay QR, USDT TRC-20, and card payments with a real-time operator dashboard.

- **Live URL:** https://fin-trst.vercel.app
- **Repo:** https://github.com/st3rs/FinTrust
- **Stack:** React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui + Express + Supabase

---

## Architecture

```
FinTrust/
├── src/                        # React frontend (Vite SPA)
│   ├── components/             # Reusable UI components (shadcn + custom)
│   ├── lib/                    # Frontend utilities (promptpay generator, formatters)
│   └── App.tsx                 # Router root
├── lib/
│   └── supabase.ts             # Supabase clients (admin + per-user)
├── middleware/
│   └── auth.ts                 # JWT auth middleware (requireAuth)
├── server.ts                   # Express backend (API + SSE + Vite middleware)
├── supabase-setup.sql          # Full DB schema with RLS + indexes
└── CLAUDE.md                   # This file
```

### Data Flow

```
Frontend (React) → Supabase Auth (login/signup)
                 → Express API (/api/*) with JWT in Authorization header
                      → requireAuth middleware verifies token via supabaseAdmin
                      → Supabase DB queries scoped to user_id
                      → SSE /api/logs/stream for real-time activity feed
```

---

## Database Schema (Supabase / PostgreSQL)

All tables have `user_id uuid NOT NULL references auth.users(id)` and full RLS policies.

| Table | Key Columns | Notes |
|---|---|---|
| `invoices` | id, client, amount, date, due_date, status, metadata jsonb, user_id | status: PAID/UNPAID/DRAFT/VOID/OVERDUE |
| `customers` | id, name, email, contact_person, phone, status, total_billed, user_id | status: Active/Inactive |
| `payment_links` | id, title, amount, reference, is_active, clicks, user_id | |
| `transactions` | id, invoice_id→invoices, client, amount, currency, status, payment_method, user_id | status: Success/Pending/Failed/Cancelled |
| `webhook_logs` | id, url, event_type, payload jsonb, response_status, user_id | |
| `qr_payments` | id, promptpay_id, amount, reference, status, user_id | status: Paid/Pending/Active/Expired/Cancelled |

**Indexes:** `(user_id, status)`, `(user_id, created_at desc)`, `(invoice_id)` on relevant tables.

---

## API Routes

All routes under `/api/*` (except `/api/health`, `/api/logs`, `/api/logs/stream`) require:
```
Authorization: Bearer <supabase_access_token>
```

### Invoices
- `GET    /api/invoices` — list user's invoices
- `GET    /api/invoices/:id` — single invoice (by id or invoiceNumber)
- `POST   /api/invoices` — create invoice
- `PATCH  /api/invoices/:id` — update invoice
- `DELETE /api/invoices/:id` — delete invoice

### Payments
- `POST /api/payments/:id/process` — mark invoice PAID, create transaction record
  - Body: `{ gateway: "PromptPay" | "USDT" | "Card" | "Unknown" }`
  - Guards: ownership check, duplicate payment check (409 if already PAID)

### Transactions
- `GET /api/transactions` — list user's transactions

### Customers
- `GET  /api/customers` — list
- `POST /api/customers` — create

### Payment Links
- `GET  /api/payment-links` — list
- `POST /api/payment-links` — create

### QR Payments
- `GET  /api/qr-payments` — list
- `POST /api/qr-payments` — create

### Webhooks
- `POST /api/webhooks/retry/:eventId` — trigger retry (with 1.5s simulated delay)

### Logs / SSE
- `GET /api/logs` — recent activity (last 100, in-memory ring buffer)
- `GET /api/logs/stream` — SSE stream (heartbeat every 25s)

---

## Environment Variables

Required in `.env` (see `.env.example`):

```env
VITE_SUPABASE_URL=          # Supabase project URL
VITE_SUPABASE_ANON_KEY=     # Public anon key (used by frontend)
SUPABASE_SERVICE_ROLE_KEY=  # Secret service role key (server only, never expose)
APP_URL=                    # Public app URL
GEMINI_API_KEY=             # Optional — for AI features
SEED_DB=false               # Set true to auto-seed on first boot (dev only)
```

**Critical:** `SUPABASE_SERVICE_ROLE_KEY` is server-side only. Never reference it in any `src/` frontend file or expose it via Vite.

---

## Key Implementation Rules

### Authentication
- Always use `requireAuth` middleware on new protected routes
- `req.userId` and `req.accessToken` are injected by `requireAuth`
- Use `supabaseAdmin` for server queries (with `.eq("user_id", userId)` filter)
- Never trust `req.body.user_id` — always use `req.userId` from the verified JWT

### IDs
- Always use `randomUUID()` from Node's built-in `crypto` module for new record IDs
- Never use sequential or length-based IDs

### Supabase Queries
- All queries MUST filter by `user_id` even when using `supabaseAdmin` (defence in depth)
- Pattern for mutations:
  ```typescript
  const { data, error } = await supabaseAdmin
    .from("table")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)   // always include this
    .select()
    .single();
  ```

### SSE / Logging
- `addLog()` is the only way to emit to the SSE stream — call it for all meaningful events
- SSE clients are managed via `sseClients: Set<express.Response>` — never use arrays
- The in-memory `recentLogs` ring buffer is ephemeral by design (activity feed, not audit log)

### RLS Policies
- All INSERT policies use `with check (auth.uid() = user_id)` — NO `or user_id is null`
- Adding a new table: follow the pattern in `supabase-setup.sql`, all 4 policies required

---

## Development Commands

```bash
npm run dev       # Start dev server (tsx server.ts + Vite middleware)
npm run build     # Build frontend + bundle server to dist/server.cjs
npm start         # Run production build
npm run lint      # TypeScript type check
```

### First-time setup
```bash
cp .env.example .env       # Fill in Supabase credentials
# Run supabase-setup.sql in Supabase Dashboard → SQL Editor
npm install
npm run dev
```

### Seed dev data
```bash
SEED_DB=true npm run dev   # Inserts sample invoices on first boot
```

---

## Frontend Notes

- Auth state managed via Supabase client in `src/`
- All API calls from frontend must include `Authorization: Bearer ${session.access_token}`
- PromptPay QR generated client-side using `promptpay-qr` package
- PDF generation uses `jspdf` + `jspdf-autotable`
- Charts use `recharts`
- Animations use `motion` (Framer Motion v12)

---

## Deployment (Vercel)

- Frontend: Vite build → static assets
- Backend: `server.ts` bundled via esbuild → `dist/server.cjs`
- `vercel.json` routes all requests through the Express server
- Set all env vars in Vercel Dashboard → Project Settings → Environment Variables
- `SUPABASE_SERVICE_ROLE_KEY` must be set as a **server-side only** env var (not prefixed with `VITE_`)

---

## Common Patterns

### Add a new API resource

1. Add table + RLS policies to `supabase-setup.sql`
2. Add routes to `server.ts` under the `api` router (which already has `requireAuth`)
3. Use `randomUUID()` for IDs, always filter by `user_id`
4. Call `addLog()` for significant events

### Add a new frontend page

1. Create component in `src/components/`
2. Add route in `src/App.tsx`
3. Fetch from `/api/*` with auth header from Supabase session

---

## Known Limitations / TODO

- [x] Webhook retry delivers real HTTP POST with exponential backoff (3 attempts: 0s, 2s, 4s), 10s timeout per attempt, persists response_status to DB
- [x] `total_billed` on customers is auto-updated via `syncCustomerTotalBilled()` after every confirmed payment
- [x] Pagination on all list endpoints (`?limit=&offset=`); `usePagination` hook + `PaginationControls` component; Invoices/Transactions/Clients wired up
- [x] Rate limiting added: public routes 30/min, auth routes 20/15min, API routes 120/min
- [ ] QR payment status polling not implemented — needs SCB/KBank callback webhook
