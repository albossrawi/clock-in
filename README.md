# Clock-in

Employee clock-in / clock-out system with mobile app, web admin dashboard, and Supabase backend.

## Workspaces

| Path          | Purpose                                                |
| ------------- | ------------------------------------------------------ |
| `mobile/`     | Expo (React Native) app — employee clock in/out, breaks |
| `web-admin/`  | Next.js dashboard — admin view, edit, export           |
| `supabase/`   | SQL migrations, RLS policies, seed data                |

## Features

**Mobile app (employees)**

- Single sign-in (session persisted via secure storage)
- Clock In / Clock Out with timestamp persisted to database
- Break button starts a 30-minute countdown; local notification fires when break ends
- Local notification fires after 7.5 hours reminding the user to clock out
- Settings: change password, log out
- Admins see an extra read-only daily summary tab

**Web admin dashboard**

- View all time entries (filter by user / date)
- Edit and delete entries
- Invite new employees (creates Supabase auth user + profile)
- Export current view to Excel (`.xlsx`) or PDF

## Setup

### 1. Supabase project

1. Create a project at <https://supabase.com>.
2. From SQL editor, run files from `supabase/migrations/` in order, then `supabase/seed.sql` for a starter admin.
3. Copy the project URL and `anon` key — both apps need them.

### 2. Mobile app

```bash
cd mobile
npm install
cp .env.example .env          # paste Supabase URL + anon key
npx expo start
```

Open the QR code in the Expo Go app on your phone (iOS or Android).

### 3. Web admin

```bash
cd web-admin
npm install
cp .env.example .env.local    # paste Supabase URL + anon key
npm run dev
```

Open <http://localhost:3000>.

## Default credentials (seed)

After running `supabase/seed.sql`:

- Admin: `admin@example.com` / `Admin123!`
- Employee: `employee@example.com` / `Employee123!`

Change these immediately in production.

## Branch

All development happens on `claude/employee-clock-app-r5Eqg`.
