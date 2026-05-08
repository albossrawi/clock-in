'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase-browser';

interface Company {
  id: string;
  name: string;
  address: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  initialCompanies: Company[];
  counts: Record<string, { admins: number; employees: number }>;
}

export default function CompaniesClient({ initialCompanies, counts }: Props) {
  const supabase = createClient();
  const [companies, setCompanies] = useState(initialCompanies);

  const toggleActive = async (c: Company) => {
    const target = !c.is_active;
    const { error } = await supabase.from('companies').update({ is_active: target }).eq('id', c.id);
    if (error) {
      alert(error.message);
      return;
    }
    setCompanies((all) => all.map((x) => (x.id === c.id ? { ...x, is_active: target } : x)));
  };

  const remove = async (c: Company) => {
    if (!confirm(`Permanently delete "${c.name}" and all their data? This cannot be undone.`)) return;
    const { error } = await supabase.from('companies').delete().eq('id', c.id);
    if (error) {
      alert(error.message);
      return;
    }
    setCompanies((all) => all.filter((x) => x.id !== c.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Companies</h1>
        <span className="text-sm text-slate-400">{companies.length} total</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Headcount</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No companies registered yet.
                </td>
              </tr>
            )}
            {companies.map((c) => {
              const ct = counts[c.id] ?? { admins: 0, employees: 0 };
              return (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-slate-400">{c.address ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{c.contact_name}</div>
                    <div className="text-xs text-slate-400">{c.contact_email}</div>
                    {c.contact_phone && <div className="text-xs text-slate-400">{c.contact_phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      <span className="text-slate-300">{ct.admins}</span>
                      <span className="text-slate-500"> admin{ct.admins === 1 ? '' : 's'}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-300">{ct.employees}</span>
                      <span className="text-slate-500"> employee{ct.employees === 1 ? '' : 's'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {format(parseISO(c.created_at), 'PP')}
                  </td>
                  <td className="px-4 py-3">
                    {c.is_active ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-300">
                        Suspended
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleActive(c)}
                      className="mr-2 rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
                    >
                      {c.is_active ? 'Suspend' : 'Reactivate'}
                    </button>
                    <button
                      onClick={() => remove(c)}
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
    </div>
  );
}
