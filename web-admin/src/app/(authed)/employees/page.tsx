import EmployeesClient from './EmployeesClient';
import { createClient } from '@/lib/supabase-server';

export default async function EmployeesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active, shift_length_minutes, break_length_minutes')
    .order('full_name');
  return <EmployeesClient initialProfiles={data ?? []} />;
}
