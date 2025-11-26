-- Records individual purchases/contributions towards a campaign/NFT
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  token_id integer not null,
  contract_address text,
  amount_gross numeric,
  amount_net numeric,
  card_fees numeric,
  nonprofit_fee numeric,
  is_onchain boolean not null default false,
  buyer_wallet text,
  payment_method text,
  payment_ref text,
  created_at timestamp with time zone not null default now()
);

alter table if exists public.contributions disable row level security;

create index if not exists contributions_token_id_idx on public.contributions(token_id);
