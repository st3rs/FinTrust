# CLAUDE.md — FinTrust
> Project context for Claude Code. This file is auto-loaded at the start of every
> session. Read it before touching anything. Keep it updated as the project evolves.
## What this repo is
FinTrust (product name: **InvoicePro Dashboard**) is an invoicing and client-management
platform aimed at freelancers and agencies, with first-class support for Thai/SEA
payment rails (PromptPay QR, cards, crypto).
- Live: https://fin-trst.vercel.app
- GitHub: st3rs/FinTrust
## Current stack
| Layer       | Technology                                          |
| ----------- | --------------------------------------------------- |
| Frontend    | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Animations  | Framer Motion                                       |
| Charts      | Recharts                                            |
| Backend     | Express (`server.ts`)                               |
| Database    | Supabase (Postgres) — see `supabase-setup.sql`      |
| Storage     | Supabase Storage                                    |
| Deploy      | Vercel (frontend)                                   |
> Note: the README was generated from a template and may overstate what exists.
> Trust the code, not the README. When in doubt, read the source.
## Architecture direction
FinTrust has an API-first **docgen spine** (built in Phase 1) so invoices become
real, archived, downloadable PDFs. The frontend dashboard calls the docgen service
over HTTPS; the service renders templates via Gotenberg and stores PDFs in Supabase
Storage.
```
Vercel (React/Vite frontend)
        |  REST + API key
        v
FinTrust docgen API (Express/Fastify, services/docgen/, runs on a VPS via Docker)
   |-- Supabase Postgres (invoices, clients, templates, api_keys; RLS by account_id)
   |-- {{variable}} template engine
   |-- render job --> Gotenberg 8 (Docker container)
                          |
                          v
                 Supabase Storage / S3 (PDF + signed URL)
```
## Hard constraints (do not violate)
- **Node/TypeScript only.** Never introduce .NET, Go, or Python services.
- **Gotenberg cannot run on Vercel serverless.** Any PDF rendering service must be a
  separate Docker container deployable on a VPS. The Vercel frontend calls it over HTTPS.
- **Thai font support is mandatory.** PDFs must render Thai correctly — embed/mount
  Sarabun. Never assume Latin-only.
- **TypeScript strict mode. No `any`.** Validate all API inputs with zod.
- **No secrets in the repo.** All config via `.env`; provide `.env.example`.
- **Stored, not regenerated.** Every generated PDF is persisted once and served via a
  signed URL with a sha256 + audit row.
- **Self-hostable mindset.** Prefer Docker Compose, controllable infra. No hard lock-in
  to a managed-only service where avoidable.
## Roadmap
**Phase 1 — docgen spine — DONE**
Built in `services/docgen/`. Template engine (`src/lib/template.ts`, safe
`{{variable}}` with `{{#loop}}` / `{{^inverted}}` / `{{path|currency}}`, dot-notation,
no eval), Gotenberg orchestration (`src/lib/gotenberg.ts`), Supabase Storage with
1-hour signed URLs (`src/lib/storage.ts`), dual auth — `ft_` API keys via HMAC-SHA256
+ Supabase JWT (`src/middleware/auth.ts`), `POST /v1/render`, `GET /v1/documents/:id`,
default Thai invoice template (VAT 7%, WHT, PromptPay QR slot), migration
`002_docgen.sql` (templates, generated_documents, api_keys + RLS), docker-compose
(Gotenberg 8 + docgen), and frontend wiring (`src/lib/docgenClient.ts`, Download
button in `Invoices.tsx`).
**Phase 1.5 — hardening (do before production) — current focus**
Known issues to fix from the Phase 1 review:
1. **Thai font reliability.** `gotenberg.ts` uses `waitDelay: 1s` to wait for Google
   Fonts (Sarabun) to load — fragile and slow. Embed Sarabun (base64/woff2) in the
   template or mount the font into the Gotenberg container, then remove the waitDelay.
   This is the mandatory "Thai font" hard constraint — do not ship without it.
2. **Multi-tenant isolation.** docgen uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses
   RLS entirely. The 4 RLS policies do NOT protect docgen traffic. Every query in
   docgen must filter by `account_id` in code (verify render/documents routes cannot
   read another account's templates or documents). This is a real cross-tenant risk.
3. **Signed URL lifetime.** 1 hour is fine for immediate download but too short for
   links emailed to clients. Frontend must call `GET /v1/documents/:id` to mint a
   fresh URL on demand — never cache or forward the original URL.
4. **API key salt is immutable.** `DOCGEN_API_KEYS_SALT` must match in both root and
   `services/docgen/.env`. Changing it after keys are issued invalidates all existing
   keys. Document this; treat the salt as permanent or plan a key re-issue flow.
**Phase 2 — multi-tenant + monetization**
Per-account API key management UI, RBAC (account / project / member), and OSS/Pro
feature gating:
| Feature                                | Free | Pro |
| -------------------------------------- | ---- | --- |
| Invoices + PromptPay QR + PDF export   | yes  | yes |
| AI chat (ask mode — data Q&A)          | yes  | yes |
| AI agent (act mode — GUI automation)   | 5/mo trial | unlimited |
| Recurring invoices / auto-reminders    | no   | yes |
| Remove "InvoicePro" branding + domain  | no   | yes |
| e-Tax Invoice / WHT (Thailand)         | no   | yes |
| Team members + RBAC                    | no   | yes |
| PDF watermark / password               | no   | yes |
## Commands
> Frontend commands are taken from the README and may drift — always verify against
> the `scripts` block in `package.json` before relying on them. The docgen service
> below was built in Phase 1 and is live in `services/docgen/`.
### Frontend (repo root)
```bash
npm install          # install dependencies
npm run dev          # start Vite dev server (frontend)
npm run build        # production build
npm start            # serve the production build via server.ts
npm run lint         # lint — verify this script exists in package.json
npm run typecheck    # tsc --noEmit — add if missing; run before every commit
```
### docgen service (`services/docgen/`)
```bash
docker compose up -d                 # start Gotenberg + docgen locally
docker compose logs -f docgen        # tail docgen logs
docker compose down                  # stop the stack
# smoke test: render the default Thai invoice template
curl -X POST http://localhost:8080/v1/render \
  -H "Authorization: Bearer $DOCGEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d @services/docgen/examples/invoice-sample.json
# -> expect { documentId, signedUrl, sha256 } pointing to a valid Thai PDF
```
First-run setup (once per environment):
1. Run `migrations/002_docgen.sql` in the Supabase SQL Editor.
2. Create a **private** Storage bucket named `documents` in Supabase Dashboard.
3. `docker compose up -d` at repo root.
4. Smoke-test with the curl in `services/docgen/README.md`.
### Database (Supabase)
```bash
# Apply schema / migrations against the Supabase Postgres instance.
# Existing baseline lives in supabase-setup.sql — never rewrite it; add new
# migration files instead. Confirm the exact workflow (Supabase CLI vs. raw psql)
# by inspecting the repo before running anything.
```
### Deploy
```bash
# Frontend auto-deploys to Vercel on push to main.
# The docgen service deploys separately as a Docker container on a VPS
# (NOT Vercel — Gotenberg cannot run on serverless). Document the VPS deploy
# steps in services/docgen/README.md once built.
```
### Environment variables
- Frontend: `VITE_DOCGEN_URL`, plus existing Supabase vars — see `.env.example`.
- docgen (`services/docgen/.env`): `GOTENBERG_URL`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `DOCGEN_API_KEYS_SALT`.
- Never commit real values. Keep `.env.example` in sync whenever a new var is added.
## Working rules for Claude Code
1. On a fresh session, read `README.md`, `server.ts`, `package.json`, `src/`, `lib/`,
   and `supabase-setup.sql` first. Summarize current state vs. README claims, then wait
   for go-ahead before writing code.
2. Work in small, focused commits with clear messages.
3. Do not break existing tables — add new migrations, never rewrite existing schema.
4. After scaffolding any feature, list assumptions made and which env vars must be set
   before first run.
5. Stay within the stated scope. Flag scope creep instead of silently expanding.
