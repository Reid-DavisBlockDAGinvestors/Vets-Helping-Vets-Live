-- Security Events Table for Audit Trail
-- Financial application compliance requires comprehensive security logging

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_email ON security_events(email);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created ON security_events(created_at DESC);
CREATE INDEX idx_security_events_ip ON security_events(ip_address);

-- Composite index for common queries
CREATE INDEX idx_security_events_user_type_created ON security_events(user_id, event_type, created_at DESC);

-- Enable RLS
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (backend only)
CREATE POLICY "Service role can insert security events"
  ON security_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only admins can read security events
CREATE POLICY "Admins can read security events"
  ON security_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
      AND admin_users.role IN ('super_admin', 'admin')
    )
  );

-- Add comment for documentation
COMMENT ON TABLE security_events IS 'Audit trail for all security-related events. Required for financial application compliance.';

-- Session tracking table for enhanced security
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active, expires_at);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages sessions"
  ON user_sessions FOR ALL
  TO service_role
  WITH CHECK (true);

-- Failed login attempts tracking
CREATE TABLE IF NOT EXISTS failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  attempt_count INTEGER DEFAULT 1,
  first_attempt TIMESTAMPTZ DEFAULT NOW(),
  last_attempt TIMESTAMPTZ DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  lockout_count INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX idx_failed_login_email ON failed_login_attempts(email);
CREATE INDEX idx_failed_login_ip ON failed_login_attempts(ip_address);
CREATE INDEX idx_failed_login_locked ON failed_login_attempts(locked_until) WHERE locked_until IS NOT NULL;

ALTER TABLE failed_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages failed logins"
  ON failed_login_attempts FOR ALL
  TO service_role
  WITH CHECK (true);

-- Function to clean up expired sessions and old security events
CREATE OR REPLACE FUNCTION cleanup_security_data()
RETURNS void AS $$
BEGIN
  -- Revoke expired sessions
  UPDATE user_sessions 
  SET is_active = false, revoked_at = NOW(), revoke_reason = 'expired'
  WHERE is_active = true AND expires_at < NOW();
  
  -- Delete security events older than 90 days (configurable retention)
  DELETE FROM security_events WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Delete old failed login attempts
  DELETE FROM failed_login_attempts 
  WHERE last_attempt < NOW() - INTERVAL '24 hours' 
  AND locked_until IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup (run via cron or Supabase Edge Function)
COMMENT ON FUNCTION cleanup_security_data IS 'Run periodically to clean up expired security data';
