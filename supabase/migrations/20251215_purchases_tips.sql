-- Add tip columns to purchases table
-- This allows tracking NFT purchase amounts vs tips separately

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS tip_bdag DECIMAL(20, 8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tip_usd DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- Add index for faster wallet lookups
CREATE INDEX IF NOT EXISTS idx_purchases_wallet_address ON purchases(wallet_address);

-- Comment on columns
COMMENT ON COLUMN purchases.tip_bdag IS 'Tip amount in BDAG (separate from NFT price)';
COMMENT ON COLUMN purchases.tip_usd IS 'Tip amount in USD (separate from NFT price)';
COMMENT ON COLUMN purchases.quantity IS 'Number of NFTs purchased in this transaction';
