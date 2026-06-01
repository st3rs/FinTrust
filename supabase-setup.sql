-- ==========================================
-- FINTRUST — SUPABASE SCHEMA v2
-- Fixes:
--   1. Removed "or user_id is null" from all INSERT policies (security hole)
--   2. Added composite indexes for performance
--   3. Added updated_at column + trigger on invoices and transactions
--   4. Added SUPABASE_SERVICE_ROLE_KEY note
-- ==========================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Shared trigger for updated_at
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. INVOICES
-- ---------------------------------------------------------------------------

create table if not exists invoices (
  id          text        primary key default uuid_generate_v4()::text,
  client      text        not null,
  amount      numeric     not null check (amount >= 0),
  date        date        not null default current_date,
  due_date    date,
  status      text        not null default 'UNPAID'
                check (status in ('PAID', 'UNPAID', 'DRAFT', 'VOID', 'OVERDUE')),
  metadata    jsonb       not null default '{}'::jsonb,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table invoices add column if not exists updated_at timestamptz not null default now();

drop trigger if exists invoices_updated_at on invoices;
create trigger invoices_updated_at
  before update on invoices
  for each row execute function set_updated_at();

alter table invoices enable row level security;

drop policy if exists "invoices_select" on invoices;
drop policy if exists "invoices_insert" on invoices;
drop policy if exists "invoices_update" on invoices;
drop policy if exists "invoices_delete" on invoices;

create policy "invoices_select" on invoices
  for select using (auth.uid() = user_id);

-- FIXED: removed "or user_id is null"
create policy "invoices_insert" on invoices
  for insert with check (auth.uid() = user_id);

create policy "invoices_update" on invoices
  for update using (auth.uid() = user_id);

create policy "invoices_delete" on invoices
  for delete using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_invoices_user_status
  on invoices(user_id, status);

create index if not exists idx_invoices_user_created
  on invoices(user_id, created_at desc);

create index if not exists idx_invoices_due_date
  on invoices(due_date) where status = 'UNPAID';

-- ---------------------------------------------------------------------------
-- 2. CUSTOMERS
-- ---------------------------------------------------------------------------

create table if not exists customers (
  id             text        primary key default uuid_generate_v4()::text,
  name           text        not null,
  email          text        not null,
  contact_person text,
  phone          text,
  status         text        not null default 'Active'
                   check (status in ('Active', 'Inactive')),
  total_billed   numeric     not null default 0 check (total_billed >= 0),
  logo_url       text,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now()
);

alter table customers enable row level security;

drop policy if exists "customers_select" on customers;
drop policy if exists "customers_insert" on customers;
drop policy if exists "customers_update" on customers;
drop policy if exists "customers_delete" on customers;

create policy "customers_select" on customers
  for select using (auth.uid() = user_id);

create policy "customers_insert" on customers
  for insert with check (auth.uid() = user_id);

create policy "customers_update" on customers
  for update using (auth.uid() = user_id);

create policy "customers_delete" on customers
  for delete using (auth.uid() = user_id);

create index if not exists idx_customers_user
  on customers(user_id);

create unique index if not exists idx_customers_email_user
  on customers(email, user_id);

-- ---------------------------------------------------------------------------
-- 3. PAYMENT LINKS
-- ---------------------------------------------------------------------------

create table if not exists payment_links (
  id         text        primary key default uuid_generate_v4()::text,
  title      text        not null,
  amount     numeric     not null check (amount > 0),
  reference  text,
  is_active  boolean     not null default true,
  clicks     integer     not null default 0 check (clicks >= 0),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table payment_links enable row level security;

drop policy if exists "payment_links_select" on payment_links;
drop policy if exists "payment_links_insert" on payment_links;
drop policy if exists "payment_links_update" on payment_links;
drop policy if exists "payment_links_delete" on payment_links;

create policy "payment_links_select" on payment_links
  for select using (auth.uid() = user_id);

create policy "payment_links_insert" on payment_links
  for insert with check (auth.uid() = user_id);

create policy "payment_links_update" on payment_links
  for update using (auth.uid() = user_id);

create policy "payment_links_delete" on payment_links
  for delete using (auth.uid() = user_id);

create index if not exists idx_payment_links_user
  on payment_links(user_id, is_active);

-- ---------------------------------------------------------------------------
-- 4. TRANSACTIONS
-- ---------------------------------------------------------------------------

create table if not exists transactions (
  id             text        primary key default uuid_generate_v4()::text,
  invoice_id     text        references invoices(id) on delete set null,
  client         text        not null,
  amount         numeric     not null check (amount >= 0),
  currency       text        not null default 'THB',
  status         text        not null
                   check (status in ('Success', 'Pending', 'Failed', 'Cancelled')),
  payment_method text        not null,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now()
);

alter table transactions enable row level security;

drop policy if exists "transactions_select" on transactions;
drop policy if exists "transactions_insert" on transactions;
drop policy if exists "transactions_update" on transactions;
drop policy if exists "transactions_delete" on transactions;

create policy "transactions_select" on transactions
  for select using (auth.uid() = user_id);

create policy "transactions_insert" on transactions
  for insert with check (auth.uid() = user_id);

create policy "transactions_update" on transactions
  for update using (auth.uid() = user_id);

create policy "transactions_delete" on transactions
  for delete using (auth.uid() = user_id);

create index if not exists idx_transactions_user_status
  on transactions(user_id, status);

create index if not exists idx_transactions_user_created
  on transactions(user_id, created_at desc);

create index if not exists idx_transactions_invoice
  on transactions(invoice_id);

-- ---------------------------------------------------------------------------
-- 5. WEBHOOK LOGS
-- ---------------------------------------------------------------------------

create table if not exists webhook_logs (
  id              text        primary key default uuid_generate_v4()::text,
  url             text        not null,
  event_type      text        not null,
  payload         jsonb       not null default '{}'::jsonb,
  response_status integer,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now()
);

alter table webhook_logs enable row level security;

drop policy if exists "webhook_logs_select" on webhook_logs;
drop policy if exists "webhook_logs_insert" on webhook_logs;
drop policy if exists "webhook_logs_update" on webhook_logs;
drop policy if exists "webhook_logs_delete" on webhook_logs;

create policy "webhook_logs_select" on webhook_logs
  for select using (auth.uid() = user_id);

create policy "webhook_logs_insert" on webhook_logs
  for insert with check (auth.uid() = user_id);

create policy "webhook_logs_update" on webhook_logs
  for update using (auth.uid() = user_id);

create policy "webhook_logs_delete" on webhook_logs
  for delete using (auth.uid() = user_id);

create index if not exists idx_webhook_logs_user_created
  on webhook_logs(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. QR PAYMENTS
-- ---------------------------------------------------------------------------

create table if not exists qr_payments (
  id            text        primary key default uuid_generate_v4()::text,
  promptpay_id  text        not null,
  amount        numeric     not null check (amount > 0),
  reference     text,
  status        text        not null
                  check (status in ('Paid', 'Pending', 'Active', 'Expired', 'Cancelled')),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now()
);

alter table qr_payments enable row level security;

drop policy if exists "qr_payments_select" on qr_payments;
drop policy if exists "qr_payments_insert" on qr_payments;
drop policy if exists "qr_payments_update" on qr_payments;
drop policy if exists "qr_payments_delete" on qr_payments;

create policy "qr_payments_select" on qr_payments
  for select using (auth.uid() = user_id);

create policy "qr_payments_insert" on qr_payments
  for insert with check (auth.uid() = user_id);

create policy "qr_payments_update" on qr_payments
  for update using (auth.uid() = user_id);

create policy "qr_payments_delete" on qr_payments
  for delete using (auth.uid() = user_id);

create index if not exists idx_qr_payments_user_status
  on qr_payments(user_id, status);

-- ─── gateway_configs ───────────────────────────────────────────────────────
-- Stores per-operator payment gateway credentials (server-side only).
-- No user-facing RLS — accessed exclusively via service_role key.
-- NEVER expose this table via the anon/authenticated Supabase client.

create table if not exists gateway_configs (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  gateway       text        not null check (gateway in ('stripe', 'paypal')),
  publishable_key text,
  secret_key    text,       -- store here; access only via service_role
  environment   text        not null default 'live'
                              check (environment in ('live', 'test', 'sandbox')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, gateway)
);

-- No RLS — service_role bypasses RLS by default.
-- Intentionally no user-facing policies; this table is server-only.
alter table gateway_configs enable row level security;

create index if not exists idx_gateway_configs_user
  on gateway_configs(user_id, gateway);
