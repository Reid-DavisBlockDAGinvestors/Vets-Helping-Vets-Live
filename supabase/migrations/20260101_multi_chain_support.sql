-- Multi-Chain Support for PatriotPledge
-- Adds chain_id tracking to submissions and purchases
-- Allows campaigns on different networks (BlockDAG, Ethereum, Polygon, Base)

-- ============================================
-- 1. Add chain_id to submissions table
-- ============================================
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 1043;  -- Default: BlockDAG

-- Add chain_name for easy display (denormalized for performance)
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS chain_name VARCHAR(50) DEFAULT 'BlockDAG';

-- Index for filtering by chain
CREATE INDEX IF NOT EXISTS idx_submissions_chain_id ON submissions(chain_id);

-- Backfill existing submissions to BlockDAG
UPDATE submissions 
SET chain_id = 1043, chain_name = 'BlockDAG'
WHERE chain_id IS NULL;

-- ============================================
-- 2. Add chain_id to purchases table
-- ============================================
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 1043;

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS chain_name VARCHAR(50) DEFAULT 'BlockDAG';

CREATE INDEX IF NOT EXISTS idx_purchases_chain_id ON purchases(chain_id);

-- Backfill existing purchases
UPDATE purchases 
SET chain_id = 1043, chain_name = 'BlockDAG'
WHERE chain_id IS NULL;

-- ============================================
-- 3. Add chain_id to events table
-- ============================================
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 1043;

UPDATE events 
SET chain_id = 1043
WHERE chain_id IS NULL;

-- ============================================
-- 4. Contracts table - Create if not exists, then expand version column
-- ============================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id SERIAL PRIMARY KEY,
  version VARCHAR(20) NOT NULL UNIQUE,
  address VARCHAR(42) NOT NULL,
  name VARCHAR(100) NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 1043,
  deployed_at TIMESTAMP WITH TIME ZONE,
  deployed_block BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_mintable BOOLEAN NOT NULL DEFAULT true,
  features JSONB DEFAULT '{}',
  abi_hash VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Expand version column if it's too small (fixes VARCHAR(10) from previous migration)
ALTER TABLE public.contracts ALTER COLUMN version TYPE VARCHAR(20);

-- Drop unique constraint on address if it exists (allows same address on different chains)
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_address_key;

-- Insert existing contracts (BlockDAG) - skip if already exist
INSERT INTO public.contracts (version, address, name, chain_id, is_active, is_mintable, features)
VALUES 
  ('v5', '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890', 'PatriotPledgeNFTV5', 1043, false, true,
   '{"batch_mint": false, "royalties": false}'::jsonb),
  ('v6', '0xaE54e4E8A75a81780361570c17b8660CEaD27053', 'PatriotPledgeNFTV6', 1043, true, true,
   '{"batch_mint": true, "royalties": true}'::jsonb)
ON CONFLICT (version) DO NOTHING;

-- Insert V7 placeholders for Ethereum networks
INSERT INTO public.contracts (version, address, name, chain_id, is_active, is_mintable, features)
VALUES 
  ('v7-sepolia', '0x0000000000000000000000000000000000000000', 'PatriotPledgeNFTV7 (Sepolia)', 11155111, true, true,
   '{"batch_mint": true, "immediate_payout": true}'::jsonb),
  ('v7-ethereum', '0x0000000000000000000000000000000000000000', 'PatriotPledgeNFTV7 (Ethereum)', 1, false, false,
   '{"batch_mint": true, "immediate_payout": true}'::jsonb)
ON CONFLICT (version) DO NOTHING;

-- ============================================
-- 5. Chain configuration reference table
-- ============================================
CREATE TABLE IF NOT EXISTS public.chain_configs (
  chain_id INTEGER PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  short_name VARCHAR(10) NOT NULL,
  explorer_url VARCHAR(255) NOT NULL,
  rpc_url VARCHAR(255),
  native_currency VARCHAR(10) NOT NULL,
  is_testnet BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert chain configurations
INSERT INTO public.chain_configs (chain_id, name, short_name, explorer_url, native_currency, is_testnet, is_active)
VALUES 
  (1043, 'BlockDAG', 'BDAG', 'https://awakening.bdagscan.com', 'BDAG', false, true),
  (1, 'Ethereum', 'ETH', 'https://etherscan.io', 'ETH', false, false),
  (11155111, 'Sepolia', 'SEP', 'https://sepolia.etherscan.io', 'ETH', true, true),
  (137, 'Polygon', 'MATIC', 'https://polygonscan.com', 'MATIC', false, false),
  (8453, 'Base', 'BASE', 'https://basescan.org', 'ETH', false, false)
ON CONFLICT (chain_id) DO UPDATE SET
  name = EXCLUDED.name,
  explorer_url = EXCLUDED.explorer_url,
  is_active = EXCLUDED.is_active;

-- ============================================
-- 6. Helper view for admin with chain info
-- ============================================
CREATE OR REPLACE VIEW public.submissions_with_chain AS
SELECT 
  s.*,
  c.name as contract_name,
  c.features as contract_features,
  cc.explorer_url,
  cc.native_currency,
  cc.is_testnet
FROM submissions s
LEFT JOIN contracts c ON s.contract_version = c.version
LEFT JOIN chain_configs cc ON s.chain_id = cc.chain_id;

-- ============================================
-- 7. Function to get explorer URL for tx
-- ============================================
CREATE OR REPLACE FUNCTION get_explorer_tx_url(p_chain_id INTEGER, p_tx_hash VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_explorer_url VARCHAR;
BEGIN
  SELECT explorer_url INTO v_explorer_url 
  FROM chain_configs WHERE chain_id = p_chain_id;
  
  IF v_explorer_url IS NULL THEN
    v_explorer_url := 'https://awakening.bdagscan.com'; -- Default to BlockDAG
  END IF;
  
  RETURN v_explorer_url || '/tx/' || p_tx_hash;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. Donor Notes Feature - Personal messages with NFT purchases
-- ============================================
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS donor_note TEXT;

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS donor_name VARCHAR(100);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS notify_submitter BOOLEAN DEFAULT true;

-- Comments
COMMENT ON COLUMN submissions.chain_id IS 'Blockchain network ID (1043=BlockDAG, 1=Ethereum, 11155111=Sepolia, 137=Polygon, 8453=Base)';
COMMENT ON COLUMN submissions.chain_name IS 'Human-readable network name for display';
COMMENT ON TABLE chain_configs IS 'Configuration for supported blockchain networks';
COMMENT ON COLUMN purchases.donor_note IS 'Optional personal note from donor to campaign submitter';
COMMENT ON COLUMN purchases.donor_name IS 'Display name donor wants to share (can be anonymous)';
COMMENT ON COLUMN purchases.notify_submitter IS 'Whether to send email notification to submitter for this purchase';
