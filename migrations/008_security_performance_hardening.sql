-- Security and performance hardening after 007_payment_hardening.sql.
-- Keeps existing RLS semantics while avoiding per-row auth.uid() re-evaluation.

-- Pin trigger function search_path to remove mutable-search-path risk.
alter function public.set_updated_at()
  set search_path = pg_catalog, public;

-- Add covering indexes for foreign keys reported by Supabase Performance Advisor.
create index if not exists idx_generated_documents_template_id
  on public.generated_documents(template_id);

create index if not exists idx_payment_events_invoice_id
  on public.payment_events(invoice_id);

create index if not exists idx_payment_events_user_id
  on public.payment_events(user_id);

-- Optimize RLS policies: evaluate auth.uid() once per statement via init plan.
alter policy agent_llm_requests_select on public.agent_llm_requests
  using ((select auth.uid()) = user_id);

alter policy agent_tasks_insert on public.agent_tasks
  with check ((select auth.uid()) = user_id);

alter policy agent_tasks_select on public.agent_tasks
  using ((select auth.uid()) = user_id);

alter policy api_keys_delete on public.api_keys
  using ((select auth.uid()) = account_id);

alter policy api_keys_insert on public.api_keys
  with check ((select auth.uid()) = account_id);

alter policy api_keys_select on public.api_keys
  using ((select auth.uid()) = account_id);

alter policy api_keys_update on public.api_keys
  using ((select auth.uid()) = account_id);

alter policy customers_select on public.customers
  using ((select auth.uid()) = user_id);

alter policy generated_documents_delete on public.generated_documents
  using ((select auth.uid()) = account_id);

alter policy generated_documents_insert on public.generated_documents
  with check ((select auth.uid()) = account_id);

alter policy generated_documents_select on public.generated_documents
  using ((select auth.uid()) = account_id);

alter policy generated_documents_update on public.generated_documents
  using ((select auth.uid()) = account_id);

alter policy invoices_select on public.invoices
  using ((select auth.uid()) = user_id);

alter policy payment_events_select on public.payment_events
  using ((select auth.uid()) = user_id);

alter policy payment_links_select on public.payment_links
  using ((select auth.uid()) = user_id);

alter policy projects_delete on public.projects
  using ((select auth.uid()) = account_id);

alter policy projects_insert on public.projects
  with check ((select auth.uid()) = account_id);

alter policy projects_select on public.projects
  using ((select auth.uid()) = account_id);

alter policy projects_update on public.projects
  using ((select auth.uid()) = account_id);

alter policy qr_payments_select on public.qr_payments
  using ((select auth.uid()) = user_id);

alter policy templates_delete on public.templates
  using ((select auth.uid()) = account_id);

alter policy templates_insert on public.templates
  with check ((select auth.uid()) = account_id);

alter policy templates_select on public.templates
  using ((select auth.uid()) = account_id);

alter policy templates_update on public.templates
  using ((select auth.uid()) = account_id);

alter policy transactions_select on public.transactions
  using ((select auth.uid()) = user_id);

alter policy webhook_logs_delete on public.webhook_logs
  using ((select auth.uid()) = user_id);

alter policy webhook_logs_insert on public.webhook_logs
  with check ((select auth.uid()) = user_id);

alter policy webhook_logs_select on public.webhook_logs
  using ((select auth.uid()) = user_id);

alter policy webhook_logs_update on public.webhook_logs
  using ((select auth.uid()) = user_id);

-- gateway_configs intentionally remains RLS-enabled with no client policy.
-- That keeps it deny-all for anon/authenticated clients and service-role only.