-- ============================================================
-- Migration 002: docgen spine
-- Tables: templates, generated_documents, api_keys
-- Add AFTER running 001_gateway_configs.sql
-- ============================================================

-- ── templates ────────────────────────────────────────────────
-- Stores per-account HTML templates. The built-in "invoice-default"
-- is served from the filesystem and does NOT live in this table.

create table if not exists templates (
  id          text        primary key default uuid_generate_v4()::text,
  account_id  uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  engine      text        not null default 'mustache'
                check (engine in ('mustache')),
  body        text        not null,
  created_at  timestamptz not null default now()
);

alter table templates enable row level security;

drop policy if exists "templates_select" on templates;
drop policy if exists "templates_insert" on templates;
drop policy if exists "templates_update" on templates;
drop policy if exists "templates_delete" on templates;

create policy "templates_select" on templates
  for select using (auth.uid() = account_id);
create policy "templates_insert" on templates
  for insert with check (auth.uid() = account_id);
create policy "templates_update" on templates
  for update using (auth.uid() = account_id);
create policy "templates_delete" on templates
  for delete using (auth.uid() = account_id);

create index if not exists idx_templates_account
  on templates(account_id);

-- ── generated_documents ──────────────────────────────────────
-- Audit log of every PDF ever generated. PDFs are stored once
-- and served via signed URL — never regenerated.

create table if not exists generated_documents (
  id            text        primary key default uuid_generate_v4()::text,
  account_id    uuid        not null references auth.users(id) on delete cascade,
  template_id   text        references templates(id) on delete set null,
  invoice_id    text        references invoices(id) on delete set null,
  storage_path  text        not null,
  sha256        text        not null,
  byte_size     integer     not null check (byte_size > 0),
  created_at    timestamptz not null default now()
);

alter table generated_documents enable row level security;

drop policy if exists "generated_documents_select" on generated_documents;
drop policy if exists "generated_documents_insert" on generated_documents;
drop policy if exists "generated_documents_update" on generated_documents;
drop policy if exists "generated_documents_delete" on generated_documents;

create policy "generated_documents_select" on generated_documents
  for select using (auth.uid() = account_id);
create policy "generated_documents_insert" on generated_documents
  for insert with check (auth.uid() = account_id);
create policy "generated_documents_update" on generated_documents
  for update using (auth.uid() = account_id);
create policy "generated_documents_delete" on generated_documents
  for delete using (auth.uid() = account_id);

create index if not exists idx_generated_documents_account
  on generated_documents(account_id);
create index if not exists idx_generated_documents_invoice
  on generated_documents(invoice_id);

-- ── api_keys ─────────────────────────────────────────────────
-- Per-account API keys for docgen service.
-- Plaintext key is shown ONCE at creation; only the HMAC hash is stored.
-- prefix = first 8 chars after "ft_" — used as a lookup hint.

create table if not exists api_keys (
  id            text        primary key default uuid_generate_v4()::text,
  account_id    uuid        not null references auth.users(id) on delete cascade,
  name          text        not null,
  key_hash      text        not null unique,
  prefix        text        not null,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

alter table api_keys enable row level security;

drop policy if exists "api_keys_select" on api_keys;
drop policy if exists "api_keys_insert" on api_keys;
drop policy if exists "api_keys_update" on api_keys;
drop policy if exists "api_keys_delete" on api_keys;

create policy "api_keys_select" on api_keys
  for select using (auth.uid() = account_id);
create policy "api_keys_insert" on api_keys
  for insert with check (auth.uid() = account_id);
create policy "api_keys_update" on api_keys
  for update using (auth.uid() = account_id);
create policy "api_keys_delete" on api_keys
  for delete using (auth.uid() = account_id);

create index if not exists idx_api_keys_account
  on api_keys(account_id);
create index if not exists idx_api_keys_hash
  on api_keys(key_hash);
