-- Create storage bucket for community uploads
-- Run this in Supabase SQL Editor

-- Step 1: Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community',
  'community',
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Step 2: Create RLS policies for the storage.objects table

-- Policy: Allow public read access to community bucket
DROP POLICY IF EXISTS "Public read community" ON storage.objects;
CREATE POLICY "Public read community" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'community');

-- Policy: Allow authenticated users to upload to community bucket
DROP POLICY IF EXISTS "Authenticated upload community" ON storage.objects;
CREATE POLICY "Authenticated upload community" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'community');

-- Policy: Allow users to update their own files
DROP POLICY IF EXISTS "Users update own community" ON storage.objects;
CREATE POLICY "Users update own community" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'community' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Allow users to delete their own files
DROP POLICY IF EXISTS "Users delete own community" ON storage.objects;
CREATE POLICY "Users delete own community" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'community' AND auth.uid()::text = (storage.foldername(name))[1]);
