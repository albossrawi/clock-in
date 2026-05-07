# Supabase

## Apply migrations

In the Supabase SQL editor, run files in order:

1. `migrations/0001_init.sql` — tables, indexes, triggers
2. `migrations/0002_rls.sql` — row-level security policies
3. `seed.sql` — optional admin + employee accounts for testing

## Schema summary

- **profiles** — extends `auth.users` with `role` (`employee` | `admin`), `shift_length_minutes` (default 450 = 7.5h), `break_length_minutes` (default 30), `is_active`.
- **time_entries** — one row per shift. Unique partial index ensures a user has at most one open shift at a time.
- **breaks** — zero or more per shift. Cascade-deleted with the parent entry.

## RLS

- Employees can read/write their own `time_entries` and `breaks` and read/update their own profile.
- Admins (`profiles.role = 'admin'`) bypass those restrictions via `public.is_admin()`.
- Only admins can `delete` rows.

## Creating real users

Use the Supabase dashboard → Authentication → Users → "Add user", then in SQL:

```sql
update public.profiles set role = 'admin', full_name = 'Jane' where id = '<uuid>';
```

Or use the web admin's "Invite employee" flow once it's deployed.
