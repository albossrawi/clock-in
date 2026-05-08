'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

interface ShiftType {
  id: string;
  name: string;
  start_time: string;            // 'HH:MM:SS'
  end_time: string;
  days_of_week: number[];        // 1=Mon..7=Sun
  multiplier: number;
  position: number;
  is_active: boolean;
}

interface Company {
  id: string;
  name: string;
  timezone: string;
  daily_standard_minutes: number;
  daily_break_minutes: number;
  weekly_standard_minutes: number;
  overtime_multiplier: number;
  warn_early_clock_in: boolean;
  warn_late_clock_in: boolean;
  early_threshold_minutes: number;
  late_threshold_minutes: number;
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

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Stockholm',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export default function SettingsClient({
  company,
  initialShiftTypes,
}: {
  company: Company;
  initialShiftTypes: ShiftType[];
}) {
  const supabase = createClient();
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>(initialShiftTypes);
  const [timezone, setTimezone] = useState(company.timezone);
  const [dailyStd, setDailyStd] = useState(company.daily_standard_minutes);
  const [breakMin, setBreakMin] = useState(company.daily_break_minutes);
  const [weeklyStd, setWeeklyStd] = useState(company.weekly_standard_minutes);
  const [otMult, setOtMult] = useState(Number(company.overtime_multiplier));
  const [warnEarly, setWarnEarly] = useState(company.warn_early_clock_in);
  const [warnLate, setWarnLate] = useState(company.warn_late_clock_in);
  const [earlyThr, setEarlyThr] = useState(company.early_threshold_minutes);
  const [lateThr, setLateThr] = useState(company.late_threshold_minutes);
  const [savingWarnings, setSavingWarnings] = useState(false);
  const [editing, setEditing] = useState<ShiftType | null>(null);
  const [creating, setCreating] = useState(false);
  const [savingHours, setSavingHours] = useState(false);

  const saveTimezone = async () => {
    const { error } = await supabase
      .from('companies')
      .update({ timezone })
      .eq('id', company.id);
    if (error) alert(error.message);
    else alert('Timezone saved.');
  };

  const saveHours = async () => {
    setSavingHours(true);
    const { error } = await supabase
      .from('companies')
      .update({
        daily_standard_minutes: dailyStd,
        daily_break_minutes: breakMin,
        weekly_standard_minutes: weeklyStd,
        overtime_multiplier: otMult,
      })
      .eq('id', company.id);
    setSavingHours(false);
    if (error) alert(error.message);
    else alert('Saved.');
  };

  const saveWarnings = async () => {
    setSavingWarnings(true);
    const { error } = await supabase
      .from('companies')
      .update({
        warn_early_clock_in: warnEarly,
        warn_late_clock_in: warnLate,
        early_threshold_minutes: earlyThr,
        late_threshold_minutes: lateThr,
      })
      .eq('id', company.id);
    setSavingWarnings(false);
    if (error) alert(error.message);
    else alert('Saved.');
  };

  const toggle = async (st: ShiftType) => {
    const target = !st.is_active;
    const { error } = await supabase
      .from('shift_types')
      .update({ is_active: target })
      .eq('id', st.id);
    if (error) {
      alert(error.message);
      return;
    }
    setShiftTypes((all) => all.map((x) => (x.id === st.id ? { ...x, is_active: target } : x)));
  };

  const remove = async (st: ShiftType) => {
    if (!confirm(`Delete shift type "${st.name}"?`)) return;
    const { error } = await supabase.from('shift_types').delete().eq('id', st.id);
    if (error) {
      alert(error.message);
      return;
    }
    setShiftTypes((all) => all.filter((x) => x.id !== st.id));
  };

  const upsertDone = (st: ShiftType, isNew: boolean) => {
    setShiftTypes((all) => {
      if (isNew) return [...all, st].sort((a, b) => a.position - b.position);
      return all.map((x) => (x.id === st.id ? st : x)).sort((a, b) => a.position - b.position);
    });
    setEditing(null);
    setCreating(false);
  };

  return (
    <div className="space-y-10">
      {/* Timezone */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-xl font-semibold">Company timezone</h2>
        <p className="mt-1 text-sm text-slate-400">
          Shift windows are evaluated in this timezone. Set it to where your employees actually work.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="rounded-lg bg-slate-800 px-3 py-2 ring-1 ring-slate-700"
          >
            {!COMMON_TIMEZONES.includes(timezone) && <option value={timezone}>{timezone}</option>}
            {COMMON_TIMEZONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={saveTimezone}
            className="rounded-full bg-blue-600 px-5 py-2 font-semibold shadow-lg shadow-blue-500/40 transition hover:-translate-y-0.5 active:scale-95"
          >
            Save
          </button>
        </div>
      </section>

      {/* Hours and overtime */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-xl font-semibold">Standard hours and overtime</h2>
        <p className="mt-1 text-sm text-slate-400">
          Hours worked beyond these thresholds are flagged as overtime in the entries table and exports.
          Per-employee overrides on the Employees page take precedence over the daily values.
        </p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <NumField
            label="Daily standard (minutes)"
            value={dailyStd}
            onChange={setDailyStd}
            help={`${(dailyStd / 60).toFixed(2)} h`}
          />
          <NumField
            label="Daily break (minutes)"
            value={breakMin}
            onChange={setBreakMin}
            help={`${breakMin} min unpaid`}
          />
          <NumField
            label="Weekly standard (minutes)"
            value={weeklyStd}
            onChange={setWeeklyStd}
            help={`${(weeklyStd / 60).toFixed(2)} h / week`}
          />
          <NumField
            label="Overtime multiplier"
            value={otMult}
            onChange={setOtMult}
            step={0.05}
            help={`OT paid at ${otMult.toFixed(2)}×`}
          />
        </div>
        <button
          onClick={saveHours}
          disabled={savingHours}
          className="mt-4 rounded-full bg-blue-600 px-5 py-2 font-semibold shadow-lg shadow-blue-500/40 transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
        >
          {savingHours ? 'Saving…' : 'Save'}
        </button>
      </section>

      {/* Early / late clock-in warnings */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-xl font-semibold">Early / late clock-in warnings</h2>
        <p className="mt-1 text-sm text-slate-400">
          The mobile app compares the clock-in time to the employee&apos;s scheduled start (set on the
          Employees page) and shows a confirmation if it&apos;s outside the grace window.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={warnEarly}
              onChange={(e) => setWarnEarly(e.target.checked)}
              className="h-4 w-4"
            />
            Warn when an employee clocks in <strong className="font-semibold">early</strong>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={warnLate}
              onChange={(e) => setWarnLate(e.target.checked)}
              className="h-4 w-4"
            />
            Warn when an employee clocks in <strong className="font-semibold">late</strong>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField
            label="Early grace (minutes)"
            value={earlyThr}
            onChange={setEarlyThr}
            help={`No warning if clocked in within ${earlyThr} min before scheduled`}
          />
          <NumField
            label="Late grace (minutes)"
            value={lateThr}
            onChange={setLateThr}
            help={`No warning if clocked in within ${lateThr} min after scheduled`}
          />
        </div>
        <button
          onClick={saveWarnings}
          disabled={savingWarnings}
          className="mt-4 rounded-full bg-blue-600 px-5 py-2 font-semibold transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
        >
          {savingWarnings ? 'Saving…' : 'Save'}
        </button>
      </section>

      {/* Shift types */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">Shift types</h2>
            <p className="text-sm text-slate-400">
              Each clock-in is auto-tagged with the matching shift. Lower position wins when windows overlap.
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="rounded-full bg-blue-600 px-5 py-2 font-semibold shadow-lg shadow-blue-500/40 transition hover:-translate-y-0.5 active:scale-95"
          >
            Add shift type
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">×</th>
                <th className="px-4 py-3">Pos</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shiftTypes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    No shift types yet.
                  </td>
                </tr>
              )}
              {shiftTypes.map((st) => (
                <tr key={st.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 font-semibold">{st.name}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {st.start_time.slice(0, 5)} – {st.end_time.slice(0, 5)}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {DAYS.map((d) =>
                      st.days_of_week.includes(d.value) ? (
                        <span key={d.value} className="mr-1 rounded bg-slate-700 px-1.5 py-0.5 text-xs">
                          {d.label}
                        </span>
                      ) : null,
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{Number(st.multiplier).toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-300">{st.position}</td>
                  <td className="px-4 py-3">
                    {st.is_active ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-300">
                        Off
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggle(st)}
                      className="mr-2 rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
                    >
                      {st.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => setEditing(st)}
                      className="mr-2 rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(st)}
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
      </section>

      {(editing || creating) && (
        <ShiftTypeModal
          companyId={company.id}
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={upsertDone}
        />
      )}
    </div>
  );
}

function ShiftTypeModal({
  companyId,
  initial,
  onClose,
  onSaved,
}: {
  companyId: string;
  initial: ShiftType | null;
  onClose: () => void;
  onSaved: (st: ShiftType, isNew: boolean) => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState<Omit<ShiftType, 'id'>>(
    initial
      ? {
          name: initial.name,
          start_time: initial.start_time.slice(0, 5),
          end_time: initial.end_time.slice(0, 5),
          days_of_week: initial.days_of_week,
          multiplier: Number(initial.multiplier),
          position: initial.position,
          is_active: initial.is_active,
        }
      : {
          name: '',
          start_time: '09:00',
          end_time: '17:00',
          days_of_week: [1, 2, 3, 4, 5],
          multiplier: 1.0,
          position: 100,
          is_active: true,
        },
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleDay = (d: number) =>
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter((x) => x !== d)
        : [...f.days_of_week, d].sort((a, b) => a - b),
    }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!form.name.trim()) {
      setErr('Name is required.');
      return;
    }
    if (form.days_of_week.length === 0) {
      setErr('Pick at least one day.');
      return;
    }
    setBusy(true);
    const payload = {
      company_id: companyId,
      name: form.name.trim(),
      start_time: form.start_time + ':00',
      end_time: form.end_time + ':00',
      days_of_week: form.days_of_week,
      multiplier: form.multiplier,
      position: form.position,
      is_active: form.is_active,
    };
    const { data, error } = initial
      ? await supabase
          .from('shift_types')
          .update(payload)
          .eq('id', initial.id)
          .select('*')
          .single()
      : await supabase.from('shift_types').insert(payload).select('*').single();
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSaved(data as ShiftType, !initial);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <form onSubmit={submit} className="w-full max-w-lg space-y-3 rounded-2xl bg-slate-800 p-6 shadow-xl">
        <h2 className="text-xl font-semibold">{initial ? 'Edit shift type' : 'Add shift type'}</h2>

        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={input}
            required
          />
        </Field>

        <div className="flex gap-3">
          <Field label="Start" className="flex-1">
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className={input}
              required
            />
          </Field>
          <Field label="End" className="flex-1">
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className={input}
              required
            />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-slate-400">
          If End is earlier than Start (e.g. 23:00 → 06:00) the shift crosses midnight.
        </p>

        <Field label="Days">
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const on = form.days_of_week.includes(d.value);
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
          <Field label="Multiplier" className="flex-1">
            <input
              type="number"
              step="0.05"
              min="0"
              value={form.multiplier}
              onChange={(e) => setForm({ ...form, multiplier: Number(e.target.value) })}
              className={input}
            />
          </Field>
          <Field label="Position" className="flex-1">
            <input
              type="number"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: Number(e.target.value) })}
              className={input}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Active
        </label>

        {err && <p className="text-sm text-red-400">{err}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-blue-600 px-5 py-2 font-semibold shadow-lg shadow-blue-500/40 transition hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
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

function NumField({
  label,
  value,
  onChange,
  help,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  help?: string;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase text-slate-400">{label}</span>
      <input
        type="number"
        step={step ?? 1}
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg bg-slate-900 px-3 py-2 ring-1 ring-slate-700 outline-none focus:ring-blue-500"
      />
      {help && <span className="mt-1 block text-xs text-slate-500">{help}</span>}
    </label>
  );
}
