-- Fix Sepolia campaigns that were approved before chain_id fix
-- This adds is_testnet column and fixes any Sepolia campaigns

-- 1. Add is_testnet column to submissions if not exists
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS is_testnet BOOLEAN DEFAULT true;

-- 2. Set is_testnet based on chain_id for existing records
UPDATE submissions 
SET is_testnet = CASE 
  WHEN chain_id IN (1, 137, 8453) THEN false  -- Mainnets
  ELSE true  -- Testnets (1043, 11155111, etc.)
END
WHERE is_testnet IS NULL;

-- 3. Query to find campaigns that need fixing (run this first to verify)
-- SELECT id, title, chain_id, chain_name, contract_version, campaign_id, status
-- FROM submissions 
-- WHERE title ILIKE '%this is a test%'
--    OR (contract_version ILIKE '%v7%' AND chain_id = 1043);

-- 4. Fix campaigns marked as v7 but on wrong chain
UPDATE submissions 
SET 
  chain_id = 11155111,
  chain_name = 'Sepolia Testnet',
  is_testnet = true
WHERE contract_version ILIKE '%v7%'
  AND (chain_id = 1043 OR chain_id IS NULL);

-- 5. Fix "This is a test" campaign specifically
UPDATE submissions 
SET 
  chain_id = 11155111,
  chain_name = 'Sepolia Testnet',
  is_testnet = true,
  contract_version = 'v7'
WHERE title ILIKE '%this is only a test%'
   OR title ILIKE '%this is a test%';
