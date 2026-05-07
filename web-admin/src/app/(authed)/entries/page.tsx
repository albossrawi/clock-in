import EntriesClient from './EntriesClient';
import { createClient } from '@/lib/supabase-server';

export default async function EntriesPage() {
  const supabase = createClient();
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .order('full_name');
  return <EntriesClient profiles={profiles ?? []} />;
}
