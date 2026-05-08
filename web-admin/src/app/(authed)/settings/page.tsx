import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('id', user.id)
    .single();

  if (!profile?.company_id) {
    return (
      <p className="text-slate-400">
        Settings live per company. Master admins can manage tenants from the Companies page.
      </p>
    );
  }

  const [{ data: company }, { data: shiftTypes }] = await Promise.all([
    supabase
      .from('companies')
      .select(
        'id, name, timezone, daily_standard_minutes, daily_break_minutes, weekly_standard_minutes, overtime_multiplier, warn_early_clock_in, warn_late_clock_in, early_threshold_minutes, late_threshold_minutes',
      )
      .eq('id', profile.company_id)
      .single(),
    supabase
      .from('shift_types')
      .select('id, name, start_time, end_time, days_of_week, multiplier, position, is_active')
      .eq('company_id', profile.company_id)
      .order('position'),
  ]);

  if (!company) return <p>Company not found.</p>;

  return <SettingsClient company={company} initialShiftTypes={shiftTypes ?? []} />;
}
