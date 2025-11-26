-- Add username column if missing
alter table if exists public.profiles
  add column if not exists username text;

-- Unique index on username, ignoring nulls
create unique index if not exists profiles_username_unique on public.profiles (username) where username is not null;

-- Ensure RLS is enabled (no-op if already enabled)
alter table if exists public.profiles enable row level security;

-- Policy: authenticated users can read any username/email/role
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_authenticated'
  ) then
    create policy profiles_select_authenticated on public.profiles
      for select
      to authenticated
      using (true);
  end if;
end $$;

-- Policy: users can update only their own row
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own on public.profiles
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

-- Optional: allow users to insert their profile row with their uid (safe if you create via sign-up trigger)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own'
  ) then
    create policy profiles_insert_own on public.profiles
      for insert
      to authenticated
      with check (auth.uid() = id);
  end if;
end $$;
