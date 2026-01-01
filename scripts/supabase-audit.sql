-- ============================================
-- SUPABASE DATABASE AUDIT SCRIPT
-- Run this in Supabase SQL Editor to audit all tables
-- Generated: Jan 1, 2026
-- ============================================

-- 1. List all tables in public schema
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Check SUBMISSIONS table structure
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'submissions' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check PURCHASES table structure
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'purchases' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check EVENTS table structure
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'events' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Check PROFILES table structure
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Check CONTRACTS table (may not exist yet)
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'contracts' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Check CHAIN_CONFIGS table (may not exist yet)
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'chain_configs' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. Check CAMPAIGN_UPDATES table structure
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'campaign_updates' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 9. Check COMMUNITY_POSTS table structure
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'community_posts' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 10. Check BUG_REPORTS table structure
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'bug_reports' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 11. Row counts for key tables
SELECT 'submissions' as table_name, COUNT(*) as row_count FROM submissions
UNION ALL SELECT 'purchases', COUNT(*) FROM purchases
UNION ALL SELECT 'events', COUNT(*) FROM events
UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'campaign_updates', COUNT(*) FROM campaign_updates;

-- 12. Check for missing columns that should exist
-- Expected columns in SUBMISSIONS:
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='submissions' AND column_name='chain_id') THEN '✓' ELSE '✗' END as chain_id,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='submissions' AND column_name='chain_name') THEN '✓' ELSE '✗' END as chain_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='submissions' AND column_name='contract_version') THEN '✓' ELSE '✗' END as contract_version,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='submissions' AND column_name='contract_address') THEN '✓' ELSE '✗' END as contract_address,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='submissions' AND column_name='campaign_id') THEN '✓' ELSE '✗' END as campaign_id,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='submissions' AND column_name='tx_hash') THEN '✓' ELSE '✗' END as tx_hash;

-- Expected columns in PURCHASES:
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='chain_id') THEN '✓' ELSE '✗' END as chain_id,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='donor_note') THEN '✓' ELSE '✗' END as donor_note,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='donor_name') THEN '✓' ELSE '✗' END as donor_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='tip_bdag') THEN '✓' ELSE '✗' END as tip_bdag,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases' AND column_name='tip_usd') THEN '✓' ELSE '✗' END as tip_usd;

-- 13. Check if tables exist
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='contracts' AND table_schema='public') THEN '✓ EXISTS' ELSE '✗ MISSING' END as contracts_table,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='chain_configs' AND table_schema='public') THEN '✓ EXISTS' ELSE '✗ MISSING' END as chain_configs_table,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='submissions' AND table_schema='public') THEN '✓ EXISTS' ELSE '✗ MISSING' END as submissions_table,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='purchases' AND table_schema='public') THEN '✓ EXISTS' ELSE '✗ MISSING' END as purchases_table,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='events' AND table_schema='public') THEN '✓ EXISTS' ELSE '✗ MISSING' END as events_table,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='profiles' AND table_schema='public') THEN '✓ EXISTS' ELSE '✗ MISSING' END as profiles_table;
