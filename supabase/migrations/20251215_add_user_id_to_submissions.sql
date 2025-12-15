-- Add user_id column to submissions table to link with auth.users
-- Run this in Supabase SQL Editor

-- Add the user_id column (nullable for backwards compatibility with existing submissions)
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);

-- Also ensure creator_wallet is nullable (in case previous migration wasn't run)
ALTER TABLE submissions ALTER COLUMN creator_wallet DROP NOT NULL;
