-- Queue for background cleanup of external assets (e.g., IPFS/Storacha)
create table if not exists public.cleanup_tasks (
  id uuid primary key default gen_random_uuid(),
  uri text not null,
  asset_type text, -- 'image' | 'metadata' | null
  status text not null default 'queued', -- queued | done | failed | skipped
  attempts integer not null default 0,
  last_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists cleanup_tasks_status_idx on public.cleanup_tasks(status);

-- Keep it simple: no RLS for this queue (service role only via server endpoints)
alter table if exists public.cleanup_tasks disable row level security;

-- Trigger to update updated_at
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists set_cleanup_tasks_updated_at on public.cleanup_tasks;
create trigger set_cleanup_tasks_updated_at
before update on public.cleanup_tasks
for each row execute function public.set_updated_at();



