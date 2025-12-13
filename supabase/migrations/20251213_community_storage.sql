-- Create storage bucket for community uploads
-- Run this in Supabase Dashboard > Storage > New Bucket

-- Bucket name: community
-- Public: Yes (for avatar URLs to work)
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- After creating the bucket, add these policies:

-- Policy 1: Allow authenticated users to upload
-- Name: Allow authenticated uploads
-- Allowed operation: INSERT
-- Target roles: authenticated
-- WITH CHECK expression: (auth.uid() = (storage.foldername(name))[1]::uuid)

-- Policy 2: Allow public read access
-- Name: Allow public read
-- Allowed operation: SELECT
-- Target roles: public
-- USING expression: true

-- Policy 3: Allow users to update their own files
-- Name: Allow users to update own
-- Allowed operation: UPDATE
-- Target roles: authenticated
-- USING expression: (auth.uid() = (storage.foldername(name))[1]::uuid)

-- Policy 4: Allow users to delete their own files
-- Name: Allow users to delete own
-- Allowed operation: DELETE  
-- Target roles: authenticated
-- USING expression: (auth.uid() = (storage.foldername(name))[1]::uuid)

-- Note: The folder structure is: {user_id}/{type}_{timestamp}.{ext}
-- This allows each user to manage their own files
