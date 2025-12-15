-- Fix: Allow creator_wallet to be null (users can add wallet later)
-- Run this in Supabase SQL Editor

ALTER TABLE submissions ALTER COLUMN creator_wallet DROP NOT NULL;
