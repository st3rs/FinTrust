-- ==========================================
-- FINTRUST - SUPABASE RLS TENANT SCHEMAS
-- ==========================================

-- Enable extensions
create extension if not exists "uuid-ossp";

-- 1. INVOICES TABLE
create table if not exists invoices (
  id text primary key,
  client text not null,
  amount numeric not null,
  date date not null default current_date,
  due_date date,
  status text not null check (status in ('PAID', 'UNPAID', 'DRAFT', 'VOID', 'OVERDUE')),
  metadata jsonb default '{}'::jsonb,
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

-- Ensure user_id column exists and is linked if table pre-existed
alter table invoices add column if not exists user_id uuid references auth.users(id) default auth.uid();

-- Enable RLS
alter table invoices enable row level security;

-- Drop existing policies if any
drop policy if exists "Users can view their own invoices" on invoices;
drop policy if exists "Users can insert their own invoices" on invoices;
drop policy if exists "Users can update their own invoices" on invoices;
drop policy if exists "Users can delete their own invoices" on invoices;

-- Create Policies
create policy "Users can view their own invoices" on invoices 
  for select using (auth.uid() = user_id);

create policy "Users can insert their own invoices" on invoices 
  for insert with check (auth.uid() = user_id or user_id is null);

create policy "Users can update their own invoices" on invoices 
  for update using (auth.uid() = user_id);

create policy "Users can delete their own invoices" on invoices 
  for delete using (auth.uid() = user_id);


-- 2. CUSTOMERS TABLE
create table if not exists customers (
  id text primary key default uuid_generate_v4()::text,
  name text not null,
  email text not null,
  contact_person text,
  phone text,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  total_billed numeric default 0,
  logo_url text,
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

alter table customers add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table customers enable row level security;

drop policy if exists "Users can view their own customers" on customers;
drop policy if exists "Users can insert their own customers" on customers;
drop policy if exists "Users can update their own customers" on customers;
drop policy if exists "Users can delete their own customers" on customers;

create policy "Users can view their own customers" on customers for select using (auth.uid() = user_id);
create policy "Users can insert their own customers" on customers for insert with check (auth.uid() = user_id or user_id is null);
create policy "Users can update their own customers" on customers for update using (auth.uid() = user_id);
create policy "Users can delete their own customers" on customers for delete using (auth.uid() = user_id);


-- 3. PAYMENT LINKS TABLE
create table if not exists payment_links (
  id text primary key default uuid_generate_v4()::text,
  title text not null,
  amount numeric not null,
  reference text,
  is_active boolean default true,
  clicks integer default 0,
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

alter table payment_links add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table payment_links enable row level security;

drop policy if exists "Users can view their own payment links" on payment_links;
drop policy if exists "Users can insert their own payment links" on payment_links;
drop policy if exists "Users can update their own payment links" on payment_links;
drop policy if exists "Users can delete their own payment links" on payment_links;

create policy "Users can view their own payment links" on payment_links for select using (auth.uid() = user_id);
create policy "Users can insert their own payment links" on payment_links for insert with check (auth.uid() = user_id or user_id is null);
create policy "Users can update their own payment links" on payment_links for update using (auth.uid() = user_id);
create policy "Users can delete their own payment links" on payment_links for delete using (auth.uid() = user_id);


-- 4. TRANSACTIONS TABLE
create table if not exists transactions (
  id text primary key,
  invoice_id text references invoices(id) on delete set null,
  client text not null,
  amount numeric not null,
  currency text not null default 'THB',
  status text not null check (status in ('Success', 'Pending', 'Failed', 'Cancelled')),
  payment_method text not null,
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

alter table transactions add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table transactions enable row level security;

drop policy if exists "Users can view their own transactions" on transactions;
drop policy if exists "Users can insert their own transactions" on transactions;
drop policy if exists "Users can update their own transactions" on transactions;
drop policy if exists "Users can delete their own transactions" on transactions;

create policy "Users can view their own transactions" on transactions for select using (auth.uid() = user_id);
create policy "Users can insert their own transactions" on transactions for insert with check (auth.uid() = user_id or user_id is null);
create policy "Users can update their own transactions" on transactions for update using (auth.uid() = user_id);
create policy "Users can delete their own transactions" on transactions for delete using (auth.uid() = user_id);


-- 5. WEBHOOK LOGS TABLE
create table if not exists webhook_logs (
  id text primary key,
  url text not null,
  event_type text not null,
  payload jsonb default '{}'::jsonb,
  response_status integer,
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

alter table webhook_logs add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table webhook_logs enable row level security;

drop policy if exists "Users can view their own webhook logs" on webhook_logs;
drop policy if exists "Users can insert their own webhook logs" on webhook_logs;
drop policy if exists "Users can update their own webhook logs" on webhook_logs;
drop policy if exists "Users can delete their own webhook logs" on webhook_logs;

create policy "Users can view their own webhook logs" on webhook_logs for select using (auth.uid() = user_id);
create policy "Users can insert their own webhook logs" on webhook_logs for insert with check (auth.uid() = user_id or user_id is null);
create policy "Users can update their own webhook logs" on webhook_logs for update using (auth.uid() = user_id);
create policy "Users can delete their own webhook logs" on webhook_logs for delete using (auth.uid() = user_id);


-- 6. QR PAYMENTS (PROMPT PAY ENGINES) TABLE
create table if not exists qr_payments (
  id text primary key,
  promptpay_id text not null,
  amount numeric not null,
  reference text,
  status text not null check (status in ('Paid', 'Pending', 'Active', 'Expired', 'Cancelled')),
  user_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

alter table qr_payments add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table qr_payments enable row level security;

drop policy if exists "Users can view their own qr payments" on qr_payments;
drop policy if exists "Users can insert their own qr payments" on qr_payments;
drop policy if exists "Users can update their own qr payments" on qr_payments;
drop policy if exists "Users can delete their own qr payments" on qr_payments;

create policy "Users can view their own qr payments" on qr_payments for select using (auth.uid() = user_id);
create policy "Users can insert their own qr payments" on qr_payments for insert with check (auth.uid() = user_id or user_id is null);
create policy "Users can update their own qr payments" on qr_payments for update using (auth.uid() = user_id);
create policy "Users can delete their own qr payments" on qr_payments for delete using (auth.uid() = user_id);
