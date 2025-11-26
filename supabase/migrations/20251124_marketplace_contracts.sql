-- Contracts that are allowed/visible in the public marketplace
create table if not exists public.marketplace_contracts (
  contract_address text primary key,
  label text,
  enabled boolean not null default true,
  created_at timestamp with time zone not null default now()
);

-- Simple index to speed up filtering by enabled flag
create index if not exists marketplace_contracts_enabled_idx on public.marketplace_contracts(enabled);

-- For now, keep it simple: no RLS (admin-only access via service role in server endpoints)
alter table if exists public.marketplace_contracts disable row level security;
