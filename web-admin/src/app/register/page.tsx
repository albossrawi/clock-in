'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [form, setForm] = useState({
    company_name: '',
    address: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const { error: e } = (await res.json().catch(() => ({ error: 'Request failed' }))) as { error: string };
      setError(e);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl bg-slate-800 p-8 shadow-xl text-center">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="mt-3 text-slate-400">
            We sent a confirmation link to <span className="text-slate-100">{form.contact_email}</span>.
            Click it to verify your address, then sign in.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-full bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-2xl bg-slate-800 p-8 shadow-xl">
        <div>
          <h1 className="text-3xl font-bold">Register your company</h1>
          <p className="mt-1 text-sm text-slate-400">
            You'll be the company's first admin. Invite employees after signing in.
          </p>
        </div>

        <Field label="Company name">
          <input required value={form.company_name} onChange={set('company_name')} className={input} />
        </Field>
        <Field label="Address">
          <input value={form.address} onChange={set('address')} className={input} />
        </Field>
        <Field label="Contact person">
          <input required value={form.contact_name} onChange={set('contact_name')} className={input} />
        </Field>
        <Field label="Contact email">
          <input
            required
            type="email"
            autoComplete="email"
            value={form.contact_email}
            onChange={set('contact_email')}
            className={input}
          />
        </Field>
        <Field label="Phone">
          <input value={form.contact_phone} onChange={set('contact_phone')} className={input} />
        </Field>
        <Field label="Password (8+ chars)">
          <input
            required
            type="password"
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            className={input}
          />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-blue-600 py-3 font-semibold hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create company'}
        </button>

        <p className="pt-2 text-center text-sm text-slate-400">
          Already have an account? <Link href="/login" className="text-blue-400 hover:underline">Sign in</Link>
        </p>
      </form>
    </main>
  );
}

const input = 'w-full rounded-lg bg-slate-900 px-4 py-2.5 outline-none ring-1 ring-slate-700 focus:ring-blue-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
