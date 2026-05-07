import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
  // Gate: only signed-in admins may invite.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: caller } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = (await req.json()) as {
    email?: string;
    full_name?: string;
    role?: 'employee' | 'admin';
    password?: string;
  };
  const { email, full_name, role = 'employee', password } = body;

  if (!email || !full_name || !password) {
    return NextResponse.json({ error: 'email, full_name, password are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // The trigger inserts a profile row with default role; update if admin requested.
  if (role === 'admin' && created.user) {
    await admin
      .from('profiles')
      .update({ role: 'admin', full_name })
      .eq('id', created.user.id);
  } else if (created.user) {
    await admin.from('profiles').update({ full_name }).eq('id', created.user.id);
  }

  return NextResponse.json({ ok: true });
}
