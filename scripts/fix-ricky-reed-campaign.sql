-- Fix the Ricky Vega and Reid Davis campaign submission
-- This updates the submission with the new on-chain campaign data

UPDATE submissions
SET 
  status = 'minted',
  campaign_id = 16,
  tx_hash = '0x77a11507e5feaab8efcb6eae833025b1dc0ff0065de937479d406de900def17',
  contract_address = '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890',
  visible_on_marketplace = true,
  updated_at = NOW()
WHERE id = '305f77eb-0dcc-4e44-b6dc-d7ced9b7e512';

-- Verify the update
SELECT id, title, status, campaign_id, tx_hash, contract_address, visible_on_marketplace
FROM submissions
WHERE id = '305f77eb-0dcc-4e44-b6dc-d7ced9b7e512';
