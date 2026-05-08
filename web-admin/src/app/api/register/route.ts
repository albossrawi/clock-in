import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-server';

interface Body {
  company_name?: string;
  address?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  password?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const { company_name, address, contact_name, contact_email, contact_phone, password } = body;

  if (!company_name || !contact_name || !contact_email || !password) {
    return NextResponse.json(
      { error: 'company_name, contact_name, contact_email and password are required' },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Create the company.
  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({
      name: company_name,
      address: address || null,
      contact_name,
      contact_email,
      contact_phone: contact_phone || null,
    })
    .select('id')
    .single();
  if (companyError) return NextResponse.json({ error: companyError.message }, { status: 400 });

  // 2. Create the auth user. email_confirm: false so Supabase sends a confirmation email.
  const { error: userError } = await admin.auth.admin.createUser({
    email: contact_email,
    password,
    email_confirm: false,
    user_metadata: {
      full_name: contact_name,
      role: 'admin',
      company_id: company.id,
    },
  });
  if (userError) {
    // Roll back the company so the user can retry with a working email.
    await admin.from('companies').delete().eq('id', company.id);
    return NextResponse.json({ error: userError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
