-- Add column to track when platform wallet is used instead of creator's wallet
-- This enables admins to migrate funds later when creator adds their own wallet

ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS uses_platform_wallet BOOLEAN DEFAULT FALSE;

-- Add index for quick lookup of submissions using platform wallet
CREATE INDEX IF NOT EXISTS idx_submissions_uses_platform_wallet 
ON submissions(uses_platform_wallet) 
WHERE uses_platform_wallet = TRUE;

-- Comment for documentation
COMMENT ON COLUMN submissions.uses_platform_wallet IS 'True when campaign uses platform wallet because creator has no crypto wallet. Funds can be migrated when creator adds wallet later.';
