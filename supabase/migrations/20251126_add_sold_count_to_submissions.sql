-- Track how many copies have been sold per fundraiser submission
alter table if exists public.submissions
  add column if not exists sold_count integer not null default 0;
