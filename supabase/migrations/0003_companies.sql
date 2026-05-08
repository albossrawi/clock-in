-- Multi-tenancy: companies + tenant scoping
-- Each profile (and indirectly every time_entry / break) belongs to a company.
-- super_admin is an exception: company_id is null and they see everything.

-- ---------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_is_active_idx on public.companies(is_active);

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- profiles: add company_id, allow 'super_admin' role
-- ---------------------------------------------------------------
alter table public.profiles
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

create index if not exists profiles_company_id_idx on public.profiles(company_id);

-- Replace the role check constraint to add 'super_admin'.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('employee', 'admin', 'super_admin'));

-- super_admin must NOT be tied to a company; admin/employee MUST be.
alter table public.profiles drop constraint if exists profiles_company_role_check;
alter table public.profiles
  add constraint profiles_company_role_check
  check (
    (role = 'super_admin' and company_id is null)
    or (role in ('admin', 'employee') and company_id is not null)
  ) not valid;
-- "not valid" so existing rows from migration 0001 don't block us; admin should
-- backfill them and then `alter table ... validate constraint profiles_company_role_check;`

-- ---------------------------------------------------------------
-- time_entries: denormalize company_id for cheaper RLS
-- ---------------------------------------------------------------
alter table public.time_entries
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

create index if not exists time_entries_company_id_idx on public.time_entries(company_id);

create or replace function public.set_time_entry_company_id()
returns trigger language plpgsql as $$
begin
  if new.company_id is null then
    new.company_id := (select company_id from public.profiles where id = new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists time_entries_set_company_id on public.time_entries;
create trigger time_entries_set_company_id
before insert on public.time_entries
for each row execute function public.set_time_entry_company_id();

-- ---------------------------------------------------------------
-- handle_new_user: read company_id + role from raw_user_meta_data
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_company_id uuid;
  meta_role text;
begin
  meta_company_id := nullif(new.raw_user_meta_data->>'company_id', '')::uuid;
  meta_role := coalesce(new.raw_user_meta_data->>'role', 'employee');

  insert into public.profiles (id, full_name, role, company_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    meta_role,
    case when meta_role = 'super_admin' then null else meta_company_id end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
