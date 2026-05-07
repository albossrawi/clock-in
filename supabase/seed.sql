-- Seed data for local testing.
-- NOTE: creating auth.users via SQL is only safe in a local Supabase or fresh project.
-- For real projects, create users from the Supabase dashboard or with the Admin API.

-- Admin user
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'admin@example.com',
  crypt('Admin123!', gen_salt('bf')),
  now(),
  '{"full_name":"Admin User","role":"admin"}'::jsonb,
  now(), now()
)
on conflict (id) do nothing;

-- Employee user
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000002',
  'authenticated',
  'authenticated',
  'employee@example.com',
  crypt('Employee123!', gen_salt('bf')),
  now(),
  '{"full_name":"Sample Employee","role":"employee"}'::jsonb,
  now(), now()
)
on conflict (id) do nothing;

-- Make sure profile rows reflect the role from metadata (the trigger handles new inserts;
-- this update is a safety net if the rows already existed with default role).
update public.profiles set role = 'admin', full_name = 'Admin User'
where id = '00000000-0000-0000-0000-000000000001';

update public.profiles set role = 'employee', full_name = 'Sample Employee'
where id = '00000000-0000-0000-0000-000000000002';
