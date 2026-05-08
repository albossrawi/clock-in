'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

const links = [
  { href: '/entries', label: 'Time entries' },
  { href: '/employees', label: 'Employees' },
  { href: '/settings', label: 'Settings' },
];

export default function NavBar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold">Clock-in admin</span>
          <nav className="flex gap-4 text-sm">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={active ? 'text-white' : 'text-slate-400 hover:text-slate-200'}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-400">{email}</span>
          <button onClick={signOut} className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700">
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
