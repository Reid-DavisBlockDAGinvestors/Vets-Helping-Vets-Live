-- Add immediate_payout_enabled column to submissions table
-- This tracks whether a campaign has automatic fund distribution enabled

-- Add column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'submissions' AND column_name = 'immediate_payout_enabled'
  ) THEN
    ALTER TABLE submissions ADD COLUMN immediate_payout_enabled BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add distribution tracking columns
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'submissions' AND column_name = 'total_distributed'
  ) THEN
    ALTER TABLE submissions ADD COLUMN total_distributed DECIMAL(20, 8) DEFAULT 0;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'submissions' AND column_name = 'last_distribution_at'
  ) THEN
    ALTER TABLE submissions ADD COLUMN last_distribution_at TIMESTAMPTZ;
  END IF;
END $$;

-- Update existing mainnet campaigns to have immediate_payout_enabled = true
-- Chain ID 1 = Ethereum Mainnet
UPDATE submissions 
SET immediate_payout_enabled = true 
WHERE chain_id = '1' AND immediate_payout_enabled IS NULL;

-- Index for filtering by immediate payout status
CREATE INDEX IF NOT EXISTS idx_submissions_immediate_payout 
ON submissions(immediate_payout_enabled) 
WHERE immediate_payout_enabled = true;

-- Add comment for documentation
COMMENT ON COLUMN submissions.immediate_payout_enabled IS 
'When true, funds are automatically distributed to submitter on each NFT mint. Default true for mainnet, false for testnets.';

COMMENT ON COLUMN submissions.total_distributed IS 
'Total amount distributed to submitter (in native currency). Updated after each distribution.';

COMMENT ON COLUMN submissions.last_distribution_at IS 
'Timestamp of last fund distribution to submitter.';
