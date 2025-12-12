-- Add V4 contract with contributeNative() functions
-- Disable previous V4 and enable new deployment

-- Add new V4 contract with native contribution support
INSERT INTO public.marketplace_contracts (contract_address, label, enabled)
VALUES ('0xcAf0ceE0B022324dE9607f4573c2BB995a8a5A9C', 'V4 (with native contributions)', true)
ON CONFLICT (contract_address) DO UPDATE SET label = EXCLUDED.label, enabled = EXCLUDED.enabled;

-- Disable previous V4 contract
UPDATE public.marketplace_contracts 
SET enabled = false, label = 'V4 (legacy - no native contributions)'
WHERE contract_address = '0x1BcDa812303c3A5A3e95230E768b84244650562e';
