-- Admin Audit Logs Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_actor ON admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON admin_audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies: Only admins can read, service role can write
DROP POLICY IF EXISTS "Admins can read audit logs" ON admin_audit_logs;
DROP POLICY IF EXISTS "Service role full access audit" ON admin_audit_logs;

CREATE POLICY "Admins can read audit logs" ON admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Service role full access audit" ON admin_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment
COMMENT ON TABLE admin_audit_logs IS 'Audit log for admin actions for compliance';
