-- Multi-contract support for PatriotPledge NFT platform
-- Allows tracking which contract version each submission/purchase uses
-- Designed for scalability: V5, V6, V7, etc.

-- ============================================
-- 1. Contracts Registry Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id SERIAL PRIMARY KEY,
  version VARCHAR(10) NOT NULL UNIQUE,           -- 'v5', 'v6', 'v7', etc.
  address VARCHAR(42) NOT NULL UNIQUE,           -- 0x... contract address
  name VARCHAR(100) NOT NULL,                    -- 'PatriotPledgeNFTV5'
  chain_id INTEGER NOT NULL DEFAULT 1043,        -- BlockDAG = 1043
  deployed_at TIMESTAMP WITH TIME ZONE,
  deployed_block BIGINT,
  is_active BOOLEAN NOT NULL DEFAULT true,       -- Can create new campaigns
  is_mintable BOOLEAN NOT NULL DEFAULT true,     -- Can mint from existing campaigns
  features JSONB DEFAULT '{}',                   -- Feature flags for this version
  abi_hash VARCHAR(64),                          -- Hash of ABI for cache invalidation
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert existing contracts
INSERT INTO public.contracts (version, address, name, deployed_at, is_active, is_mintable, features)
VALUES 
  ('v5', '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890', 'PatriotPledgeNFTV5', '2024-11-28', false, true, 
   '{"batch_mint": false, "royalties": false, "pausable": false, "burnable": false, "setTokenURI": false}'::jsonb),
  ('v6', '0xaE54e4E8A75a81780361570c17b8660CEaD27053', 'PatriotPledgeNFTV6', '2024-12-19', true, true,
   '{"batch_mint": true, "royalties": true, "pausable": true, "burnable": true, "setTokenURI": true, "freezable": true, "blacklist": true, "soulbound": true}'::jsonb)
ON CONFLICT (version) DO UPDATE SET
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active,
  features = EXCLUDED.features,
  updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_contracts_active ON public.contracts(is_active);
CREATE INDEX IF NOT EXISTS idx_contracts_version ON public.contracts(version);

-- ============================================
-- 2. Add contract_version to submissions
-- ============================================
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS contract_version VARCHAR(10) DEFAULT 'v5',
ADD COLUMN IF NOT EXISTS contract_address VARCHAR(42);

-- Backfill existing submissions to V5
UPDATE submissions 
SET contract_version = 'v5', 
    contract_address = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
WHERE contract_version IS NULL OR contract_address IS NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_contract_version ON submissions(contract_version);

-- ============================================
-- 3. Add contract_version to purchases
-- ============================================
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS contract_version VARCHAR(10),
ADD COLUMN IF NOT EXISTS contract_address VARCHAR(42);

-- Backfill existing purchases to V5
UPDATE purchases 
SET contract_version = 'v5', 
    contract_address = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
WHERE contract_version IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_contract_version ON purchases(contract_version);

-- ============================================
-- 4. Add contract_version to events table
-- ============================================
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS contract_version VARCHAR(10),
ADD COLUMN IF NOT EXISTS contract_address VARCHAR(42);

-- Backfill existing events to V5
UPDATE events 
SET contract_version = 'v5', 
    contract_address = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
WHERE contract_version IS NULL;

-- ============================================
-- 5. Helper view for admin dashboard
-- ============================================
CREATE OR REPLACE VIEW public.submissions_with_contract AS
SELECT 
  s.*,
  c.name as contract_name,
  c.features as contract_features,
  c.is_active as contract_is_active,
  c.is_mintable as contract_is_mintable
FROM submissions s
LEFT JOIN contracts c ON s.contract_version = c.version;

-- ============================================
-- 6. Function to get current active contract
-- ============================================
CREATE OR REPLACE FUNCTION get_active_contract_version()
RETURNS VARCHAR(10) AS $$
BEGIN
  RETURN (
    SELECT version FROM public.contracts 
    WHERE is_active = true 
    ORDER BY id DESC 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Function to get contract by version
-- ============================================
CREATE OR REPLACE FUNCTION get_contract_address(p_version VARCHAR(10))
RETURNS VARCHAR(42) AS $$
BEGIN
  RETURN (
    SELECT address FROM public.contracts 
    WHERE version = p_version
  );
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE public.contracts IS 'Registry of all deployed NFT contract versions';
COMMENT ON COLUMN public.contracts.is_active IS 'Can create new campaigns on this contract';
COMMENT ON COLUMN public.contracts.is_mintable IS 'Can still mint from existing campaigns';
COMMENT ON COLUMN public.contracts.features IS 'JSON object of feature flags for this version';
COMMENT ON COLUMN submissions.contract_version IS 'Which contract version this submission uses (v5, v6, etc)';
COMMENT ON COLUMN purchases.contract_version IS 'Which contract version this purchase was made on';
