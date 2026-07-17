-- ============================================================
-- Migration 006: agent task usage tracking
-- Table: agent_tasks — one row per "act mode" (PageAgent) task,
-- used to enforce the free-plan trial quota (Pro = unlimited).
-- Add AFTER running 005_payment_links_live.sql
-- ============================================================

create table if not exists agent_tasks (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  task        text        not null,
  created_at  timestamptz not null default now()
);

alter table agent_tasks enable row level security;

drop policy if exists "agent_tasks_select" on agent_tasks;
drop policy if exists "agent_tasks_insert" on agent_tasks;

create policy "agent_tasks_select" on agent_tasks
  for select using (auth.uid() = user_id);
create policy "agent_tasks_insert" on agent_tasks
  for insert with check (auth.uid() = user_id);

create index if not exists idx_agent_tasks_user_created
  on agent_tasks(user_id, created_at);
