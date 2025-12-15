-- Bug Reports table for user feedback and debugging
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- User info (nullable for anonymous reports)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  wallet_address TEXT,
  
  -- Report content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  expected_behavior TEXT,
  
  -- Screenshots (stored as URLs to Supabase Storage)
  screenshots JSONB DEFAULT '[]'::jsonb,
  
  -- Context captured automatically
  page_url TEXT,
  user_agent TEXT,
  screen_size TEXT,
  browser_console_logs JSONB,
  
  -- Metadata for debugging
  app_version TEXT,
  environment TEXT DEFAULT 'production',
  
  -- Status tracking
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'in_progress', 'resolved', 'wont_fix', 'duplicate')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Resolution
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Tags for categorization
  tags TEXT[] DEFAULT '{}'::text[],
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'purchase', 'submission', 'wallet', 'auth', 'display', 'performance', 'other'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_category ON bug_reports(category);
CREATE INDEX IF NOT EXISTS idx_bug_reports_priority ON bug_reports(priority);

-- RLS policies
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own bug reports
CREATE POLICY "Users can create bug reports" ON bug_reports
  FOR INSERT WITH CHECK (true);

-- Users can view their own bug reports
CREATE POLICY "Users can view own bug reports" ON bug_reports
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all bug reports (handled via service role key in API)

-- Storage bucket for screenshots
-- Run this separately or in Supabase dashboard:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('bug-screenshots', 'bug-screenshots', true);
