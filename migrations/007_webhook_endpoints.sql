-- ---------------------------------------------------------------------------
-- 007 — Webhook endpoints (merchant-configured event subscriptions)
--
-- webhook_logs (supabase-setup.sql) already stores per-delivery history.
-- This table stores the merchant's configured endpoints: which URL to call,
-- which events it subscribes to, and the per-endpoint signing secret used
-- for the X-FinTrust-Signature HMAC header.
--
-- Run in the Supabase SQL Editor after supabase-setup.sql / earlier migrations.
-- ---------------------------------------------------------------------------

create table if not exists webhook_endpoints (
  id          text        primary key default uuid_generate_v4()::text,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  url         text        not null,
  description text,
  -- Subscribed event types (e.g. {'invoice.paid','payment_link.paid'}).
  -- Empty array = subscribe to all events.
  events      text[]      not null default '{}',
  -- whsec_<hex> — HMAC-SHA256 key for signing delivery payloads.
  secret      text        not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

alter table webhook_endpoints enable row level security;

drop policy if exists "webhook_endpoints_select" on webhook_endpoints;
drop policy if exists "webhook_endpoints_insert" on webhook_endpoints;
drop policy if exists "webhook_endpoints_update" on webhook_endpoints;
drop policy if exists "webhook_endpoints_delete" on webhook_endpoints;

create policy "webhook_endpoints_select" on webhook_endpoints
  for select using (auth.uid() = user_id);

create policy "webhook_endpoints_insert" on webhook_endpoints
  for insert with check (auth.uid() = user_id);

create policy "webhook_endpoints_update" on webhook_endpoints
  for update using (auth.uid() = user_id);

create policy "webhook_endpoints_delete" on webhook_endpoints
  for delete using (auth.uid() = user_id);

create index if not exists idx_webhook_endpoints_user_active
  on webhook_endpoints(user_id, is_active);
