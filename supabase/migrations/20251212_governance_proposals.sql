-- Governance proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  submitter_email TEXT,
  submitter_name TEXT,
  submitter_wallet TEXT,
  submitter_nfts_owned INTEGER DEFAULT 0,
  submitter_campaigns_created INTEGER DEFAULT 0,
  submitter_total_donated NUMERIC DEFAULT 0,
  yes_votes INTEGER DEFAULT 0,
  no_votes INTEGER DEFAULT 0,
  open BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, implemented
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_open ON proposals(open);
CREATE INDEX IF NOT EXISTS idx_proposals_created ON proposals(created_at DESC);

-- Votes tracking table with full voter info
CREATE TABLE IF NOT EXISTS proposal_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id INTEGER REFERENCES proposals(id) ON DELETE CASCADE,
  voter_wallet TEXT NOT NULL,
  voter_email TEXT,
  voter_name TEXT,
  support BOOLEAN NOT NULL,
  nfts_owned INTEGER DEFAULT 0,
  campaigns_created INTEGER DEFAULT 0,
  total_donated NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proposal_id, voter_wallet)
);
