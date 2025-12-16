-- Add tx_hash column to submissions for tracking on-chain transaction
-- This stores the blockchain transaction hash when a campaign is created on-chain

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS tx_hash TEXT;

-- Index for faster lookups by tx_hash
CREATE INDEX IF NOT EXISTS idx_submissions_tx_hash ON submissions(tx_hash);

COMMENT ON COLUMN submissions.tx_hash IS 'Blockchain transaction hash from campaign creation';
