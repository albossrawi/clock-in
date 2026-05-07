-- Row Level Security
-- Employees can read/write their own data. Admins can read/write everything.

-- ---------------------------------------------------------------
-- helper: is the calling user an admin?
-- security definer so the lookup itself bypasses RLS and avoids recursion.
-- ---------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- time_entries
-- ---------------------------------------------------------------
alter table public.time_entries enable row level security;

drop policy if exists time_entries_select_own on public.time_entries;
create policy time_entries_select_own on public.time_entries
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists time_entries_insert_own on public.time_entries;
create policy time_entries_insert_own on public.time_entries
  for insert with check (user_id = auth.uid() or public.is_admin());

drop policy if exists time_entries_update_own on public.time_entries;
create policy time_entries_update_own on public.time_entries
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists time_entries_delete_admin on public.time_entries;
create policy time_entries_delete_admin on public.time_entries
  for delete using (public.is_admin());

-- ---------------------------------------------------------------
-- breaks
-- ---------------------------------------------------------------
alter table public.breaks enable row level security;

drop policy if exists breaks_select_own on public.breaks;
create policy breaks_select_own on public.breaks
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.time_entries t
      where t.id = breaks.time_entry_id and t.user_id = auth.uid()
    )
  );

drop policy if exists breaks_insert_own on public.breaks;
create policy breaks_insert_own on public.breaks
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.time_entries t
      where t.id = breaks.time_entry_id and t.user_id = auth.uid()
    )
  );

drop policy if exists breaks_update_own on public.breaks;
create policy breaks_update_own on public.breaks
  for update using (
    public.is_admin()
    or exists (
      select 1 from public.time_entries t
      where t.id = breaks.time_entry_id and t.user_id = auth.uid()
    )
  );

drop policy if exists breaks_delete_admin on public.breaks;
create policy breaks_delete_admin on public.breaks
  for delete using (public.is_admin());
