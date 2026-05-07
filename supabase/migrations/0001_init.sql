-- Clock-in schema
-- Run after a fresh Supabase project. Idempotent where reasonable.

-- ---------------------------------------------------------------
-- profiles: extends auth.users with role + per-employee settings
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'employee' check (role in ('employee', 'admin')),
  shift_length_minutes int not null default 450,   -- 7.5 hours
  break_length_minutes int not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- time_entries: one row per shift (clock in -> clock out)
-- ---------------------------------------------------------------
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists time_entries_user_id_idx on public.time_entries(user_id);
create index if not exists time_entries_clock_in_idx on public.time_entries(clock_in_at desc);

-- At most one open shift per user.
create unique index if not exists time_entries_one_open_per_user
  on public.time_entries(user_id)
  where clock_out_at is null;

-- ---------------------------------------------------------------
-- breaks: zero or more per shift
-- ---------------------------------------------------------------
create table if not exists public.breaks (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists breaks_time_entry_id_idx on public.breaks(time_entry_id);

-- ---------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists time_entries_set_updated_at on public.time_entries;
create trigger time_entries_set_updated_at
before update on public.time_entries
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- New auth.users automatically get a profile row
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
