-- ============================================
-- CONSOLIDATED FIX MIGRATION
-- Fixes all missing tables and columns
-- Run this ONCE in Supabase SQL Editor
-- Generated: Jan 1, 2026
-- ============================================

-- ============================================
-- 1. CONTRACTS TABLE (Missing)
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

-- Insert existing contracts
INSERT INTO public.contracts (version, address, name, chain_id, is_active, is_mintable, features)
VALUES 
  ('v5', '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890', 'PatriotPledgeNFTV5', 1043, false, true,
   '{"batch_mint": false, "royalties": false}'::jsonb),
  ('v6', '0xaE54e4E8A75a81780361570c17b8660CEaD27053', 'PatriotPledgeNFTV6', 1043, true, true,
   '{"batch_mint": true, "royalties": true}'::jsonb),
  ('v7-sepolia', '0x0000000000000000000000000000000000000000', 'PatriotPledgeNFTV7 (Sepolia)', 11155111, true, true,
   '{"batch_mint": true, "immediate_payout": true}'::jsonb),
  ('v7-ethereum', '0x0000000000000000000000000000000000000000', 'PatriotPledgeNFTV7 (Ethereum)', 1, false, false,
   '{"batch_mint": true, "immediate_payout": true}'::jsonb)
ON CONFLICT (version) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_contracts_active ON public.contracts(is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_version ON public.contracts(version);

-- ============================================
-- 2. CHAIN_CONFIGS TABLE (Missing)
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

INSERT INTO public.chain_configs (chain_id, name, short_name, explorer_url, native_currency, is_testnet, is_active)
VALUES 
  (1043, 'BlockDAG', 'BDAG', 'https://awakening.bdagscan.com', 'BDAG', false, true),
  (1, 'Ethereum', 'ETH', 'https://etherscan.io', 'ETH', false, false),
  (11155111, 'Sepolia', 'SEP', 'https://sepolia.etherscan.io', 'ETH', true, true),
  (137, 'Polygon', 'MATIC', 'https://polygonscan.com', 'MATIC', false, false),
  (8453, 'Base', 'BASE', 'https://basescan.org', 'ETH', false, false)
ON CONFLICT (chain_id) DO NOTHING;

-- ============================================
-- 3. SUBMISSIONS - Add missing columns
-- ============================================
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 1043;

ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS chain_name VARCHAR(50) DEFAULT 'BlockDAG';

ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS contract_version VARCHAR(20) DEFAULT 'v5';

-- Backfill existing submissions
UPDATE submissions 
SET chain_id = 1043, 
    chain_name = 'BlockDAG',
    contract_version = COALESCE(contract_version, 'v5'),
    contract_address = COALESCE(contract_address, '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890')
WHERE chain_id IS NULL OR contract_version IS NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_chain_id ON submissions(chain_id);
CREATE INDEX IF NOT EXISTS idx_submissions_contract_version ON submissions(contract_version);

-- ============================================
-- 4. PURCHASES - Add missing columns
-- ============================================
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 1043;

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS chain_name VARCHAR(50) DEFAULT 'BlockDAG';

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS contract_version VARCHAR(20);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS contract_address VARCHAR(42);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS donor_note TEXT;

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS donor_name VARCHAR(100);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS notify_submitter BOOLEAN DEFAULT true;

-- Backfill existing purchases
UPDATE purchases 
SET chain_id = 1043, 
    chain_name = 'BlockDAG',
    contract_version = COALESCE(contract_version, 'v5'),
    contract_address = COALESCE(contract_address, '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890')
WHERE chain_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_chain_id ON purchases(chain_id);
CREATE INDEX IF NOT EXISTS idx_purchases_contract_version ON purchases(contract_version);

-- ============================================
-- 5. EVENTS - Add missing columns
-- ============================================
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 1043;

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS contract_version VARCHAR(20);

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS contract_address VARCHAR(42);

-- Backfill existing events
UPDATE events 
SET chain_id = 1043,
    contract_version = COALESCE(contract_version, 'v5'),
    contract_address = COALESCE(contract_address, '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890')
WHERE chain_id IS NULL;

-- ============================================
-- 6. GOVERNANCE_PROPOSALS TABLE (Missing - optional)
-- ============================================
CREATE TABLE IF NOT EXISTS public.governance_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  proposer_wallet VARCHAR(42),
  proposer_email VARCHAR(255),
  proposal_type VARCHAR(50) DEFAULT 'general',
  status VARCHAR(20) DEFAULT 'pending',
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  voting_deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================
-- 7. EMAIL_TEMPLATES TABLE (Missing - optional)
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  subject VARCHAR(255) NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================
-- 8. Helper functions
-- ============================================
CREATE OR REPLACE FUNCTION get_active_contract_version()
RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN (
    SELECT version FROM public.contracts 
    WHERE is_active = true 
    ORDER BY id DESC 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_contract_address(p_version VARCHAR(20))
RETURNS VARCHAR(42) AS $$
BEGIN
  RETURN (
    SELECT address FROM public.contracts 
    WHERE version = p_version
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_explorer_tx_url(p_chain_id INTEGER, p_tx_hash VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_explorer_url VARCHAR;
BEGIN
  SELECT explorer_url INTO v_explorer_url 
  FROM chain_configs WHERE chain_id = p_chain_id;
  
  IF v_explorer_url IS NULL THEN
    v_explorer_url := 'https://awakening.bdagscan.com';
  END IF;
  
  RETURN v_explorer_url || '/tx/' || p_tx_hash;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. Comments
-- ============================================
COMMENT ON TABLE public.contracts IS 'Registry of deployed NFT contract versions';
COMMENT ON TABLE public.chain_configs IS 'Supported blockchain network configurations';
COMMENT ON COLUMN submissions.chain_id IS 'Blockchain network ID (1043=BlockDAG, 1=Ethereum, 11155111=Sepolia)';
COMMENT ON COLUMN submissions.chain_name IS 'Human-readable network name';
COMMENT ON COLUMN purchases.donor_note IS 'Optional personal message from donor to campaign creator';
COMMENT ON COLUMN purchases.donor_name IS 'Display name donor wants to share (can be anonymous)';

-- ============================================
-- DONE! Run this once in Supabase SQL Editor
-- ============================================
