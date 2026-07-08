-- Migration 004: extend gateway_configs to support crypto wallets
-- Adds a new gateway type 'crypto' with a jsonb config column for wallet addresses.
-- Run once in the Supabase SQL Editor against the target project.

-- 1. Drop the old check constraint that only allows 'stripe' | 'paypal'
alter table gateway_configs
  drop constraint if exists gateway_configs_gateway_check;

-- 2. Re-add with crypto included
alter table gateway_configs
  add constraint gateway_configs_gateway_check
  check (gateway in ('stripe', 'paypal', 'crypto'));

-- 3. Add a jsonb config column (null for existing rows, contains wallet addresses for crypto)
alter table gateway_configs
  add column if not exists config jsonb;

-- Example crypto config shape stored in config:
-- {
--   "usdt_trc20": "TXXX...",
--   "usdt_erc20": "0x...",
--   "btc": "bc1...",
--   "eth": "0x...",
--   "bnb_bsc": "0x..."
-- }
