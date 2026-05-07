import { redirect } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { createClient } from '@/lib/supabase-server';

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (profile?.role !== 'admin') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Admin access required</h1>
          <p className="mt-2 text-slate-400">
            Your account isn&apos;t an admin. Ask an existing admin to upgrade you, or use the mobile app.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <NavBar email={user.email ?? null} />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </>
  );
}
