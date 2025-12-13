-- Create purchases table to track NFT purchases for donor retention calculation
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  campaign_id INTEGER NOT NULL,
  token_id INTEGER,
  tx_hash TEXT,
  amount_bdag NUMERIC,
  amount_usd NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_purchases_wallet ON purchases(wallet_address);
CREATE INDEX IF NOT EXISTS idx_purchases_campaign ON purchases(campaign_id);
CREATE INDEX IF NOT EXISTS idx_purchases_wallet_campaign ON purchases(wallet_address, campaign_id);

-- Enable RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for analytics)
CREATE POLICY "Allow public read" ON purchases FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role all" ON purchases FOR ALL USING (auth.role() = 'service_role');
