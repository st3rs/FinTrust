-- ============================================================
-- Migration 003: projects
-- Tables: projects
-- Column: api_keys.project_id (nullable FK, additive only)
-- Run AFTER 002_docgen.sql
-- ============================================================

-- ── shared trigger function (idempotent, safe to re-run) ─────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── projects ─────────────────────────────────────────────────
-- Each account can own multiple projects (e.g. "Production", "Staging").
-- API keys are scoped to a project. Users must create at least one
-- project before generating API keys (Stripe-style gate).

create table if not exists projects (
  id           text        primary key default uuid_generate_v4()::text,
  account_id   uuid        not null references auth.users(id) on delete cascade,
  name         text        not null check (char_length(name) between 1 and 64),
  description  text,
  environment  text        not null default 'live'
                 check (environment in ('live', 'test')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

alter table projects enable row level security;

drop policy if exists "projects_select" on projects;
drop policy if exists "projects_insert" on projects;
drop policy if exists "projects_update" on projects;
drop policy if exists "projects_delete" on projects;

create policy "projects_select" on projects
  for select using (auth.uid() = account_id);
create policy "projects_insert" on projects
  for insert with check (auth.uid() = account_id);
create policy "projects_update" on projects
  for update using (auth.uid() = account_id);
create policy "projects_delete" on projects
  for delete using (auth.uid() = account_id);

create index if not exists idx_projects_account
  on projects(account_id, created_at desc);

-- ── api_keys.project_id ───────────────────────────────────────
-- Additive: existing keys remain valid (project_id nullable).
-- New keys created via the UI will always have a project_id.

alter table api_keys
  add column if not exists project_id text references projects(id) on delete cascade;

create index if not exists idx_api_keys_project
  on api_keys(project_id);
