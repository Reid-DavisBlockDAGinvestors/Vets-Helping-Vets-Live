-- Add first_name and last_name columns to community_profiles
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
