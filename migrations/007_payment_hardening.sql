-- Payment hardening: opaque public invoice URLs, immutable client-side ledger,
-- and provider event idempotency. Run after 006_agent_tasks.sql.

alter table invoices
  add column if not exists public_token uuid not null default gen_random_uuid();

create unique index if not exists idx_invoices_public_token
  on invoices(public_token);

alter table transactions
  add column if not exists provider text,
  add column if not exists provider_event_id text,
  add column if not exists verification_source text not null default 'provider'
    check (verification_source in ('provider', 'manual')),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table gateway_configs
  add column if not exists webhook_secret text;

alter table qr_payments
  add column if not exists qr_type text not null default 'dynamic'
    check (qr_type in ('static', 'dynamic')),
  add column if not exists expires_at timestamptz;

alter table qr_payments drop constraint if exists qr_payments_amount_check;
alter table qr_payments add constraint qr_payments_amount_check check (amount >= 0);

create unique index if not exists idx_transactions_provider_event
  on transactions(provider, provider_event_id);

create table if not exists payment_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  provider_event_id text not null,
  invoice_id        text references invoices(id) on delete set null,
  user_id           uuid references auth.users(id) on delete set null,
  payload           jsonb not null default '{}'::jsonb,
  processed_at      timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table payment_events enable row level security;

drop policy if exists "payment_events_select" on payment_events;
create policy "payment_events_select" on payment_events
  for select using (auth.uid() = user_id);

create table if not exists agent_llm_requests (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_llm_requests_user_created
  on agent_llm_requests(user_id, created_at desc);

alter table agent_llm_requests enable row level security;

drop policy if exists "agent_llm_requests_select" on agent_llm_requests;
create policy "agent_llm_requests_select" on agent_llm_requests
  for select using (auth.uid() = user_id);

-- Financial mutations must pass through the server service role. Authenticated
-- browser clients retain tenant-scoped reads but cannot forge ledger state.
drop policy if exists "invoices_insert" on invoices;
drop policy if exists "invoices_update" on invoices;
drop policy if exists "invoices_delete" on invoices;
drop policy if exists "transactions_insert" on transactions;
drop policy if exists "transactions_update" on transactions;
drop policy if exists "transactions_delete" on transactions;
drop policy if exists "customers_insert" on customers;
drop policy if exists "customers_update" on customers;
drop policy if exists "customers_delete" on customers;
drop policy if exists "payment_links_insert" on payment_links;
drop policy if exists "payment_links_update" on payment_links;
drop policy if exists "payment_links_delete" on payment_links;
drop policy if exists "qr_payments_insert" on qr_payments;
drop policy if exists "qr_payments_update" on qr_payments;
drop policy if exists "qr_payments_delete" on qr_payments;
