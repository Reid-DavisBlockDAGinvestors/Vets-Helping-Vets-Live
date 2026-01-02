-- Admin Security Tables Migration
-- Supports Token Management and Security Controls panels

-- ============================================
-- 1. Blacklisted Addresses Table
-- ============================================
CREATE TABLE IF NOT EXISTS blacklisted_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address VARCHAR(42) NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 1043,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(address, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_blacklisted_chain ON blacklisted_addresses(chain_id);
CREATE INDEX IF NOT EXISTS idx_blacklisted_address ON blacklisted_addresses(address);

-- ============================================
-- 2. Admin Audit Log Table
-- ============================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON admin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at);

-- ============================================
-- 3. Token Actions Log Table
-- ============================================
CREATE TABLE IF NOT EXISTS token_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id INTEGER NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 1043,
  contract_version VARCHAR(20) NOT NULL DEFAULT 'v6',
  action VARCHAR(50) NOT NULL, -- 'freeze', 'unfreeze', 'soulbound', 'burn', 'fix_uri'
  performed_by UUID REFERENCES auth.users(id),
  tx_hash VARCHAR(66),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_actions_token ON token_actions_log(token_id);
CREATE INDEX IF NOT EXISTS idx_token_actions_chain ON token_actions_log(chain_id);
CREATE INDEX IF NOT EXISTS idx_token_actions_action ON token_actions_log(action);

-- ============================================
-- 4. Contract Settings Cache
-- ============================================
CREATE TABLE IF NOT EXISTS contract_settings_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id INTEGER NOT NULL,
  contract_version VARCHAR(20) NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  is_paused BOOLEAN DEFAULT false,
  owner_address VARCHAR(42),
  platform_treasury VARCHAR(42),
  platform_fee_bps INTEGER DEFAULT 100,
  bug_bounty_pool_wei VARCHAR(78),
  total_campaigns INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chain_id, contract_version)
);

CREATE INDEX IF NOT EXISTS idx_contract_cache_chain ON contract_settings_cache(chain_id);

-- ============================================
-- 5. RLS Policies
-- ============================================

-- Blacklisted addresses: Only admins can view/modify
ALTER TABLE blacklisted_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY blacklist_admin_all ON blacklisted_addresses
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Audit log: Only admins can view, only system can insert
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_admin_view ON admin_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY audit_admin_insert ON admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Token actions: Only admins can view/modify
ALTER TABLE token_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY token_actions_admin_all ON token_actions_log
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Contract settings cache: Anyone can view, only admins can modify
ALTER TABLE contract_settings_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY contract_cache_view ON contract_settings_cache
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY contract_cache_admin_modify ON contract_settings_cache
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('super_admin', 'admin')
    )
  );
