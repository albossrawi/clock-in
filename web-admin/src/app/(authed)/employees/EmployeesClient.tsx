'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  shift_length_minutes: number;
  break_length_minutes: number;
}

export default function EmployeesClient({ initialProfiles }: { initialProfiles: Profile[] }) {
  const supabase = createClient();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [showInvite, setShowInvite] = useState(false);

  const reload = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_active, shift_length_minutes, break_length_minutes')
      .order('full_name');
    setProfiles(data ?? []);
  };

  const toggleActive = async (p: Profile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !p.is_active })
      .eq('id', p.id);
    if (error) {
      alert(error.message);
      return;
    }
    setProfiles((all) => all.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <button
          onClick={() => setShowInvite(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 hover:bg-blue-500"
        >
          Invite employee
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Shift / Break (min)</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-t border-slate-800">
                <td className="px-4 py-3">{p.full_name ?? p.id.slice(0, 8)}</td>
                <td className="px-4 py-3 capitalize">{p.role}</td>
                <td className="px-4 py-3">
                  {p.shift_length_minutes} / {p.break_length_minutes}
                </td>
                <td className="px-4 py-3">
                  {p.is_active ? (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">Active</span>
                  ) : (
                    <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-slate-300">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleActive(p)}
                    className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
                  >
                    {p.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onCreated={reload} />}
    </div>
  );
}

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [tempPassword, setTempPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, full_name: name, role, password: tempPassword }),
    });
    setBusy(false);
    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({ error: 'Request failed' }))) as { error: string };
      setErr(error);
      return;
    }
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-2xl bg-slate-800 p-6 shadow-xl">
        <h2 className="text-xl font-semibold">Invite employee</h2>

        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded bg-slate-900 px-3 py-2"
        />
        <input
          required
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded bg-slate-900 px-3 py-2"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'employee' | 'admin')}
          className="w-full rounded bg-slate-900 px-3 py-2"
        >
          <option value="employee">Employee</option>
          <option value="admin">Admin</option>
        </select>
        <input
          required
          minLength={8}
          placeholder="Initial password (min 8 chars)"
          value={tempPassword}
          onChange={(e) => setTempPassword(e.target.value)}
          className="w-full rounded bg-slate-900 px-3 py-2"
        />
        <p className="text-xs text-slate-400">
          Share these credentials with the employee. They can change the password from the mobile app&apos;s settings.
        </p>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-blue-600 px-4 py-2 hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
