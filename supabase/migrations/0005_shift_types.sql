-- Shift types: per-company. Auto-classify each time_entry on clock-in.

-- ---------------------------------------------------------------
-- companies.timezone — needed to evaluate shift windows in local time.
-- ---------------------------------------------------------------
alter table public.companies
  add column if not exists timezone text not null default 'UTC';

-- ---------------------------------------------------------------
-- shift_types
-- ---------------------------------------------------------------
create table if not exists public.shift_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  days_of_week int[] not null default '{1,2,3,4,5,6,7}',  -- ISO: 1=Mon..7=Sun
  multiplier numeric(5,2) not null default 1.0,
  position int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shift_types_company_id_idx on public.shift_types(company_id);
create index if not exists shift_types_active_idx on public.shift_types(company_id, is_active, position);

drop trigger if exists shift_types_set_updated_at on public.shift_types;
create trigger shift_types_set_updated_at
before update on public.shift_types
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- time_entries.shift_type_id
-- ---------------------------------------------------------------
alter table public.time_entries
  add column if not exists shift_type_id uuid references public.shift_types(id) on delete set null;

create index if not exists time_entries_shift_type_idx on public.time_entries(shift_type_id);

-- ---------------------------------------------------------------
-- Combined defaults trigger:
--   1. company_id from the user's profile
--   2. shift_type_id from the matching active shift_type at clock_in_at
-- Replaces the old "set_time_entry_company_id" trigger.
-- ---------------------------------------------------------------
create or replace function public.set_time_entry_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_id uuid;
  tz text;
  ci_local timestamp;
  ci_time time;
  ci_dow int;
begin
  if new.company_id is null then
    new.company_id := (select company_id from public.profiles where id = new.user_id);
  end if;

  if new.shift_type_id is null and new.company_id is not null then
    select coalesce(timezone, 'UTC') into tz from public.companies where id = new.company_id;
    ci_local := (new.clock_in_at at time zone tz);
    ci_time := ci_local::time;
    ci_dow := extract(isodow from ci_local)::int;

    select id into matched_id
    from public.shift_types
    where company_id = new.company_id
      and is_active = true
      and ci_dow = any(days_of_week)
      and (
        (start_time <= end_time and ci_time >= start_time and ci_time < end_time)
        or
        (start_time > end_time and (ci_time >= start_time or ci_time < end_time))
      )
    order by position asc, name asc
    limit 1;

    new.shift_type_id := matched_id;
  end if;

  return new;
end;
$$;

drop trigger if exists time_entries_set_company_id on public.time_entries;
drop trigger if exists time_entries_set_defaults on public.time_entries;
create trigger time_entries_set_defaults
before insert on public.time_entries
for each row execute function public.set_time_entry_defaults();

-- ---------------------------------------------------------------
-- Seed default shift types whenever a new company is created.
-- Regular daytime hours (06:00–18:00 weekdays) intentionally have no
-- shift type — they're plain working hours and need no label.
-- ---------------------------------------------------------------
create or replace function public.seed_default_shift_types()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.shift_types (company_id, name, start_time, end_time, days_of_week, multiplier, position) values
    (new.id, 'Weekend', '00:00:00', '23:59:59', '{6,7}',           1.50,  1),
    (new.id, 'Night',   '23:00:00', '06:00:00', '{1,2,3,4,5,6,7}', 1.50, 10),
    (new.id, 'Evening', '18:00:00', '23:00:00', '{1,2,3,4,5,6,7}', 1.25, 11);
  return new;
end;
$$;

drop trigger if exists companies_seed_shift_types on public.companies;
create trigger companies_seed_shift_types
after insert on public.companies
for each row execute function public.seed_default_shift_types();

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table public.shift_types enable row level security;

drop policy if exists shift_types_select on public.shift_types;
create policy shift_types_select on public.shift_types
  for select using (
    public.is_super_admin()
    or company_id = public.current_company_id()
  );

drop policy if exists shift_types_admin on public.shift_types;
create policy shift_types_admin on public.shift_types
  for all using (
    public.is_super_admin()
    or (public.is_admin() and company_id = public.current_company_id())
  )
  with check (
    public.is_super_admin()
    or (public.is_admin() and company_id = public.current_company_id())
  );
