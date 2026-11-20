import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { LEGAL_INFO } from '@/constants/legal';
import { setBiometricEnabled } from '@/lib/biometrics';
import { friendlyError, supabase } from '@/lib/supabase';
import { clearThemeCache } from '@/lib/theme-cache';
import { webBaseUrl } from '@/lib/web';
import { clearOfflineData, isNetworkError } from '@/services/offlineSync';

interface Auth {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, businessName: string, ownerName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** A conta já aceitou os Termos de Uso e a Política de Privacidade */
  termsAccepted: boolean;
  /** Registra o aceite (uma única vez, no primeiro acesso). Devolve uma mensagem de erro ou null. */
  acceptTerms: () => Promise<string | null>;
  /** Envia o e-mail de redefinição de senha. Devolve uma mensagem de erro ou null. */
  resetPassword: (email: string) => Promise<string | null>;
  /** Exclui a conta para sempre (Edge Function delete-account). Devolve uma mensagem de erro ou null. */
  deleteAccount: () => Promise<string | null>;
}

const AuthContext = createContext<Auth | null>(null);

/** Sessão guardada no aparelho pelo Supabase, mesmo com o token vencido. */
async function storedSession(): Promise<Session | null> {
  try {
    const auth = supabase.auth as unknown as {
      storageKey: string;
      storage: { getItem: (k: string) => string | null | Promise<string | null> };
    };
    const raw = await auth.storage.getItem(auth.storageKey);
    const s = raw ? (JSON.parse(raw) as Session) : null;
    return s?.access_token && s.refresh_token && s.user?.id ? s : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data, error }) => {
      let s = data.session;
      // Abriu sem internet com o token vencido: o Supabase não consegue renová-lo e devolve
      // "sem sessão", e o app caía no login (sem dar para entrar, por estar offline).
      // A sessão continua guardada no aparelho: usa ela para abrir com os dados salvos.
      // Quando a internet voltar, o token é renovado sozinho; se a conta tiver saído de
      // verdade, o Supabase avisa (SIGNED_OUT) e o app volta para o login.
      if (!s && error && (error.name === 'AuthRetryableFetchError' || isNetworkError(error))) {
        s = await storedSession();
      }
      setSession(s);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // A sessão inicial já é tratada acima (inclusive o caso offline, que aqui viria vazio)
      if (event === 'INITIAL_SESSION') return;
      setSession(s);
    });
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
      // O aceite dos Termos é registrado depois, no primeiro acesso (acceptTerms)
      // Os nomes vão junto com a conta: se for preciso confirmar o e-mail antes de entrar,
      // o app os aplica ao perfil no primeiro acesso (ver ensureDefaults no store)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { business_name: businessName.trim(), owner_name: ownerName.trim() } },
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
      const uid = session?.user.id;
      if (uid) {
        // Este aparelho para de receber os avisos desta conta (com internet; sem ela, segue sem travar)
        await supabase
          .from('profiles')
          .update({ expo_push_token: null })
          .eq('id', uid)
          .then(
            () => {},
            () => {},
          );
        // Apaga a cópia local dos dados e a fila offline: o aparelho pode ser de outra pessoa
        await clearOfflineData(uid);
      }
      // Preferências do aparelho que não devem passar para a próxima conta
      await setBiometricEnabled(false).catch(() => {});
      await clearThemeCache();
      // 'local': sai deste aparelho na hora, mesmo sem internet (o padrão 'global' falha offline e mantém a sessão)
      await supabase.auth.signOut({ scope: 'local' });
    },

    termsAccepted: !!session?.user.user_metadata?.terms_accepted_at,

    async acceptTerms() {
      // Registro do aceite dos Termos e da Política (prova de consentimento, LGPD)
      const { error } = await supabase.auth.updateUser({
        data: { terms_accepted_at: new Date().toISOString(), terms_version: LEGAL_INFO.updatedAt },
      });
      return error ? friendlyError(error) : null;
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
      await clearThemeCache();
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
