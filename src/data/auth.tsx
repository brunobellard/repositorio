import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { friendlyError, supabase } from '@/lib/supabase';

interface Auth {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, businessName: string, ownerName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const auth: Auth = {
    session,
    loading,

    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      return error ? friendlyError(error) : null;
    },

    async signUp(email, password, businessName, ownerName) {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) return friendlyError(error);
      if (!data.session) {
        return 'Conta criada! Confirme o e-mail que enviamos e depois entre com sua senha.';
      }
      await supabase
        .from('profiles')
        .update({ business_name: businessName.trim(), owner_name: ownerName.trim() })
        .eq('id', data.session.user.id);
      return null;
    },

    async signOut() {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const a = useContext(AuthContext);
  if (!a) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return a;
}
