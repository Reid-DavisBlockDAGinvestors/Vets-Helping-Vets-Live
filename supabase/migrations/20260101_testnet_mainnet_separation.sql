-- ============================================
-- TESTNET vs MAINNET SEPARATION MIGRATION
-- Distinguishes test funds from real funds
-- Run this ONCE in Supabase SQL Editor
-- Generated: Jan 1, 2026
-- ============================================

-- ============================================
-- 1. SUBMISSIONS TABLE - Add testnet tracking
-- ============================================
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS is_testnet BOOLEAN DEFAULT true;

ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS target_chain_id INTEGER;

ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS target_contract_version VARCHAR(20);

COMMENT ON COLUMN submissions.is_testnet IS 'True if this campaign uses testnet tokens (not real money)';
COMMENT ON COLUMN submissions.target_chain_id IS 'The blockchain network this campaign is deployed to';
COMMENT ON COLUMN submissions.target_contract_version IS 'The contract version to mint NFTs on';

-- Backfill: All existing submissions are testnet (BlockDAG Awakening)
UPDATE submissions 
SET is_testnet = true,
    target_chain_id = COALESCE(chain_id, 1043)
WHERE is_testnet IS NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_is_testnet ON submissions(is_testnet);

-- ============================================
-- 2. PURCHASES TABLE - Add testnet tracking
-- ============================================
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS is_testnet BOOLEAN DEFAULT true;

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS amount_native DECIMAL(36,18);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS native_currency VARCHAR(10);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS amount_eth DECIMAL(36,18);

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS tip_eth DECIMAL(36,18);

COMMENT ON COLUMN purchases.is_testnet IS 'True if this purchase used testnet tokens (not real money)';
COMMENT ON COLUMN purchases.amount_native IS 'Amount in native token (BDAG, ETH, MATIC)';
COMMENT ON COLUMN purchases.native_currency IS 'The native currency symbol used';
COMMENT ON COLUMN purchases.amount_eth IS 'Amount in ETH (for Ethereum/Sepolia purchases)';
COMMENT ON COLUMN purchases.tip_eth IS 'Tip amount in ETH';

-- Backfill: All existing purchases are testnet
UPDATE purchases 
SET is_testnet = true,
    native_currency = CASE 
      WHEN chain_id = 1043 THEN 'BDAG'
      WHEN chain_id IN (1, 11155111) THEN 'ETH'
      WHEN chain_id = 137 THEN 'MATIC'
      ELSE 'BDAG'
    END,
    amount_native = COALESCE(amount_bdag, 0)
WHERE is_testnet IS NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_is_testnet ON purchases(is_testnet);
CREATE INDEX IF NOT EXISTS idx_purchases_native_currency ON purchases(native_currency);

-- ============================================
-- 3. EVENTS TABLE - Add testnet tracking
-- ============================================
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS is_testnet BOOLEAN DEFAULT true;

-- Backfill: All existing events are testnet
UPDATE events SET is_testnet = true WHERE is_testnet IS NULL;

-- ============================================
-- 4. CONTRACTS TABLE - Add testnet flag
-- ============================================
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS is_testnet BOOLEAN DEFAULT false;

-- Update contracts with correct testnet status
UPDATE contracts SET is_testnet = true WHERE chain_id IN (1043, 11155111);
UPDATE contracts SET is_testnet = false WHERE chain_id IN (1, 137, 8453);

-- ============================================
-- 5. UPDATE CHAIN_CONFIGS - Fix BlockDAG testnet status
-- ============================================
-- BlockDAG "Awakening" is a testnet phase
UPDATE chain_configs 
SET is_testnet = true 
WHERE chain_id = 1043;

-- Ensure Sepolia is marked as testnet
UPDATE chain_configs 
SET is_testnet = true 
WHERE chain_id = 11155111;

-- Ensure mainnets are NOT testnet
UPDATE chain_configs 
SET is_testnet = false 
WHERE chain_id IN (1, 137, 8453);

-- ============================================
-- 6. VIEWS FOR FUND REPORTING
-- ============================================

-- View: Testnet funds summary (play money)
CREATE OR REPLACE VIEW testnet_funds_summary AS
SELECT 
  p.chain_id,
  p.chain_name,
  p.native_currency,
  COUNT(*) as total_purchases,
  SUM(p.amount_usd) as total_usd,
  SUM(p.amount_bdag) as total_bdag,
  SUM(p.amount_native) as total_native
FROM purchases p
WHERE p.is_testnet = true
GROUP BY p.chain_id, p.chain_name, p.native_currency;

-- View: Mainnet funds summary (real money)
CREATE OR REPLACE VIEW mainnet_funds_summary AS
SELECT 
  p.chain_id,
  p.chain_name,
  p.native_currency,
  COUNT(*) as total_purchases,
  SUM(p.amount_usd) as total_usd,
  SUM(p.amount_native) as total_native
FROM purchases p
WHERE p.is_testnet = false
GROUP BY p.chain_id, p.chain_name, p.native_currency;

-- View: Campaign funds by network type
CREATE OR REPLACE VIEW campaign_funds_by_type AS
SELECT 
  s.id as submission_id,
  s.title,
  s.is_testnet,
  s.chain_name,
  COALESCE(SUM(p.amount_usd), 0) as total_raised_usd,
  COALESCE(SUM(p.amount_native), 0) as total_raised_native,
  p.native_currency,
  COUNT(p.id) as total_purchases
FROM submissions s
LEFT JOIN purchases p ON p.campaign_id::text = s.campaign_id::text
GROUP BY s.id, s.title, s.is_testnet, s.chain_name, p.native_currency;

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to check if a chain is testnet
CREATE OR REPLACE FUNCTION is_testnet_chain(p_chain_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT is_testnet FROM chain_configs WHERE chain_id = p_chain_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get testnet/mainnet label
CREATE OR REPLACE FUNCTION get_network_type_label(p_chain_id INTEGER)
RETURNS VARCHAR AS $$
BEGIN
  IF is_testnet_chain(p_chain_id) THEN
    RETURN 'Testnet';
  ELSE
    RETURN 'Mainnet';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to validate purchase network matches campaign network
CREATE OR REPLACE FUNCTION validate_purchase_network(
  p_campaign_chain_id INTEGER,
  p_payment_chain_id INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_campaign_is_testnet BOOLEAN;
  v_payment_is_testnet BOOLEAN;
BEGIN
  SELECT is_testnet INTO v_campaign_is_testnet FROM chain_configs WHERE chain_id = p_campaign_chain_id;
  SELECT is_testnet INTO v_payment_is_testnet FROM chain_configs WHERE chain_id = p_payment_chain_id;
  
  -- For now, campaigns must be purchased on the exact same network
  -- This can be relaxed later if needed (e.g., allow any mainnet to purchase mainnet campaigns)
  RETURN p_campaign_chain_id = p_payment_chain_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. CONSTRAINTS (Optional - enable after testing)
-- ============================================

-- Uncomment to enforce network validation at DB level:
-- ALTER TABLE purchases 
-- ADD CONSTRAINT check_network_match 
-- CHECK (
--   validate_purchase_network(
--     (SELECT chain_id FROM submissions WHERE campaign_id::text = purchases.campaign_id::text),
--     chain_id
--   )
-- );

-- ============================================
-- 9. STATISTICS COMMENT
-- ============================================
COMMENT ON VIEW testnet_funds_summary IS 'Summary of funds raised using testnet tokens (BlockDAG Awakening, Sepolia) - NOT real money';
COMMENT ON VIEW mainnet_funds_summary IS 'Summary of REAL funds raised using mainnet tokens (Ethereum, Polygon, Base)';
COMMENT ON FUNCTION is_testnet_chain IS 'Returns true if the given chain_id is a testnet';
COMMENT ON FUNCTION validate_purchase_network IS 'Validates that a purchase is being made on the correct network for the campaign';

-- ============================================
-- DONE! Run this once in Supabase SQL Editor
-- ============================================
-- After running:
-- 1. All existing data is marked as testnet
-- 2. New columns track testnet status
-- 3. Views separate testnet vs mainnet funds
-- 4. BlockDAG correctly marked as testnet
-- ============================================
