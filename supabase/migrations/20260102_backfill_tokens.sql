-- ============================================
-- TOKENS TABLE BACKFILL
-- Populates tokens cache from existing purchases
-- Run AFTER 20260102_tokens_cache.sql
-- ============================================

-- Ensure tokens table exists first (from previous migration)
CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  chain_id INTEGER NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  contract_version VARCHAR(10) NOT NULL,
  owner_wallet VARCHAR(42) NOT NULL,
  edition_number INTEGER,
  total_editions INTEGER,
  is_frozen BOOLEAN DEFAULT FALSE,
  is_soulbound BOOLEAN DEFAULT FALSE,
  metadata_uri TEXT,
  mint_tx_hash VARCHAR(66),
  minted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_id, chain_id, contract_address)
);

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_tokens_chain_id ON tokens(chain_id);
CREATE INDEX IF NOT EXISTS idx_tokens_campaign_id ON tokens(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tokens_owner_wallet ON tokens(owner_wallet);

-- ============================================
-- BACKFILL FROM PURCHASES
-- Uses correct column names:
--   purchases.wallet_address (NOT buyer_wallet)
--   purchases.token_id
--   purchases.campaign_id
--   purchases.tx_hash
--   purchases.chain_id
--   purchases.contract_address
--   purchases.contract_version
--   submissions.image_uri
-- ============================================

INSERT INTO tokens (
  token_id,
  campaign_id,
  chain_id,
  contract_address,
  contract_version,
  owner_wallet,
  edition_number,
  is_frozen,
  is_soulbound,
  metadata_uri,
  mint_tx_hash,
  minted_at
)
SELECT DISTINCT ON (p.token_id, COALESCE(p.chain_id, s.chain_id, 1043), COALESCE(p.contract_address, s.contract_address, ''))
  p.token_id,
  p.campaign_id,
  COALESCE(p.chain_id, s.chain_id, 1043) as chain_id,
  COALESCE(p.contract_address, s.contract_address, '') as contract_address,
  COALESCE(p.contract_version, s.contract_version, 'v5') as contract_version,
  LOWER(p.wallet_address) as owner_wallet,
  p.token_id as edition_number,
  false as is_frozen,
  false as is_soulbound,
  s.image_uri as metadata_uri,
  p.tx_hash as mint_tx_hash,
  p.created_at as minted_at
FROM purchases p
LEFT JOIN submissions s ON p.campaign_id = s.campaign_id
WHERE p.token_id IS NOT NULL 
  AND p.token_id > 0
  AND p.wallet_address IS NOT NULL
ON CONFLICT (token_id, chain_id, contract_address) DO NOTHING;

-- Report results
DO $$
DECLARE
  token_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO token_count FROM tokens;
  RAISE NOTICE 'Backfill complete. Total tokens in cache: %', token_count;
END $$;
