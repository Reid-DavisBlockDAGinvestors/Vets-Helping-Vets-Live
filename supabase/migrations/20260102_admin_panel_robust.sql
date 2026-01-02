-- ============================================
-- COMPLETE Admin Panel Setup Migration (ROBUST VERSION)
-- Run this in Supabase SQL Editor
-- Created: January 2, 2026
-- 
-- This version checks for table existence before modifying
-- ============================================

-- ============================================
-- PART 1: Add columns to submissions table
-- ============================================

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 1043;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS chain_name VARCHAR(50) DEFAULT 'BlockDAG';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_testnet BOOLEAN DEFAULT true;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS contract_version VARCHAR(20) DEFAULT 'v6';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS immediate_payout_enabled BOOLEAN DEFAULT false;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS total_distributed DECIMAL(36,18) DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS pending_distribution DECIMAL(36,18) DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS tips_distributed DECIMAL(36,18) DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS last_distribution_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS video_url TEXT;

CREATE INDEX IF NOT EXISTS idx_submissions_chain_id ON submissions(chain_id);

UPDATE submissions 
SET chain_id = 1043, chain_name = 'BlockDAG', is_testnet = true
WHERE chain_id IS NULL;

-- ============================================
-- PART 2: Add columns to purchases table
-- ============================================

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 1043;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS chain_name VARCHAR(50) DEFAULT 'BlockDAG';

CREATE INDEX IF NOT EXISTS idx_purchases_chain_id ON purchases(chain_id);

UPDATE purchases 
SET chain_id = 1043, chain_name = 'BlockDAG'
WHERE chain_id IS NULL;

-- ============================================
-- PART 3: Chain Configs Table
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

-- Insert chain configs one by one (no ON CONFLICT needed since chain_id is PRIMARY KEY)
INSERT INTO chain_configs (chain_id, name, short_name, explorer_url, native_currency, is_testnet, is_active)
SELECT 1043, 'BlockDAG', 'BDAG', 'https://awakening.bdagscan.com', 'BDAG', true, true
WHERE NOT EXISTS (SELECT 1 FROM chain_configs WHERE chain_id = 1043);

INSERT INTO chain_configs (chain_id, name, short_name, explorer_url, native_currency, is_testnet, is_active)
SELECT 1, 'Ethereum', 'ETH', 'https://etherscan.io', 'ETH', false, false
WHERE NOT EXISTS (SELECT 1 FROM chain_configs WHERE chain_id = 1);

INSERT INTO chain_configs (chain_id, name, short_name, explorer_url, native_currency, is_testnet, is_active)
SELECT 11155111, 'Sepolia', 'SEP', 'https://sepolia.etherscan.io', 'ETH', true, true
WHERE NOT EXISTS (SELECT 1 FROM chain_configs WHERE chain_id = 11155111);

INSERT INTO chain_configs (chain_id, name, short_name, explorer_url, native_currency, is_testnet, is_active)
SELECT 137, 'Polygon', 'MATIC', 'https://polygonscan.com', 'MATIC', false, false
WHERE NOT EXISTS (SELECT 1 FROM chain_configs WHERE chain_id = 137);

INSERT INTO chain_configs (chain_id, name, short_name, explorer_url, native_currency, is_testnet, is_active)
SELECT 8453, 'Base', 'BASE', 'https://basescan.org', 'ETH', false, false
WHERE NOT EXISTS (SELECT 1 FROM chain_configs WHERE chain_id = 8453);

-- ============================================
-- PART 4: Contracts Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.contracts (
  id SERIAL PRIMARY KEY,
  version VARCHAR(20) NOT NULL,
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

-- Insert contracts one by one
INSERT INTO contracts (version, address, name, chain_id, is_active, is_mintable, features)
SELECT 'v5', '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890', 'PatriotPledgeNFTV5', 1043, false, true, '{"batch_mint": false}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM contracts WHERE version = 'v5' AND chain_id = 1043);

INSERT INTO contracts (version, address, name, chain_id, is_active, is_mintable, features)
SELECT 'v6', '0xaE54e4E8A75a81780361570c17b8660CEaD27053', 'PatriotPledgeNFTV6', 1043, true, true, '{"batch_mint": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM contracts WHERE version = 'v6' AND chain_id = 1043);

INSERT INTO contracts (version, address, name, chain_id, is_active, is_mintable, features)
SELECT 'v7', '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e', 'PatriotPledgeNFTV7 (Sepolia)', 11155111, true, true, '{"immediate_payout": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM contracts WHERE version = 'v7' AND chain_id = 11155111);

-- ============================================
-- PART 5: Distributions Table
-- ============================================

DROP VIEW IF EXISTS campaign_fund_status;

CREATE TABLE IF NOT EXISTS public.distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL DEFAULT 1043,
  tx_hash VARCHAR(66),
  distribution_type VARCHAR(20) NOT NULL DEFAULT 'funds',
  total_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
  submitter_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
  nonprofit_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
  platform_fee DECIMAL(36,18) NOT NULL DEFAULT 0,
  total_amount_usd DECIMAL(18,2),
  submitter_amount_usd DECIMAL(18,2),
  nonprofit_amount_usd DECIMAL(18,2),
  platform_fee_usd DECIMAL(18,2),
  tip_split_submitter_pct INTEGER DEFAULT 100,
  tip_split_nonprofit_pct INTEGER DEFAULT 0,
  submitter_wallet VARCHAR(42),
  nonprofit_wallet VARCHAR(42),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  initiated_by UUID,
  initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  notes TEXT,
  native_currency VARCHAR(10) NOT NULL DEFAULT 'BDAG',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distributions_campaign ON distributions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_distributions_status ON distributions(status);

-- ============================================
-- PART 6: Tip Split Configs Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.tip_split_configs (
  id SERIAL PRIMARY KEY,
  campaign_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  submitter_percent INTEGER NOT NULL DEFAULT 100,
  nonprofit_percent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_tip_split_campaign ON tip_split_configs(campaign_id);

-- ============================================
-- PART 7: Security Tables
-- ============================================

CREATE TABLE IF NOT EXISTS public.blacklisted_addresses (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 1043,
  reason TEXT,
  blacklisted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blacklisted_address ON blacklisted_addresses(address);

CREATE TABLE IF NOT EXISTS public.frozen_tokens (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 1043,
  contract_address VARCHAR(42),
  reason TEXT,
  frozen_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frozen_token ON frozen_tokens(token_id);

-- ============================================
-- PART 8: Campaign Fund Status View
-- ============================================

CREATE OR REPLACE VIEW campaign_fund_status AS
SELECT 
  s.id,
  s.title,
  s.status,
  s.campaign_id,
  COALESCE(s.chain_id, 1043) as chain_id,
  COALESCE(s.chain_name, 'BlockDAG') as chain_name,
  COALESCE(s.is_testnet, true) as is_testnet,
  s.creator_wallet,
  COALESCE(s.contract_version, 'v6') as contract_version,
  COALESCE(s.immediate_payout_enabled, false) as immediate_payout_enabled,
  COALESCE(tsc.submitter_percent, 100) as tip_split_submitter_pct,
  COALESCE(tsc.nonprofit_percent, 0) as tip_split_nonprofit_pct,
  COALESCE(SUM(p.amount_usd), 0) as gross_raised_usd,
  COALESCE(SUM(COALESCE(p.amount_bdag, 0)), 0) as gross_raised_native,
  COALESCE(SUM(COALESCE(p.tip_usd, 0)), 0) as tips_received_usd,
  COALESCE(SUM(COALESCE(p.tip_bdag, 0)), 0) as tips_received_native,
  COALESCE(s.total_distributed, 0) as total_distributed,
  COALESCE(s.tips_distributed, 0) as tips_distributed,
  s.last_distribution_at,
  CASE 
    WHEN s.chain_id = 1043 THEN 'BDAG'
    WHEN s.chain_id IN (1, 11155111) THEN 'ETH'
    ELSE 'BDAG'
  END as native_currency,
  (SELECT COUNT(*) FROM distributions d WHERE d.campaign_id = s.id) as distribution_count,
  (SELECT COUNT(*) FROM purchases pp WHERE pp.campaign_id = s.campaign_id) as purchase_count
FROM submissions s
LEFT JOIN purchases p ON s.campaign_id = p.campaign_id
LEFT JOIN tip_split_configs tsc ON s.id = tsc.campaign_id
WHERE s.status = 'minted' AND s.campaign_id IS NOT NULL
GROUP BY 
  s.id, s.title, s.status, s.campaign_id, s.chain_id, s.chain_name, s.is_testnet,
  s.creator_wallet, s.contract_version, s.immediate_payout_enabled,
  s.total_distributed, s.tips_distributed, s.last_distribution_at,
  tsc.submitter_percent, tsc.nonprofit_percent;

-- ============================================
-- PART 9: Enable RLS (ignore errors if already enabled)
-- ============================================

ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tip_split_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklisted_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE frozen_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chain_configs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 10: Create RLS Policies
-- ============================================

DROP POLICY IF EXISTS admin_distributions_all ON distributions;
DROP POLICY IF EXISTS admin_tip_split_all ON tip_split_configs;
DROP POLICY IF EXISTS admin_blacklist_all ON blacklisted_addresses;
DROP POLICY IF EXISTS admin_frozen_all ON frozen_tokens;
DROP POLICY IF EXISTS public_contracts_read ON contracts;
DROP POLICY IF EXISTS admin_contracts_write ON contracts;
DROP POLICY IF EXISTS public_chain_configs_read ON chain_configs;
DROP POLICY IF EXISTS admin_chain_configs_write ON chain_configs;

CREATE POLICY admin_distributions_all ON distributions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')));

CREATE POLICY admin_tip_split_all ON tip_split_configs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')));

CREATE POLICY admin_blacklist_all ON blacklisted_addresses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')));

CREATE POLICY admin_frozen_all ON frozen_tokens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')));

CREATE POLICY public_contracts_read ON contracts FOR SELECT TO authenticated USING (true);

CREATE POLICY admin_contracts_write ON contracts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')));

CREATE POLICY public_chain_configs_read ON chain_configs FOR SELECT TO authenticated USING (true);

CREATE POLICY admin_chain_configs_write ON chain_configs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')));

-- ============================================
-- DONE!
-- ============================================

SELECT 'Migration completed successfully!' as result;
