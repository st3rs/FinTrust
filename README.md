<div align="center">

  <img src="https://img.shields.io/badge/FinTrust-Payment%20Platform-6366f1?style=for-the-badge&labelColor=0a0a0b" alt="FinTrust" />

  <h1>FinTrust</h1>
  <p><strong>Full-stack invoice & payment infrastructure for Thailand and ASEAN markets.</strong><br/>
  PromptPay QR · USDT TRC-20 · Card Payments · Real-time Operator Dashboard</p>

  <p>
    <a href="https://fin-trst.vercel.app"><img src="https://img.shields.io/badge/Live-fin--trst.vercel.app-6366f1?style=flat-square&logo=vercel&logoColor=white" /></a>
    <img src="https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB" />
    <img src="https://img.shields.io/badge/TypeScript-5.8-007ACC?style=flat-square&logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/Supabase-RLS-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
    <img src="https://img.shields.io/badge/Tailwind-v4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" />
    <img src="https://img.shields.io/badge/Vite-6-B73BFE?style=flat-square&logo=vite&logoColor=FFD62E" />
  </p>

</div>

---

## Overview

FinTrust is a production-grade invoicing and payment platform built for operators in Thailand and ASEAN. It natively supports **PromptPay QR**, **USDT TRC-20**, and **card payments** with a real-time activity dashboard powered by Server-Sent Events.

Every record is scoped to the authenticated user via Supabase Row-Level Security — no data leaks between tenants by design.

---

## Features

| | Feature |
|---|---|
| 📊 | Real-time dashboard with Recharts visualisations |
| 🧾 | Full invoice lifecycle — DRAFT → UNPAID → PAID → VOID/OVERDUE |
| 📱 | Instant PromptPay QR generation (client-side, no external API) |
| 💳 | Multi-gateway payment processing — PromptPay, USDT, Card |
| 👥 | Customer management with lifetime value tracking |
| 🔗 | Shareable payment links |
| 📡 | SSE-powered live activity feed |
| 🔐 | JWT auth + Row-Level Security on all 6 tables |
| 🌐 | Thai / English / Chinese i18n |
| 🌓 | Dark / Light mode |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, TypeScript 5.8, Tailwind CSS v4, shadcn/ui |
| Backend | Express 4, tsx, SSE |
| Database | Supabase (PostgreSQL + RLS + Auth) |
| Payments | PromptPay QR (promptpay-qr), USDT TRC-20 |
| PDF | jsPDF + jsPDF-AutoTable |
| Charts | Recharts |
| Animations | Framer Motion v12 |
| Deploy | Vercel (frontend + serverless Express) |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/st3rs/FinTrust.git
cd FinTrust

# 2. Install
npm install

# 3. Configure environment
cp .env.example .env
# → Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 4. Apply database schema
# Paste supabase-setup.sql into Supabase Dashboard → SQL Editor → Run

# 5. Start dev server
npm run dev
```

> **Seed sample data** (dev only): set `SEED_DB=true` in `.env` then restart.

---

## Project Structure

```
FinTrust/
├── src/                        # React frontend (Vite SPA)
│   ├── components/             # Reusable UI (shadcn + custom)
│   ├── lib/                    # Frontend utilities, auth context
│   └── App.tsx                 # Router root
├── lib/
│   └── supabase.ts             # Supabase admin + per-user clients
├── middleware/
│   └── auth.ts                 # requireAuth JWT middleware
├── server.ts                   # Express API + SSE stream
├── supabase-setup.sql          # Full schema, RLS policies, indexes
├── .env.example                # Required environment variables
└── CLAUDE.md                   # AI coding instructions
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key (Vite / frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** service role key — never expose via Vite |
| `APP_URL` | Public URL (used in payment links) |
| `SEED_DB` | Set `true` to seed sample invoices on first boot (dev only) |

---

## Deployment

```bash
npm run build   # Vite frontend + esbuild server → dist/
npm start       # node dist/server.cjs
```

Deployed on Vercel — `vercel.json` routes all traffic through the Express server. Set `SUPABASE_SERVICE_ROLE_KEY` as a **server-side-only** env var in Vercel Dashboard (no `VITE_` prefix).

---

## Security Notes

- All API routes (except `/api/health` and `/api/logs/*`) require a valid Supabase JWT
- Every DB query is scoped by `user_id` even when using the admin client (defence in depth)
- All INSERT RLS policies use `with check (auth.uid() = user_id)` — no null bypass
- `SUPABASE_SERVICE_ROLE_KEY` is never referenced in any `src/` file

---

## Roadmap

- [ ] Real webhook delivery queue (currently simulated)
- [ ] `total_billed` auto-update via Supabase trigger
- [ ] Pagination on list endpoints (`?limit=&offset=`)
- [ ] `express-rate-limit` before public launch
- [ ] SCB / KBank callback webhook for QR payment status polling

---

<div align="center">
  <sub>Powered by <strong>TRST I Fin</strong></sub>
</div>
