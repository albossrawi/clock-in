-- Seed data for local testing.
-- NOTE: creating auth.users via SQL is only safe in a local Supabase or fresh project.
-- For real projects, create users from the Supabase dashboard or with the Admin API.

-- ---------------------------------------------------------------
-- Master account (super_admin) — manages every company
-- ---------------------------------------------------------------
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'master@example.com',
  crypt('Master123!', gen_salt('bf')),
  now(),
  '{"full_name":"Master Admin","role":"super_admin"}'::jsonb,
  now(), now()
)
on conflict (id) do nothing;

update public.profiles set role = 'super_admin', full_name = 'Master Admin', company_id = null
where id = '00000000-0000-0000-0000-000000000000';

-- ---------------------------------------------------------------
-- Sample company "Acme Corp" with one admin and one employee
-- ---------------------------------------------------------------
insert into public.companies (id, name, address, contact_name, contact_email, contact_phone)
values (
  '11111111-1111-1111-1111-111111111111',
  'Acme Corp',
  '123 Main St, Springfield',
  'Admin User',
  'admin@example.com',
  '+1 555-0100'
)
on conflict (id) do nothing;

-- Company admin
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'admin@example.com',
  crypt('Admin123!', gen_salt('bf')),
  now(),
  '{"full_name":"Admin User","role":"admin","company_id":"11111111-1111-1111-1111-111111111111"}'::jsonb,
  now(), now()
)
on conflict (id) do nothing;

update public.profiles
  set role = 'admin',
      full_name = 'Admin User',
      company_id = '11111111-1111-1111-1111-111111111111'
where id = '00000000-0000-0000-0000-000000000001';

-- Sample employee
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated',
  'employee@example.com',
  crypt('Employee123!', gen_salt('bf')),
  now(),
  '{"full_name":"Sample Employee","role":"employee","company_id":"11111111-1111-1111-1111-111111111111"}'::jsonb,
  now(), now()
)
on conflict (id) do nothing;

update public.profiles
  set role = 'employee',
      full_name = 'Sample Employee',
      company_id = '11111111-1111-1111-1111-111111111111'
where id = '00000000-0000-0000-0000-000000000002';
