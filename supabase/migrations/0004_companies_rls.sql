-- Updated RLS for multi-tenancy.
-- Three roles:
--   employee    : sees own data only
--   admin       : sees all data within their company
--   super_admin : sees everything across all companies

-- ---------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

-- is_admin() now includes super_admin so existing checks keep working.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

-- ---------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------
alter table public.companies enable row level security;

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select using (
    public.is_super_admin()
    or id = public.current_company_id()
  );

drop policy if exists companies_admin_update_own on public.companies;
create policy companies_admin_update_own on public.companies
  for update using (public.is_admin() and id = public.current_company_id())
  with check (public.is_admin() and id = public.current_company_id());

drop policy if exists companies_super on public.companies;
create policy companies_super on public.companies
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------
-- profiles (replace prior policies)
-- ---------------------------------------------------------------
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;

create policy profiles_select on public.profiles
  for select using (
    public.is_super_admin()
    or id = auth.uid()
    or (public.is_admin() and company_id = public.current_company_id())
  );

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    -- prevent self-promoting role or jumping companies
    and role = (select role from public.profiles where id = auth.uid())
    and company_id is not distinct from (select company_id from public.profiles where id = auth.uid())
  );

create policy profiles_admin_company on public.profiles
  for all using (public.is_admin() and company_id = public.current_company_id())
  with check (public.is_admin() and company_id = public.current_company_id());

create policy profiles_super on public.profiles
  for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------------------------------------------------------------
-- time_entries (replace prior policies)
-- ---------------------------------------------------------------
drop policy if exists time_entries_select_own on public.time_entries;
drop policy if exists time_entries_insert_own on public.time_entries;
drop policy if exists time_entries_update_own on public.time_entries;
drop policy if exists time_entries_delete_admin on public.time_entries;

create policy time_entries_select on public.time_entries
  for select using (
    public.is_super_admin()
    or user_id = auth.uid()
    or (public.is_admin() and company_id = public.current_company_id())
  );

create policy time_entries_insert on public.time_entries
  for insert with check (
    public.is_super_admin()
    or user_id = auth.uid()
    or (public.is_admin() and exists (
      select 1 from public.profiles p
      where p.id = user_id and p.company_id = public.current_company_id()
    ))
  );

create policy time_entries_update on public.time_entries
  for update using (
    public.is_super_admin()
    or user_id = auth.uid()
    or (public.is_admin() and company_id = public.current_company_id())
  )
  with check (
    public.is_super_admin()
    or user_id = auth.uid()
    or (public.is_admin() and company_id = public.current_company_id())
  );

create policy time_entries_delete on public.time_entries
  for delete using (
    public.is_super_admin()
    or (public.is_admin() and company_id = public.current_company_id())
  );

-- ---------------------------------------------------------------
-- breaks (replace prior policies — checked via parent time_entry)
-- ---------------------------------------------------------------
drop policy if exists breaks_select_own on public.breaks;
drop policy if exists breaks_insert_own on public.breaks;
drop policy if exists breaks_update_own on public.breaks;
drop policy if exists breaks_delete_admin on public.breaks;

create policy breaks_select on public.breaks
  for select using (
    public.is_super_admin()
    or exists (
      select 1 from public.time_entries t
      where t.id = breaks.time_entry_id
        and (t.user_id = auth.uid()
             or (public.is_admin() and t.company_id = public.current_company_id()))
    )
  );

create policy breaks_insert on public.breaks
  for insert with check (
    public.is_super_admin()
    or exists (
      select 1 from public.time_entries t
      where t.id = time_entry_id
        and (t.user_id = auth.uid()
             or (public.is_admin() and t.company_id = public.current_company_id()))
    )
  );

create policy breaks_update on public.breaks
  for update using (
    public.is_super_admin()
    or exists (
      select 1 from public.time_entries t
      where t.id = breaks.time_entry_id
        and (t.user_id = auth.uid()
             or (public.is_admin() and t.company_id = public.current_company_id()))
    )
  );

create policy breaks_delete on public.breaks
  for delete using (
    public.is_super_admin()
    or exists (
      select 1 from public.time_entries t
      where t.id = breaks.time_entry_id
        and public.is_admin() and t.company_id = public.current_company_id()
    )
  );
