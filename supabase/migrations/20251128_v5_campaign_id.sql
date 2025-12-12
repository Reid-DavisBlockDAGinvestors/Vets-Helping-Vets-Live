-- V5: Add campaign_id column to submissions
-- Campaigns are created on-chain, editions minted to donors on purchase

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS campaign_id INTEGER;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_submissions_campaign_id ON submissions(campaign_id);

-- Add the new V5 contract to marketplace_contracts
-- (Run after deployment with actual address)
