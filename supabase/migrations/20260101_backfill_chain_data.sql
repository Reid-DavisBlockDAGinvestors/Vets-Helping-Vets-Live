-- Backfill Chain Data Migration
-- Ensures all existing campaigns have proper chain_id, chain_name, contract_version
-- Run this to standardize all campaigns to the new multi-chain format

-- ============================================
-- 1. Ensure columns exist (safe re-run)
-- ============================================
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 1043;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS chain_name VARCHAR(50) DEFAULT 'BlockDAG Testnet';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS contract_version VARCHAR(20) DEFAULT 'v6';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_testnet BOOLEAN DEFAULT true;

-- ============================================
-- 2. Backfill existing campaigns without chain data
-- Default to BlockDAG Testnet V6 for historical campaigns
-- ============================================
UPDATE submissions
SET 
  chain_id = COALESCE(chain_id, 1043),
  chain_name = COALESCE(chain_name, 'BlockDAG Testnet'),
  contract_version = COALESCE(contract_version, 'v6'),
  is_testnet = COALESCE(is_testnet, true)
WHERE chain_id IS NULL OR chain_name IS NULL OR contract_version IS NULL;

-- ============================================
-- 3. Fix any Sepolia campaigns that were incorrectly tagged
-- If they have V7 contract version, they should be on Sepolia
-- ============================================
UPDATE submissions
SET 
  chain_id = 11155111,
  chain_name = 'Sepolia Testnet',
  is_testnet = true
WHERE contract_version = 'v7' 
  AND (chain_id IS NULL OR chain_id = 1043);

-- ============================================
-- 4. Backfill purchases table
-- ============================================
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 1043;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS chain_name VARCHAR(50) DEFAULT 'BlockDAG';

UPDATE purchases
SET 
  chain_id = COALESCE(chain_id, 1043),
  chain_name = COALESCE(chain_name, 'BlockDAG')
WHERE chain_id IS NULL;

-- ============================================
-- 5. Create indexes for filtering
-- ============================================
CREATE INDEX IF NOT EXISTS idx_submissions_chain_id ON submissions(chain_id);
CREATE INDEX IF NOT EXISTS idx_submissions_contract_version ON submissions(contract_version);
CREATE INDEX IF NOT EXISTS idx_submissions_is_testnet ON submissions(is_testnet);
CREATE INDEX IF NOT EXISTS idx_purchases_chain_id ON purchases(chain_id);

-- ============================================
-- 6. Summary query - run to verify backfill
-- ============================================
-- SELECT 
--   chain_id,
--   chain_name,
--   contract_version,
--   is_testnet,
--   COUNT(*) as campaign_count
-- FROM submissions
-- GROUP BY chain_id, chain_name, contract_version, is_testnet
-- ORDER BY chain_id;
