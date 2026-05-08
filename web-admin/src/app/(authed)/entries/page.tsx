import { redirect } from 'next/navigation';
import EntriesClient from './EntriesClient';
import { createClient } from '@/lib/supabase-server';

export default async function EntriesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  const [{ data: profiles }, { data: company }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, is_active, shift_length_minutes, break_length_minutes')
      .order('full_name'),
    callerProfile?.company_id
      ? supabase
          .from('companies')
          .select(
            'daily_standard_minutes, daily_break_minutes, weekly_standard_minutes, overtime_multiplier',
          )
          .eq('id', callerProfile.company_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <EntriesClient
      profiles={profiles ?? []}
      company={
        company ?? {
          daily_standard_minutes: 450,
          daily_break_minutes: 30,
          weekly_standard_minutes: 2220,
          overtime_multiplier: 1.5,
        }
      }
    />
  );
}
