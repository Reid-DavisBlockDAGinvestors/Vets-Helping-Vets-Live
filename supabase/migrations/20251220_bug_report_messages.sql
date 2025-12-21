-- Bug Report Messages table for user-admin communication
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS bug_report_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Link to bug report
  bug_report_id UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
  
  -- Who sent the message
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_email TEXT,
  sender_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  
  -- Message content
  message TEXT NOT NULL,
  
  -- Read status
  read_at TIMESTAMPTZ,
  read_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bug_report_messages_report_id ON bug_report_messages(bug_report_id);
CREATE INDEX IF NOT EXISTS idx_bug_report_messages_created_at ON bug_report_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_bug_report_messages_sender_id ON bug_report_messages(sender_id);

-- RLS policies
ALTER TABLE bug_report_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages on their own bug reports
CREATE POLICY "Users can view messages on own reports" ON bug_report_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bug_reports 
      WHERE bug_reports.id = bug_report_messages.bug_report_id 
      AND (bug_reports.user_id = auth.uid() OR bug_reports.user_id IS NULL)
    )
  );

-- Users can insert messages on their own bug reports
CREATE POLICY "Users can add messages to own reports" ON bug_report_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bug_reports 
      WHERE bug_reports.id = bug_report_messages.bug_report_id 
      AND (bug_reports.user_id = auth.uid() OR bug_reports.user_id IS NULL)
    )
  );

-- Add email_notifications column to bug_reports if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bug_reports' AND column_name = 'email_notifications'
  ) THEN
    ALTER TABLE bug_reports ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Add last_admin_response column to track when admin last responded
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bug_reports' AND column_name = 'last_admin_response_at'
  ) THEN
    ALTER TABLE bug_reports ADD COLUMN last_admin_response_at TIMESTAMPTZ;
  END IF;
END $$;
