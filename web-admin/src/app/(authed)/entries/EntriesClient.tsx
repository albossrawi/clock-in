'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase-browser';
import { exportToExcel, exportToPdf, type ExportRow } from '@/lib/exports';

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
}

interface Entry {
  id: string;
  user_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  notes: string | null;
  profiles?: { full_name: string | null } | null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const weekAgoIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
};

export default function EntriesClient({ profiles }: { profiles: Profile[] }) {
  const supabase = createClient();
  const [from, setFrom] = useState(weekAgoIso());
  const [to, setTo] = useState(todayIso());
  const [userId, setUserId] = useState<string>('all');
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Entry | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('time_entries')
      .select('id, user_id, clock_in_at, clock_out_at, notes, profiles(full_name)')
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

  const exportRows: ExportRow[] = useMemo(
    () =>
      rows.map((r) => ({
        Employee: r.profiles?.full_name ?? r.user_id,
        'Clock in': format(parseISO(r.clock_in_at), 'yyyy-MM-dd HH:mm'),
        'Clock out': r.clock_out_at ? format(parseISO(r.clock_out_at), 'yyyy-MM-dd HH:mm') : '',
        'Hours': r.clock_out_at
          ? (
              (parseISO(r.clock_out_at).getTime() - parseISO(r.clock_in_at).getTime()) /
              3_600_000
            ).toFixed(2)
          : '',
        Notes: r.notes ?? '',
      })),
    [rows],
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
            className="rounded-lg bg-emerald-600 px-4 py-2 hover:bg-emerald-500"
          >
            Excel
          </button>
          <button
            onClick={() =>
              exportToPdf(exportRows, `clock-in_${from}_to_${to}.pdf`, `Clock-in ${from} to ${to}`)
            }
            className="rounded-lg bg-rose-600 px-4 py-2 hover:bg-rose-500"
          >
            PDF
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Clock in</th>
              <th className="px-4 py-3">Clock out</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No entries in this range.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                  <td className="px-4 py-3">{r.profiles?.full_name ?? r.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{format(parseISO(r.clock_in_at), 'PP p')}</td>
                  <td className="px-4 py-3">
                    {r.clock_out_at ? format(parseISO(r.clock_out_at), 'PP p') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.clock_out_at
                      ? (
                          (parseISO(r.clock_out_at).getTime() - parseISO(r.clock_in_at).getTime()) /
                          3_600_000
                        ).toFixed(2)
                      : '—'}
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
              ))}
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
          <button onClick={onSave} className="rounded bg-blue-600 px-4 py-2 hover:bg-blue-500">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
