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
    .select('role, company_id')
    .eq('id', user.id)
    .single();
  if (caller?.role !== 'admin' && caller?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }
  if (caller.role === 'admin' && !caller.company_id) {
    return NextResponse.json({ error: 'Admin has no company' }, { status: 400 });
  }

  const body = (await req.json()) as {
    email?: string;
    full_name?: string;
    role?: 'employee' | 'admin';
    password?: string;
    company_id?: string;
  };
  const { email, full_name, role = 'employee', password } = body;
  // Company admins can only invite into their own company. Super admins may
  // optionally pass a company_id to seed any tenant.
  const company_id = caller.role === 'super_admin' ? body.company_id : caller.company_id;

  if (!email || !full_name || !password) {
    return NextResponse.json({ error: 'email, full_name, password are required' }, { status: 400 });
  }
  if (!company_id) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role, company_id },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Trigger inserts a profile from metadata; this is a safety net in case
  // metadata changes shape later.
  if (created.user) {
    await admin
      .from('profiles')
      .update({ role, full_name, company_id })
      .eq('id', created.user.id);
  }

  return NextResponse.json({ ok: true });
}
