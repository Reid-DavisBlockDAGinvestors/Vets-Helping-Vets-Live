-- Add email column to purchases table for tracking buyer emails
-- Run this in Supabase SQL Editor

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_purchases_email ON purchases(email);

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'purchases';
