# Evaluation: `block/buzz` for FinTrust

Researched 2026-07-30 against `block/buzz@main`. Upstream facts below come from that
repo's `README.md`, `ARCHITECTURE.md`, `AGENTS.md` and `docker-compose.yml`.

## Verdict

**Not now.** Buzz is a serious, well-architected piece of software, and its self-hosted /
own-your-relay stance lines up with the "self-hostable mindset" this project already
committed to. But it solves a *team* problem — many humans and many persistent agents
needing one shared, auditable room — and FinTrust today is a single-maintainer invoicing
product whose agent surface is one OpenAI function-calling loop. Adopting it would roughly
double the operational surface of the VPS to buy collaboration features nobody is currently
waiting on. Revisit under the triggers in [Revisit when](#revisit-when).

## What Buzz is

A self-hosted workspace where humans and AI agents share the same channels. The organising
idea: every message, reaction, code review, workflow step, approval and git event is a
**signed Nostr event** in a single searchable log, instead of being scattered across chat,
a forge, and a CI dashboard. Agents join as members with their own keypairs and their own
audit trail — scoped by identity rather than by bot permissions.

| | |
| --- | --- |
| License | Apache-2.0 (Block, Inc.) |
| Language | Rust (relay + crates); React/Tauri desktop; Flutter mobile |
| Created | 2026-03-06 |
| Activity | ~18.1k stars, ~1.1k open issues, pushed 2026-07-30 |
| Protocol | Nostr NIP-01; NIP-42 (WebSocket auth), NIP-98 (HTTP auth) |
| Data stores | Postgres 17, Redis 7, S3/MinIO, Prometheus |

The Rust workspace splits into `buzz-core` (types, event verification — no I/O),
`buzz-auth`, `buzz-db` (Postgres, events partitioned by month), `buzz-pubsub` (Redis
fan-out, presence, typing), `buzz-search` (Postgres FTS), `buzz-audit` (SHA-256 hash-chain
log), `buzz-workflow` (YAML automation), `buzz-relay` (the Axum server), plus `buzz-acp`,
`buzz-cli` and `buzz-admin` on the agent/ops side.

Upstream marks the relay, channels, desktop app and workflows as working; mobile clients
and approval gates as in progress.

## What it would solve for FinTrust

Honestly: not much that hurts right now.

- **Agent collaboration.** FinTrust's agents (`api/agent.ts`, the PageAgent act-mode work)
  are request-scoped — they run inside one user's session and stop. Buzz's model is
  long-lived agents that sit in a channel and observe. That's a different shape of agent
  than the one this product has.
- **Tamper-evident audit.** `buzz-audit`'s hash chain is genuinely attractive for a
  financial product. But docgen already stores a `sha256` per document in
  `generated_documents` (`migrations/002_docgen.sql`), with RLS by `account_id`. Buzz would
  add chaining and independent verifiability — a real improvement, but a marginal one
  against a large dependency.
- **Unified log across git + chat + CI.** Valuable at team scale. At current scale, GitHub
  already is that log.

## Constraint check

`CLAUDE.md` states: *"Node/TypeScript only. Never introduce .NET, Go, or Python services."*
Buzz is Rust — not named in that list, and more importantly the constraint's evident intent
is *the services we write*, not third-party infrastructure we operate.

The standing precedent is **Gotenberg**: not Node, not written by us, run as a separate
container (`docker-compose.yml`, built from `services/docgen/gotenberg/Dockerfile`). Nobody
considers that a breach.

So, to state it plainly: **running Buzz as infrastructure would not breach the hard
constraint. Writing FinTrust features in Rust would.** If Buzz were ever adopted, all
FinTrust-side code stays TypeScript and talks to the relay over HTTP.

## Operational cost

This is the real objection, not the language.

The VPS currently runs two containers: `gotenberg` and `docgen`. Buzz's compose adds
Postgres 17, Redis 7, MinIO, Prometheus and the relay itself (their dev compose also
includes Keycloak and Adminer), with memory limits totalling roughly 1.6 GB.

Two of those overlap things FinTrust already pays for:

- **A second Postgres.** FinTrust's database is Supabase. Buzz brings its own, self-managed,
  with its own backup and upgrade story.
- **S3 that duplicates Supabase Storage.** Buzz wants MinIO for media; docgen already stores
  PDFs in a private Supabase bucket.

Running two Postgres instances with different operational models, for a product with one
maintainer, is the cost that decides this.

## If we integrated anyway — the realistic path

No Rust needed. Buzz exposes an HTTP bridge that preserves Nostr semantics:

- `POST /events` — submit any signed event
- `POST /query` — Nostr `REQ` filters (NIP-50 `search` routes to Postgres FTS)
- `POST /count` — `COUNT` filters
- `/hooks/{id}` — workflow webhooks, so we react to events instead of polling

Auth is a Schnorr-signed `kind:27235` event (NIP-98), which TypeScript can produce with
`nostr-tools` / `@noble/curves`. Agent identity is a Nostr keypair in `BUZZ_PRIVATE_KEY`.
There is also `buzz-cli` with a documented JSON-in/JSON-out contract and exit codes 0–5
(1 input, 2 network, 3 auth, 4 other, 5 write conflict), if a shell-out is ever preferable.

The one use case worth sketching: **docgen emitting invoice-lifecycle events** — rendered,
downloaded, reminder sent — into a Buzz channel, giving a chained, externally verifiable
trail alongside the `generated_documents` rows. Note that this partly duplicates what those
rows already record, which is exactly why it isn't compelling yet.

## Risks

- **No rate limiter.** `RateLimitConfig` defines four tiers (human, standard/elevated/
  platform agent) but the trait has only a test stub upstream. For an internet-exposed
  self-host that is a live concern, not a theoretical one.
- **Young and busy.** ~1.1k open issues on a repo created four months ago. Fast-moving, and
  breaking changes are likely.
- **A new class of secret.** Nostr private keys per agent identity, alongside
  `DOCGEN_API_KEYS_SALT` — which is already immutable-once-issued and under-documented.
- **Unfinished pieces.** Mobile clients and approval gates are still in progress upstream.

## Revisit when

Any one of these makes the calculus change:

1. **More than one human works on FinTrust**, or agents need to persist between sessions
   and hand work to each other.
2. **Phase 2's e-Tax Invoice / WHT compliance work** creates a hard requirement for a
   tamper-evident audit log that a third party can verify independently — that is Buzz's
   strongest suit and the reason to keep it on the list.
3. **Upstream ships the rate limiter** and the issue count stabilises.

## Note on repo docs

While checking Phase 1.5 status for this evaluation: items 1 and 2 in `CLAUDE.md` are
already done in code — Sarabun is baked into the Gotenberg image and `waitDelay` is gone
(`services/docgen/src/lib/gotenberg.ts:38`), and both docgen routes filter by `account_id`
(`services/docgen/src/routes/render.ts:68`, `services/docgen/src/routes/documents.ts:30`).
`CLAUDE.md` still lists them as the current focus. Separately, `npm run lint` is
`tsc --noEmit || true`, which swallows every type error, and no `typecheck` script exists
despite `CLAUDE.md` documenting one. Both are worth a follow-up commit; neither is changed
here.
