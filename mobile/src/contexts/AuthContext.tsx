import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { CompanySettings, Profile } from '@/types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  companySettings: CompanySettings | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfileAndCompany = async (userId: string) => {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile((prof as Profile) ?? null);

    if (prof?.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('warn_early_clock_in, warn_late_clock_in, early_threshold_minutes, late_threshold_minutes')
        .eq('id', prof.company_id)
        .single();
      setCompanySettings((company as CompanySettings) ?? null);
    } else {
      setCompanySettings(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (session?.user) {
        await loadProfileAndCompany(session.user.id);
      } else {
        setProfile(null);
        setCompanySettings(null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      companySettings,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
      async changePassword(newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return { error: error?.message ?? null };
      },
      async refreshProfile() {
        if (session?.user) await loadProfileAndCompany(session.user.id);
      },
    }),
    [session, profile, companySettings, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
