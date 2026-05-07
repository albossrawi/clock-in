# Mobile app

Expo (React Native) app for employees and admins.

## Run

```bash
cd mobile
npm install
cp .env.example .env
# edit .env with your Supabase URL + anon key
npx expo start
```

Open the QR code in **Expo Go** on iPhone/Android.

## Notable files

- `src/lib/supabase.ts` — Supabase client with secure-storage adapter for session persistence
- `src/lib/notifications.ts` — local notification scheduling helpers
- `src/contexts/AuthContext.tsx` — session + profile, `signIn`, `signOut`, `changePassword`
- `src/screens/HomeScreen.tsx` — clock in/out, break countdown
- `src/screens/SettingsScreen.tsx` — change password, log out
- `src/screens/AdminScreen.tsx` — read-only daily summary (admins only)

## Notifications

Both the **shift-end** reminder (clock-in + 7.5h) and the **break-end** alert
(break start + 30 min) use `expo-notifications` local scheduling, so they fire
even when the app is backgrounded or closed. Permissions are requested on first
launch.
