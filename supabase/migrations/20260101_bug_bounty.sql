-- Bug Bounty Reward System
-- Rewards users for finding and reporting valid bugs

-- Bounty tiers based on severity
CREATE TABLE IF NOT EXISTS bug_bounty_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  min_reward_usd DECIMAL(10,2) NOT NULL,
  max_reward_usd DECIMAL(10,2) NOT NULL,
  min_reward_bdag DECIMAL(18,2) NOT NULL,
  max_reward_bdag DECIMAL(18,2) NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT '🐛',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default bounty tiers (Max $100 USD equivalent)
INSERT INTO bug_bounty_tiers (id, name, description, min_reward_usd, max_reward_usd, min_reward_bdag, max_reward_bdag, color, icon) VALUES
  ('low', 'Low Severity', 'Minor UI issues, typos, cosmetic bugs', 5, 10, 100, 200, '#22c55e', '🟢'),
  ('medium', 'Medium Severity', 'Functional bugs, broken features, usability issues', 10, 25, 200, 500, '#eab308', '🟡'),
  ('high', 'High Severity', 'Security vulnerabilities, data exposure, critical bugs', 25, 50, 500, 1000, '#f97316', '🟠'),
  ('critical', 'Critical Severity', 'Major security flaws, smart contract vulnerabilities', 50, 100, 1000, 2000, '#ef4444', '🔴')
ON CONFLICT (id) DO NOTHING;

-- Bug bounty rewards tracking
CREATE TABLE IF NOT EXISTS bug_bounty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_report_id UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Reward details
  tier_id TEXT REFERENCES bug_bounty_tiers(id),
  reward_amount_usd DECIMAL(10,2),
  reward_amount_bdag DECIMAL(18,2),
  reward_type TEXT DEFAULT 'bdag' CHECK (reward_type IN ('usd', 'bdag', 'nft', 'credit')),
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected', 'disputed')),
  
  -- Payment details
  payment_method TEXT CHECK (payment_method IN ('wallet', 'paypal', 'credit', 'nft')),
  payment_wallet_address TEXT,
  payment_tx_hash TEXT,
  payment_date TIMESTAMPTZ,
  
  -- Admin notes
  admin_notes TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add bounty fields to bug_reports table
ALTER TABLE bug_reports 
  ADD COLUMN IF NOT EXISTS is_bounty_eligible BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS bounty_claimed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bounty_tier TEXT,
  ADD COLUMN IF NOT EXISTS bounty_reward_id UUID REFERENCES bug_bounty_rewards(id);

-- User bounty stats (leaderboard)
CREATE TABLE IF NOT EXISTS bug_bounty_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_reports INTEGER DEFAULT 0,
  valid_reports INTEGER DEFAULT 0,
  total_rewards_usd DECIMAL(10,2) DEFAULT 0,
  total_rewards_bdag DECIMAL(18,2) DEFAULT 0,
  current_rank INTEGER,
  rank_title TEXT DEFAULT 'Bug Hunter',
  badges JSONB DEFAULT '[]'::jsonb,
  first_bug_at TIMESTAMPTZ,
  last_bug_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rank titles based on valid reports
-- 1-2: Bug Hunter
-- 3-5: Bug Slayer
-- 6-10: Security Scout
-- 11-25: Vulnerability Expert
-- 26-50: Elite Hunter
-- 50+: Legendary Bug Master

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bounty_rewards_user ON bug_bounty_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_bounty_rewards_report ON bug_bounty_rewards(bug_report_id);
CREATE INDEX IF NOT EXISTS idx_bounty_rewards_status ON bug_bounty_rewards(status);
CREATE INDEX IF NOT EXISTS idx_bounty_stats_rank ON bug_bounty_stats(current_rank);
CREATE INDEX IF NOT EXISTS idx_bounty_stats_rewards ON bug_bounty_stats(total_rewards_usd DESC);

-- RLS policies
ALTER TABLE bug_bounty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_bounty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_bounty_stats ENABLE ROW LEVEL SECURITY;

-- Everyone can view tiers
CREATE POLICY "Anyone can view bounty tiers" ON bug_bounty_tiers
  FOR SELECT USING (true);

-- Users can view their own rewards
CREATE POLICY "Users can view own rewards" ON bug_bounty_rewards
  FOR SELECT USING (auth.uid() = user_id);

-- Service role manages rewards
CREATE POLICY "Service role manages rewards" ON bug_bounty_rewards
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can view their own stats
CREATE POLICY "Users can view own stats" ON bug_bounty_stats
  FOR SELECT USING (auth.uid() = user_id);

-- Everyone can view leaderboard (public stats)
CREATE POLICY "Anyone can view leaderboard" ON bug_bounty_stats
  FOR SELECT USING (true);

-- Service role manages stats
CREATE POLICY "Service role manages stats" ON bug_bounty_stats
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Function to update user bounty stats
CREATE OR REPLACE FUNCTION update_bounty_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or insert stats for the user
  INSERT INTO bug_bounty_stats (user_id, total_reports, valid_reports, total_rewards_usd, total_rewards_bdag, first_bug_at, last_bug_at, updated_at)
  SELECT 
    NEW.user_id,
    1,
    CASE WHEN NEW.status = 'approved' OR NEW.status = 'paid' THEN 1 ELSE 0 END,
    COALESCE(NEW.reward_amount_usd, 0),
    COALESCE(NEW.reward_amount_bdag, 0),
    NOW(),
    NOW(),
    NOW()
  ON CONFLICT (user_id) DO UPDATE SET
    total_reports = bug_bounty_stats.total_reports + 1,
    valid_reports = bug_bounty_stats.valid_reports + CASE WHEN NEW.status = 'approved' OR NEW.status = 'paid' THEN 1 ELSE 0 END,
    total_rewards_usd = bug_bounty_stats.total_rewards_usd + COALESCE(NEW.reward_amount_usd, 0),
    total_rewards_bdag = bug_bounty_stats.total_rewards_bdag + COALESCE(NEW.reward_amount_bdag, 0),
    last_bug_at = NOW(),
    updated_at = NOW(),
    rank_title = CASE 
      WHEN bug_bounty_stats.valid_reports + 1 >= 50 THEN 'Legendary Bug Master'
      WHEN bug_bounty_stats.valid_reports + 1 >= 26 THEN 'Elite Hunter'
      WHEN bug_bounty_stats.valid_reports + 1 >= 11 THEN 'Vulnerability Expert'
      WHEN bug_bounty_stats.valid_reports + 1 >= 6 THEN 'Security Scout'
      WHEN bug_bounty_stats.valid_reports + 1 >= 3 THEN 'Bug Slayer'
      ELSE 'Bug Hunter'
    END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update stats when reward status changes
CREATE TRIGGER update_bounty_stats_trigger
  AFTER INSERT OR UPDATE OF status ON bug_bounty_rewards
  FOR EACH ROW
  WHEN (NEW.status IN ('approved', 'paid'))
  EXECUTE FUNCTION update_bounty_stats();

-- Function to update leaderboard ranks
CREATE OR REPLACE FUNCTION update_bounty_ranks()
RETURNS void AS $$
BEGIN
  WITH ranked AS (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY total_rewards_usd DESC, valid_reports DESC) as rank
    FROM bug_bounty_stats
    WHERE valid_reports > 0
  )
  UPDATE bug_bounty_stats s
  SET current_rank = r.rank, updated_at = NOW()
  FROM ranked r
  WHERE s.user_id = r.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE bug_bounty_tiers IS 'Bounty reward tiers based on bug severity';
COMMENT ON TABLE bug_bounty_rewards IS 'Individual bounty rewards for bug reports';
COMMENT ON TABLE bug_bounty_stats IS 'Aggregated stats per user for leaderboard';
