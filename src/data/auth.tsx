import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { LEGAL_INFO } from '@/constants/legal';
import { setBiometricEnabled } from '@/lib/biometrics';
import { friendlyError, supabase } from '@/lib/supabase';
import { webBaseUrl } from '@/lib/web';
import { clearOfflineData, isNetworkError } from '@/services/offlineSync';

interface Auth {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, businessName: string, ownerName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Envia o e-mail de redefinição de senha. Devolve uma mensagem de erro ou null. */
  resetPassword: (email: string) => Promise<string | null>;
  /** Exclui a conta para sempre (Edge Function delete-account). Devolve uma mensagem de erro ou null. */
  deleteAccount: () => Promise<string | null>;
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
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // Registro do aceite dos Termos e da Política (prova de consentimento, LGPD)
        options: { data: { terms_accepted_at: new Date().toISOString(), terms_version: LEGAL_INFO.updatedAt } },
      });
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

    async resetPassword(email) {
      const base = webBaseUrl();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        // O link do e-mail abre a página do site onde se escolhe a nova senha
        redirectTo: base ? `${base}/redefinir-senha` : undefined,
      });
      return error ? friendlyError(error) : null;
    },

    async deleteAccount() {
      const uid = session?.user.id;
      if (!uid) return 'Entre na sua conta para excluí-la.';
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) {
        if (isNetworkError(error)) return 'Sem conexão com a internet. Tente de novo quando a conexão voltar.';
        // Mensagem enviada pela própria função, quando houver
        let msg: string | undefined;
        try {
          const ctx = (error as { context?: Response }).context;
          msg = ctx ? (await ctx.json())?.error : undefined;
        } catch {
          // resposta sem JSON
        }
        return msg ?? 'Não foi possível excluir a conta agora. Tente de novo em instantes.';
      }
      // Conta apagada no servidor: limpa tudo o que ficou neste aparelho
      await clearOfflineData(uid);
      await setBiometricEnabled(false).catch(() => {});
      await supabase.auth.signOut({ scope: 'local' });
      return null;
    },
  };

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const a = useContext(AuthContext);
  if (!a) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return a;
}
