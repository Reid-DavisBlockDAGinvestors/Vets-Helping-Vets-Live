-- Enhanced purchases table with additional tracking fields
-- This ensures we capture all possible data for each purchase

-- Add user_id to link purchases to logged-in users
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'crypto_bdag',
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45),
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS referrer TEXT;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_campaign_id ON purchases(campaign_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at);

-- Comments
COMMENT ON COLUMN purchases.user_id IS 'Link to auth.users for logged-in purchases';
COMMENT ON COLUMN purchases.payment_method IS 'crypto_bdag, crypto_eth, stripe, paypal, etc';
COMMENT ON COLUMN purchases.ip_address IS 'Buyer IP for fraud prevention';
COMMENT ON COLUMN purchases.user_agent IS 'Browser/device info';
COMMENT ON COLUMN purchases.referrer IS 'How user found the campaign';

-- Ensure we have the tip columns from previous migration
ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS tip_bdag DECIMAL(20, 8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tip_usd DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
