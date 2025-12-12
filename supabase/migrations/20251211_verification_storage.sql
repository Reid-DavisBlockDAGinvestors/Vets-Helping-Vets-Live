-- Create storage bucket for verification documents
-- This bucket stores sensitive identity documents (selfies, IDs, supporting docs)

-- Note: Storage bucket creation is typically done via Supabase Dashboard or CLI
-- This SQL creates the bucket policies assuming the bucket already exists

-- RLS Policies for verification-docs bucket:
-- 1. Only authenticated users can upload to their own folder
-- 2. Only admins/service role can read documents

-- If bucket doesn't exist, create it via Supabase Dashboard:
-- 1. Go to Storage in your Supabase project
-- 2. Click "New bucket"
-- 3. Name: verification-docs
-- 4. Make it PRIVATE (not public)
-- 5. Enable RLS

-- These policies should be applied after bucket creation:

-- Allow authenticated users to upload files
-- Note: Users can only upload to folders prefixed with their wallet address
-- CREATE POLICY "Users can upload verification docs"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'verification-docs' 
--   AND auth.role() = 'authenticated'
-- );

-- Allow service role to read all documents (for admin verification)
-- The service role bypasses RLS, so admins using supabaseAdmin can read everything

-- For now, we'll rely on the service role key for uploads/reads
-- This keeps documents private and only accessible through our API
