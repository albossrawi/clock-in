import { createClient } from '@/lib/supabase-server';
import CompaniesClient from './CompaniesClient';

export default async function CompaniesPage() {
  const supabase = createClient();

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, address, contact_name, contact_email, contact_phone, is_active, created_at')
    .order('created_at', { ascending: false });

  // Headcounts in one round-trip — a small denormalisation could replace this
  // when company count grows, but it's cheap for now.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('company_id, role');

  const counts: Record<string, { admins: number; employees: number }> = {};
  for (const p of profiles ?? []) {
    if (!p.company_id) continue;
    counts[p.company_id] ??= { admins: 0, employees: 0 };
    if (p.role === 'admin') counts[p.company_id].admins += 1;
    if (p.role === 'employee') counts[p.company_id].employees += 1;
  }

  return <CompaniesClient initialCompanies={companies ?? []} counts={counts} />;
}
