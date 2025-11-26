-- Contracts registry so admin can name each on-chain contract
create table if not exists public.nft_contracts (
  id uuid primary key default gen_random_uuid(),
  address text not null unique,
  label text,
  notes text,
  created_at timestamp with time zone not null default now()
);

-- Extend submissions with on-chain linkage and marketplace visibility
alter table if exists public.submissions
  add column if not exists contract_address text,
  add column if not exists visible_on_marketplace boolean not null default true;
