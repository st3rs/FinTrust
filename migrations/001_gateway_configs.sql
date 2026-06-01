-- Run this in: Supabase Dashboard → SQL Editor
-- Project: bramdkjczhznrjbyqbuc (fin-trst)

create table if not exists gateway_configs (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  gateway         text        not null check (gateway in ('stripe', 'paypal')),
  publishable_key text,
  secret_key      text,
  environment     text        not null default 'live'
                                check (environment in ('live', 'test', 'sandbox')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, gateway)
);

alter table gateway_configs enable row level security;

create index if not exists idx_gateway_configs_user
  on gateway_configs(user_id, gateway);
