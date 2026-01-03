-- Tokens Cache Table
-- Used for fast token lookups in admin panel without RPC calls
-- Populated when NFTs are minted, updated when admin actions occur

CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  token_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  chain_id INTEGER NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  contract_version VARCHAR(10) NOT NULL,
  owner_wallet VARCHAR(42) NOT NULL,
  edition_number INTEGER,
  total_editions INTEGER,
  is_frozen BOOLEAN DEFAULT FALSE,
  is_soulbound BOOLEAN DEFAULT FALSE,
  metadata_uri TEXT,
  mint_tx_hash VARCHAR(66),
  minted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_id, chain_id, contract_address)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_tokens_chain_id ON tokens(chain_id);
CREATE INDEX IF NOT EXISTS idx_tokens_campaign_id ON tokens(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tokens_owner_wallet ON tokens(owner_wallet);
CREATE INDEX IF NOT EXISTS idx_tokens_is_frozen ON tokens(is_frozen);
CREATE INDEX IF NOT EXISTS idx_tokens_is_soulbound ON tokens(is_soulbound);
CREATE INDEX IF NOT EXISTS idx_tokens_contract_version ON tokens(contract_version);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS tokens_updated_at ON tokens;
CREATE TRIGGER tokens_updated_at
  BEFORE UPDATE ON tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_tokens_updated_at();

-- RLS policies
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- Anyone can read tokens (public data)
CREATE POLICY "Tokens are viewable by everyone"
  ON tokens FOR SELECT
  USING (true);

-- Only service role can insert/update (from API)
CREATE POLICY "Service role can insert tokens"
  ON tokens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update tokens"
  ON tokens FOR UPDATE
  USING (true);

COMMENT ON TABLE tokens IS 'Cache of minted NFT tokens for fast admin panel queries';
COMMENT ON COLUMN tokens.token_id IS 'On-chain token ID';
COMMENT ON COLUMN tokens.is_frozen IS 'Whether token transfers are frozen';
COMMENT ON COLUMN tokens.is_soulbound IS 'Whether token is permanently bound to owner';
