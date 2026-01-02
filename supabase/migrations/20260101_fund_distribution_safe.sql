-- ============================================
-- Fund Distribution Tables Migration (SAFE VERSION)
-- Created: January 1, 2026
-- This version handles existing objects gracefully
-- ============================================

-- Drop view and functions first (safe - they don't require tables to exist)
DROP VIEW IF EXISTS campaign_fund_status CASCADE;
DROP FUNCTION IF EXISTS update_submission_distribution_totals CASCADE;
DROP FUNCTION IF EXISTS get_or_create_tip_split CASCADE;

-- 1. Distributions Table - Track all fund distributions
CREATE TABLE IF NOT EXISTS public.distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  tx_hash VARCHAR(66),
  
  distribution_type VARCHAR(20) NOT NULL CHECK (distribution_type IN ('funds', 'tips', 'refund', 'combined')),
  
  total_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
  submitter_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
  nonprofit_amount DECIMAL(36,18) NOT NULL DEFAULT 0,
  platform_fee DECIMAL(36,18) NOT NULL DEFAULT 0,
  
  total_amount_usd DECIMAL(18,2),
  submitter_amount_usd DECIMAL(18,2),
  nonprofit_amount_usd DECIMAL(18,2),
  platform_fee_usd DECIMAL(18,2),
  
  tip_split_submitter_pct INTEGER DEFAULT 100 CHECK (tip_split_submitter_pct >= 0 AND tip_split_submitter_pct <= 100),
  tip_split_nonprofit_pct INTEGER DEFAULT 0 CHECK (tip_split_nonprofit_pct >= 0 AND tip_split_nonprofit_pct <= 100),
  
  submitter_wallet VARCHAR(42),
  nonprofit_wallet VARCHAR(42),
  
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'confirmed', 'failed')),
  
  initiated_by UUID REFERENCES auth.users(id),
  initiated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  notes TEXT,
  
  native_currency VARCHAR(10) NOT NULL DEFAULT 'BDAG',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for distributions
CREATE INDEX IF NOT EXISTS idx_distributions_campaign ON distributions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_distributions_status ON distributions(status);
CREATE INDEX IF NOT EXISTS idx_distributions_chain ON distributions(chain_id);
CREATE INDEX IF NOT EXISTS idx_distributions_type ON distributions(distribution_type);
CREATE INDEX IF NOT EXISTS idx_distributions_initiated_at ON distributions(initiated_at DESC);

-- 2. Tip Split Configuration Table
CREATE TABLE IF NOT EXISTS public.tip_split_configs (
  id SERIAL PRIMARY KEY,
  campaign_id UUID REFERENCES submissions(id) ON DELETE CASCADE UNIQUE,
  
  submitter_percent INTEGER NOT NULL DEFAULT 100 CHECK (submitter_percent >= 0 AND submitter_percent <= 100),
  nonprofit_percent INTEGER NOT NULL DEFAULT 0 CHECK (nonprofit_percent >= 0 AND nonprofit_percent <= 100),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT tip_split_total CHECK (submitter_percent + nonprofit_percent = 100)
);

CREATE INDEX IF NOT EXISTS idx_tip_split_campaign ON tip_split_configs(campaign_id);

-- 3. Add distribution tracking columns to submissions table
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS total_distributed DECIMAL(36,18) DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS pending_distribution DECIMAL(36,18) DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS tips_distributed DECIMAL(36,18) DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS last_distribution_at TIMESTAMP WITH TIME ZONE;

-- 4. Create view for campaign fund status
-- Uses s.campaign_id = p.campaign_id (both are INTEGER on-chain campaign IDs)
CREATE OR REPLACE VIEW campaign_fund_status AS
SELECT 
  s.id,
  s.title,
  s.status,
  s.chain_id,
  s.chain_name,
  COALESCE(s.is_testnet, true) as is_testnet,
  s.creator_wallet,
  COALESCE(s.contract_version, 'V5') as contract_version,
  COALESCE(s.immediate_payout_enabled, false) as immediate_payout_enabled,
  
  COALESCE(tsc.submitter_percent, 100) as tip_split_submitter_pct,
  COALESCE(tsc.nonprofit_percent, 0) as tip_split_nonprofit_pct,
  
  COALESCE(SUM(p.amount_usd), 0) as gross_raised_usd,
  COALESCE(SUM(COALESCE(p.amount_native, p.amount_bdag, 0)), 0) as gross_raised_native,
  
  COALESCE(SUM(COALESCE(p.tip_usd, 0)), 0) as tips_received_usd,
  COALESCE(SUM(COALESCE(p.tip_eth, p.tip_bdag, 0)), 0) as tips_received_native,
  
  COALESCE(s.total_distributed, 0) as total_distributed,
  COALESCE(s.tips_distributed, 0) as tips_distributed,
  s.last_distribution_at,
  
  COALESCE(SUM(COALESCE(p.amount_native, p.amount_bdag, 0)), 0) - COALESCE(s.total_distributed, 0) as pending_distribution_native,
  COALESCE(SUM(COALESCE(p.tip_eth, p.tip_bdag, 0)), 0) - COALESCE(s.tips_distributed, 0) as pending_tips_native,
  
  CASE 
    WHEN s.chain_id = 1043 THEN 'BDAG'
    WHEN s.chain_id IN (1, 11155111) THEN 'ETH'
    ELSE 'BDAG'
  END as native_currency,
  
  (SELECT COUNT(*) FROM distributions d WHERE d.campaign_id = s.id) as distribution_count

FROM submissions s
LEFT JOIN purchases p ON s.campaign_id = p.campaign_id
LEFT JOIN tip_split_configs tsc ON s.id = tsc.campaign_id
WHERE s.status = 'minted'
GROUP BY 
  s.id, s.title, s.status, s.chain_id, s.chain_name, s.is_testnet,
  s.creator_wallet, s.contract_version, s.immediate_payout_enabled,
  s.total_distributed, s.tips_distributed, s.last_distribution_at,
  tsc.submitter_percent, tsc.nonprofit_percent;

-- 5. Function to get or create default tip split config
CREATE OR REPLACE FUNCTION get_or_create_tip_split(p_campaign_id UUID)
RETURNS TABLE(submitter_percent INTEGER, nonprofit_percent INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT tsc.submitter_percent, tsc.nonprofit_percent
  FROM tip_split_configs tsc
  WHERE tsc.campaign_id = p_campaign_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 100::INTEGER, 0::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to update distribution totals on submissions
CREATE OR REPLACE FUNCTION update_submission_distribution_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' THEN
    UPDATE submissions
    SET 
      total_distributed = COALESCE(total_distributed, 0) + NEW.submitter_amount + NEW.nonprofit_amount,
      tips_distributed = CASE 
        WHEN NEW.distribution_type = 'tips' THEN COALESCE(tips_distributed, 0) + NEW.total_amount
        ELSE COALESCE(tips_distributed, 0)
      END,
      last_distribution_at = NEW.confirmed_at,
      updated_at = NOW()
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update totals when distribution is confirmed
DROP TRIGGER IF EXISTS trigger_update_distribution_totals ON distributions;
CREATE TRIGGER trigger_update_distribution_totals
  AFTER UPDATE OF status ON distributions
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status != 'confirmed')
  EXECUTE FUNCTION update_submission_distribution_totals();

-- 7. RLS Policies for distributions table
ALTER TABLE distributions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (safe now that table exists)
DROP POLICY IF EXISTS admin_distributions_all ON distributions;
CREATE POLICY admin_distributions_all ON distributions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')
    )
  );

-- 8. RLS Policies for tip_split_configs table
ALTER TABLE tip_split_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (safe now that table exists)
DROP POLICY IF EXISTS admin_tip_split_all ON tip_split_configs;
CREATE POLICY admin_tip_split_all ON tip_split_configs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'admin')
    )
  );

-- ============================================
-- End of migration
-- ============================================
