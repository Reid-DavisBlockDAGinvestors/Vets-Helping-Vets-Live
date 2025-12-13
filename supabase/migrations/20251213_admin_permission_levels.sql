-- Update profiles table to support permission levels
-- Roles: super_admin, admin, moderator, viewer, user

-- Add role column if it doesn't exist (it should already exist)
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Update the check constraint to include new roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('super_admin', 'admin', 'moderator', 'viewer', 'user'));

-- Update existing 'admin' users to keep their role (no change needed)
-- The super_admin will be set via ADMIN_EMAIL env var in the code

-- Add requested_role column to admin_requests table
ALTER TABLE admin_requests ADD COLUMN IF NOT EXISTS requested_role TEXT DEFAULT 'admin';

-- Add constraint for requested_role
ALTER TABLE admin_requests DROP CONSTRAINT IF EXISTS admin_requests_role_check;
ALTER TABLE admin_requests ADD CONSTRAINT admin_requests_role_check 
  CHECK (requested_role IN ('admin', 'moderator', 'viewer'));
