-- Enable RLS and Create Policies for Unprotected Tables
-- Run this in Supabase SQL Editor
-- Based on RLS audit findings
-- Use DROP IF EXISTS to handle re-runs

-- ============================================
-- 1. campaign_updates - Enable RLS
-- ============================================
ALTER TABLE campaign_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view approved updates" ON campaign_updates;
DROP POLICY IF EXISTS "Users can view own updates" ON campaign_updates;
DROP POLICY IF EXISTS "Authenticated users can view all updates" ON campaign_updates;
DROP POLICY IF EXISTS "Service role full access campaign_updates" ON campaign_updates;

CREATE POLICY "Anyone can view approved updates" ON campaign_updates
  FOR SELECT
  TO public
  USING (status = 'approved');

CREATE POLICY "Authenticated users can view all updates" ON campaign_updates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access campaign_updates" ON campaign_updates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 2. cleanup_tasks - Enable RLS (internal use only)
-- ============================================
ALTER TABLE cleanup_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only cleanup_tasks" ON cleanup_tasks;

CREATE POLICY "Service role only cleanup_tasks" ON cleanup_tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 3. contributions - Enable RLS
-- ============================================
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view contributions" ON contributions;
DROP POLICY IF EXISTS "Service role full access contributions" ON contributions;

CREATE POLICY "Anyone can view contributions" ON contributions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role full access contributions" ON contributions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. marketplace_contracts - Enable RLS
-- ============================================
ALTER TABLE marketplace_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view enabled contracts" ON marketplace_contracts;
DROP POLICY IF EXISTS "Service role full access marketplace_contracts" ON marketplace_contracts;

CREATE POLICY "Anyone can view enabled contracts" ON marketplace_contracts
  FOR SELECT
  TO public
  USING (enabled = true);

CREATE POLICY "Service role full access marketplace_contracts" ON marketplace_contracts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 5. nft_contracts - Enable RLS
-- ============================================
ALTER TABLE nft_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view nft_contracts" ON nft_contracts;
DROP POLICY IF EXISTS "Service role full access nft_contracts" ON nft_contracts;

CREATE POLICY "Anyone can view nft_contracts" ON nft_contracts
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role full access nft_contracts" ON nft_contracts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 6. proposal_votes - Enable RLS
-- ============================================
ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view votes" ON proposal_votes;
DROP POLICY IF EXISTS "Users can create own votes" ON proposal_votes;
DROP POLICY IF EXISTS "Authenticated users can create votes" ON proposal_votes;
DROP POLICY IF EXISTS "Service role full access proposal_votes" ON proposal_votes;

CREATE POLICY "Anyone can view votes" ON proposal_votes
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can create votes" ON proposal_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access proposal_votes" ON proposal_votes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 7. proposals - Enable RLS
-- ============================================
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view proposals" ON proposals;
DROP POLICY IF EXISTS "Authenticated users can create proposals" ON proposals;
DROP POLICY IF EXISTS "Users can update own proposals" ON proposals;
DROP POLICY IF EXISTS "Authenticated users can update proposals" ON proposals;
DROP POLICY IF EXISTS "Service role full access proposals" ON proposals;

CREATE POLICY "Anyone can view proposals" ON proposals
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can create proposals" ON proposals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update proposals" ON proposals
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Service role full access proposals" ON proposals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Verify RLS is enabled
-- ============================================
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'campaign_updates', 
  'cleanup_tasks', 
  'contributions',
  'marketplace_contracts',
  'nft_contracts',
  'proposal_votes',
  'proposals'
);
