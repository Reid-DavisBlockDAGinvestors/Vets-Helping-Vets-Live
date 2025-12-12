-- Add V4 contract and disable V3
INSERT INTO public.marketplace_contracts (contract_address, label, enabled)
VALUES ('0x1BcDa812303c3A5A3e95230E768b84244650562e', 'V4 (current)', true)
ON CONFLICT (contract_address) DO UPDATE SET label = EXCLUDED.label, enabled = EXCLUDED.enabled;

-- Disable old V3 contract
UPDATE public.marketplace_contracts 
SET enabled = false, label = 'V3 (legacy)'
WHERE contract_address = '0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e';
