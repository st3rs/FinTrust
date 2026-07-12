-- ============================================================
-- 005_payment_links_live.sql
-- Make payment links functional end-to-end:
--   * columns the Create Link form already sends (description,
--     currency, methods) — inserts were failing without them
--   * link each transaction to the payment link that produced it
-- Run AFTER 004_crypto_wallets.sql. Additive only — no rewrites.
-- ============================================================

alter table payment_links
  add column if not exists description text,
  add column if not exists currency text not null default 'USD',
  add column if not exists methods jsonb not null default '{"stripe":true}'::jsonb;

alter table transactions
  add column if not exists payment_link_id text references payment_links(id) on delete set null;

create index if not exists idx_transactions_payment_link_id
  on transactions(payment_link_id);
