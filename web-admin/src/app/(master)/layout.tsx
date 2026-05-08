import { redirect } from 'next/navigation';
import Link from 'next/link';
import MasterNav from '@/components/MasterNav';
import { createClient } from '@/lib/supabase-server';

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'super_admin') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Master access required</h1>
          <p className="mt-2 text-slate-400">Only the platform master admin can view this area.</p>
          <Link href="/entries" className="mt-4 inline-block rounded-full bg-blue-600 px-6 py-2 hover:bg-blue-500">
            Go to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <MasterNav email={user.email ?? null} />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </>
  );
}
