-- Add pricing and benchmarks fields to submissions
alter table if exists public.submissions
  add column if not exists price_per_copy numeric,
  add column if not exists num_copies integer,
  add column if not exists benchmarks jsonb;
