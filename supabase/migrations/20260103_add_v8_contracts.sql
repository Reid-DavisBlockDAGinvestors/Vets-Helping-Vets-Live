-- Add V8 contracts to marketplace_contracts table

-- V8 Ethereum Mainnet (Production)
INSERT INTO marketplace_contracts (contract_address, chain_id, label, enabled, created_at)
VALUES (
  '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e',
  1,
  'PatriotPledgeNFT V8 (Ethereum Mainnet)',
  true,
  NOW()
) ON CONFLICT (contract_address) DO UPDATE SET
  label = EXCLUDED.label,
  enabled = EXCLUDED.enabled;

-- V8 Sepolia Testnet
INSERT INTO marketplace_contracts (contract_address, chain_id, label, enabled, created_at)
VALUES (
  '0x042652292B8f1670b257707C1aDA4D19de9E9399',
  11155111,
  'PatriotPledgeNFT V8 (Sepolia)',
  true,
  NOW()
) ON CONFLICT (contract_address) DO UPDATE SET
  label = EXCLUDED.label,
  enabled = EXCLUDED.enabled;
