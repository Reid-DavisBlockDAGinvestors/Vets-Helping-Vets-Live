-- Enable V7 Sepolia contract in marketplace
-- This allows V7 campaigns to appear on the marketplace

INSERT INTO marketplace_contracts (contract_address, enabled, label)
VALUES (
  '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
  true,
  'PatriotPledgeNFT V7 (Sepolia)'
)
ON CONFLICT (contract_address) 
DO UPDATE SET enabled = true, label = EXCLUDED.label;

-- Also ensure the submission has visible_on_marketplace = true
UPDATE submissions
SET visible_on_marketplace = true
WHERE contract_address = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e'
  AND status = 'minted'
  AND (visible_on_marketplace IS NULL OR visible_on_marketplace = false);
