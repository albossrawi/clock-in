# Web admin

Next.js (App Router) dashboard for admins.

## Run

```bash
cd web-admin
npm install
cp .env.example .env.local
# fill in Supabase URL, anon key, and SERVICE ROLE key
npm run dev
```

Open <http://localhost:3000>.

## Environment

| Variable                          | Where it's used                          |
| --------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | Browser + server                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Browser + server                         |
| `SUPABASE_SERVICE_ROLE_KEY`       | **Server only.** Used by `/api/invite` to create new auth users. |

## Pages

- `/login` — email + password sign-in
- `/entries` — date + employee filters, edit, delete, export Excel/PDF
- `/employees` — invite, deactivate, reactivate

## Auth

`src/middleware.ts` refreshes the Supabase session on every request and forces unauthenticated visitors to `/login`. The `(authed)` layout additionally checks the caller has `role = 'admin'` in `profiles` — non-admins see an "access required" message.

## Exports

`src/lib/exports.ts` uses `xlsx` for `.xlsx` and `jspdf` + `jspdf-autotable` for PDFs. Exports always reflect the current filtered view.
