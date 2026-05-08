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
  scheduled_start: string | null;
  scheduled_end: string | null;
  scheduled_days: number[] | null;
}

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];

const SELECT =
  'id, full_name, role, is_active, shift_length_minutes, break_length_minutes, scheduled_start, scheduled_end, scheduled_days';

export default function EmployeesClient({ initialProfiles }: { initialProfiles: Profile[] }) {
  const supabase = createClient();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  const reload = async () => {
    const { data } = await supabase.from('profiles').select(SELECT).order('full_name');
    setProfiles((data as Profile[]) ?? []);
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
          className="rounded-full bg-blue-600 px-5 py-2 hover:bg-blue-500"
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
              <th className="px-4 py-3">Schedule</th>
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
                <td className="px-4 py-3 text-slate-300">
                  {p.scheduled_start && p.scheduled_end ? (
                    <div>
                      <div>
                        {p.scheduled_start.slice(0, 5)} – {p.scheduled_end.slice(0, 5)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {(p.scheduled_days ?? [])
                          .map((d) => DAYS.find((x) => x.value === d)?.label)
                          .filter(Boolean)
                          .join(', ') || 'no days'}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-500">Not set</span>
                  )}
                </td>
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
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    onClick={() => setEditing(p)}
                    className="mr-2 rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
                  >
                    Edit
                  </button>
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
      {editing && (
        <ScheduleModal
          profile={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setProfiles((all) => all.map((x) => (x.id === updated.id ? updated : x)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ScheduleModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved: (p: Profile) => void;
}) {
  const supabase = createClient();
  const [start, setStart] = useState(profile.scheduled_start?.slice(0, 5) ?? '09:00');
  const [end, setEnd] = useState(profile.scheduled_end?.slice(0, 5) ?? '17:00');
  const [days, setDays] = useState<number[]>(profile.scheduled_days ?? [1, 2, 3, 4, 5]);
  const [shiftMin, setShiftMin] = useState(profile.shift_length_minutes);
  const [breakMin, setBreakMin] = useState(profile.break_length_minutes);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleDay = (d: number) =>
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({
        scheduled_start: start + ':00',
        scheduled_end: end + ':00',
        scheduled_days: days,
        shift_length_minutes: shiftMin,
        break_length_minutes: breakMin,
      })
      .eq('id', profile.id)
      .select(SELECT)
      .single();
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSaved(data as Profile);
  };

  const clearSchedule = async () => {
    if (!confirm(`Clear ${profile.full_name ?? 'this employee'}'s schedule?`)) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ scheduled_start: null, scheduled_end: null })
      .eq('id', profile.id)
      .select(SELECT)
      .single();
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSaved(data as Profile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form onSubmit={save} className="w-full max-w-lg space-y-4 rounded-2xl bg-slate-800 p-6 shadow-xl">
        <h2 className="text-xl font-semibold">{profile.full_name ?? 'Employee'} — schedule</h2>

        <div className="flex gap-3">
          <Field label="Scheduled start" className="flex-1">
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={input}
              required
            />
          </Field>
          <Field label="Scheduled end" className="flex-1">
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={input}
              required
            />
          </Field>
        </div>

        <Field label="Working days">
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const on = days.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    on ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="flex gap-3">
          <Field label="Shift length (min)" className="flex-1">
            <input
              type="number"
              min="0"
              value={shiftMin}
              onChange={(e) => setShiftMin(Number(e.target.value))}
              className={input}
            />
          </Field>
          <Field label="Break length (min)" className="flex-1">
            <input
              type="number"
              min="0"
              value={breakMin}
              onChange={(e) => setBreakMin(Number(e.target.value))}
              className={input}
            />
          </Field>
        </div>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <div className="flex justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={clearSchedule}
            disabled={busy || !profile.scheduled_start}
            className="rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600 disabled:opacity-40"
          >
            Clear schedule
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-blue-600 px-5 py-2 font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
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
      const { error } = (await res.json().catch(() => ({ error: 'Request failed' }))) as {
        error: string;
      };
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
          className={input}
        />
        <input
          required
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={input}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as 'employee' | 'admin')}
          className={input}
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
          className={input}
        />
        <p className="text-xs text-slate-400">
          Share these credentials with the employee. They can change the password from the mobile
          app&apos;s settings.
        </p>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-blue-600 px-5 py-2 font-semibold hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

const input = 'w-full rounded-lg bg-slate-900 px-3 py-2 ring-1 ring-slate-700 outline-none focus:ring-blue-500';

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="text-xs uppercase text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
