-- Add first_name, last_name, company fields to submissions table for tax purposes
-- Run this in Supabase SQL Editor

-- Add new columns to submissions table
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS creator_first_name TEXT,
ADD COLUMN IF NOT EXISTS creator_last_name TEXT,
ADD COLUMN IF NOT EXISTS company TEXT;

-- Add indexes for searching
CREATE INDEX IF NOT EXISTS idx_submissions_first_name ON submissions(creator_first_name);
CREATE INDEX IF NOT EXISTS idx_submissions_last_name ON submissions(creator_last_name);
CREATE INDEX IF NOT EXISTS idx_submissions_company ON submissions(company);

-- Note: Supabase Auth user_metadata already stores first_name, last_name, company
-- from the signUp options.data parameter, so no migration needed for auth.users
