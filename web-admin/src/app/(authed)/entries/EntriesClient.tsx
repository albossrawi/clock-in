'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, startOfISOWeek } from 'date-fns';
import { createClient } from '@/lib/supabase-browser';
import { exportToExcel, exportToPdf, type ExportRow } from '@/lib/exports';

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  shift_length_minutes: number;
  break_length_minutes: number;
}

interface CompanyHours {
  daily_standard_minutes: number;
  daily_break_minutes: number;
  weekly_standard_minutes: number;
  overtime_multiplier: number;
}

interface Entry {
  id: string;
  user_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  notes: string | null;
  shift_type_id: string | null;
  profiles?: { full_name: string | null } | null;
  shift_types?: { name: string; multiplier: number } | null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const weekAgoIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
};

// Net worked minutes after subtracting unpaid break time.
function workedMinutes(e: Entry, breakMin: number): number | null {
  if (!e.clock_out_at) return null;
  const gross = (parseISO(e.clock_out_at).getTime() - parseISO(e.clock_in_at).getTime()) / 60_000;
  if (gross <= 0) return 0;
  // Only deduct break if the shift was long enough to reasonably take one.
  return Math.max(0, gross - (gross > breakMin ? breakMin : 0));
}

function overtimeMinutes(e: Entry, dailyStd: number, breakMin: number): number {
  const w = workedMinutes(e, breakMin);
  if (w == null) return 0;
  return Math.max(0, w - dailyStd);
}

function fmtH(min: number | null): string {
  if (min == null) return '—';
  return (min / 60).toFixed(2);
}

function shiftBadgeClass(name: string | null | undefined): string {
  switch (name?.toLowerCase()) {
    case 'evening':
      return 'bg-amber-500/20 text-amber-300';
    case 'night':
      return 'bg-indigo-500/20 text-indigo-300';
    case 'weekend':
      return 'bg-fuchsia-500/20 text-fuchsia-300';
    case 'morning':
    case 'afternoon':
      return 'bg-emerald-500/20 text-emerald-300';
    default:
      return 'bg-slate-500/20 text-slate-300';
  }
}

export default function EntriesClient({
  profiles,
  company,
}: {
  profiles: Profile[];
  company: CompanyHours;
}) {
  const supabase = createClient();
  const [from, setFrom] = useState(weekAgoIso());
  const [to, setTo] = useState(todayIso());
  const [userId, setUserId] = useState<string>('all');
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Entry | null>(null);

  const profileById = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p])) as Record<string, Profile>,
    [profiles],
  );

  // Daily standard for this entry: per-employee override beats the company default.
  const dailyStdFor = (uid: string) =>
    profileById[uid]?.shift_length_minutes ?? company.daily_standard_minutes;
  const breakFor = (uid: string) =>
    profileById[uid]?.break_length_minutes ?? company.daily_break_minutes;

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('time_entries')
      .select(
        'id, user_id, clock_in_at, clock_out_at, notes, shift_type_id, profiles(full_name), shift_types(name, multiplier)',
      )
      .gte('clock_in_at', `${from}T00:00:00.000Z`)
      .lte('clock_in_at', `${to}T23:59:59.999Z`)
      .order('clock_in_at', { ascending: false });
    if (userId !== 'all') q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (!error) setRows((data as unknown as Entry[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, userId]);

  // Weekly aggregates keyed by `${userId}|${weekStartIso}`
  const weeklySummary = useMemo(() => {
    const map = new Map<
      string,
      { user_id: string; full_name: string; weekStart: Date; total: number; daily_ot: number }
    >();
    for (const r of rows) {
      const w = workedMinutes(r, breakFor(r.user_id));
      if (w == null) continue;
      const wkStart = startOfISOWeek(parseISO(r.clock_in_at));
      const key = `${r.user_id}|${wkStart.toISOString().slice(0, 10)}`;
      const existing = map.get(key) ?? {
        user_id: r.user_id,
        full_name: r.profiles?.full_name ?? r.user_id.slice(0, 8),
        weekStart: wkStart,
        total: 0,
        daily_ot: 0,
      };
      existing.total += w;
      existing.daily_ot += overtimeMinutes(r, dailyStdFor(r.user_id), breakFor(r.user_id));
      map.set(key, existing);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.weekStart.getTime() - a.weekStart.getTime() || a.full_name.localeCompare(b.full_name),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, profileById]);

  const exportRows: ExportRow[] = useMemo(
    () =>
      rows.map((r) => {
        const w = workedMinutes(r, breakFor(r.user_id));
        const ot = overtimeMinutes(r, dailyStdFor(r.user_id), breakFor(r.user_id));
        return {
          Employee: r.profiles?.full_name ?? r.user_id,
          'Clock in': format(parseISO(r.clock_in_at), 'yyyy-MM-dd HH:mm'),
          'Clock out': r.clock_out_at ? format(parseISO(r.clock_out_at), 'yyyy-MM-dd HH:mm') : '',
          Shift: r.shift_types?.name ?? 'Regular',
          'Hours worked': fmtH(w),
          'Overtime (h)': fmtH(ot),
          Multiplier: r.shift_types ? Number(r.shift_types.multiplier).toFixed(2) : '1.00',
          Notes: r.notes ?? '',
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, profileById],
  );

  const remove = async (id: string) => {
    if (!confirm('Delete this entry permanently?')) return;
    const { error } = await supabase.from('time_entries').delete().eq('id', id);
    if (error) {
      alert(error.message);
      return;
    }
    setRows((r) => r.filter((x) => x.id !== id));
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from('time_entries')
      .update({
        clock_in_at: editing.clock_in_at,
        clock_out_at: editing.clock_out_at,
        notes: editing.notes,
      })
      .eq('id', editing.id);
    if (error) {
      alert(error.message);
      return;
    }
    setEditing(null);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs uppercase text-slate-400">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded-lg bg-slate-800 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-slate-400">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded-lg bg-slate-800 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-slate-400">Employee</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="mt-1 rounded-lg bg-slate-800 px-3 py-2"
          >
            <option value="all">All</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => exportToExcel(exportRows, `clock-in_${from}_to_${to}.xlsx`)}
            className="rounded-full bg-emerald-600 px-4 py-2 shadow-lg shadow-emerald-500/40 transition hover:-translate-y-0.5 active:scale-95"
          >
            Excel
          </button>
          <button
            onClick={() =>
              exportToPdf(exportRows, `clock-in_${from}_to_${to}.pdf`, `Clock-in ${from} to ${to}`)
            }
            className="rounded-full bg-rose-600 px-4 py-2 shadow-lg shadow-rose-500/40 transition hover:-translate-y-0.5 active:scale-95"
          >
            PDF
          </button>
        </div>
      </div>

      {/* Weekly summary */}
      {weeklySummary.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Weekly hours
              </h2>
              <p className="text-xs text-slate-500">
                Standard {(company.weekly_standard_minutes / 60).toFixed(0)}h · OT paid at{' '}
                {Number(company.overtime_multiplier).toFixed(2)}×
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {weeklySummary.map((w) => {
              const weeklyOT = Math.max(0, w.total - company.weekly_standard_minutes);
              return (
                <div
                  key={w.user_id + w.weekStart.toISOString()}
                  className="rounded-lg bg-slate-800/60 p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{w.full_name}</span>
                    <span className="text-xs text-slate-400">
                      Wk of {format(w.weekStart, 'MMM d')}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-300">
                    <span>
                      Total <strong className="text-slate-100">{fmtH(w.total)} h</strong>
                    </span>
                    <span>
                      Daily OT{' '}
                      <strong className="text-amber-300">{fmtH(w.daily_ot)} h</strong>
                    </span>
                    <span>
                      Weekly OT{' '}
                      <strong className={weeklyOT > 0 ? 'text-rose-300' : 'text-slate-100'}>
                        {fmtH(weeklyOT)} h
                      </strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Clock in</th>
              <th className="px-4 py-3">Clock out</th>
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">OT</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  No entries in this range.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => {
                const w = workedMinutes(r, breakFor(r.user_id));
                const ot = overtimeMinutes(r, dailyStdFor(r.user_id), breakFor(r.user_id));
                const shiftName = r.shift_types?.name ?? null;
                return (
                  <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-4 py-3">{r.profiles?.full_name ?? r.user_id.slice(0, 8)}</td>
                    <td className="px-4 py-3">{format(parseISO(r.clock_in_at), 'PP p')}</td>
                    <td className="px-4 py-3">
                      {r.clock_out_at ? format(parseISO(r.clock_out_at), 'PP p') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${shiftBadgeClass(shiftName)}`}
                      >
                        {shiftName ?? 'Regular'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{fmtH(w)}</td>
                    <td className={`px-4 py-3 ${ot > 0 ? 'text-amber-300 font-semibold' : 'text-slate-400'}`}>
                      {fmtH(ot)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.notes ?? ''}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(r)}
                        className="mr-2 rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(r.id)}
                        className="rounded bg-rose-700 px-3 py-1 hover:bg-rose-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditModal
          entry={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

function EditModal({
  entry,
  onChange,
  onCancel,
  onSave,
}: {
  entry: Entry;
  onChange: (e: Entry) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 p-6 shadow-xl">
        <h2 className="text-xl font-semibold">Edit entry</h2>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs uppercase text-slate-400">Clock in</span>
            <input
              type="datetime-local"
              value={toLocalInput(entry.clock_in_at)}
              onChange={(e) =>
                onChange({ ...entry, clock_in_at: fromLocalInput(e.target.value) ?? entry.clock_in_at })
              }
              className="mt-1 w-full rounded bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase text-slate-400">Clock out</span>
            <input
              type="datetime-local"
              value={toLocalInput(entry.clock_out_at)}
              onChange={(e) => onChange({ ...entry, clock_out_at: fromLocalInput(e.target.value) })}
              className="mt-1 w-full rounded bg-slate-900 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase text-slate-400">Notes</span>
            <textarea
              value={entry.notes ?? ''}
              onChange={(e) => onChange({ ...entry, notes: e.target.value })}
              className="mt-1 w-full rounded bg-slate-900 px-3 py-2"
              rows={3}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600">
            Cancel
          </button>
          <button onClick={onSave} className="rounded-full bg-blue-600 px-5 py-2 font-semibold shadow-lg shadow-blue-500/40 transition hover:-translate-y-0.5 active:scale-95">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

