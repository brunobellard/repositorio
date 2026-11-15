import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = !!url && !!key;

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key', {
  auth: {
    // No navegador (incluindo a renderização no servidor) o padrão do supabase-js já resolve
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// No celular, só renova o token enquanto o app está aberto
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Mensagem amigável para erros comuns do Supabase/Postgres. */
export function friendlyError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return 'Erro desconhecido';
  switch (error.code) {
    case '23P01':
      return 'Já existe um agendamento nesse horário.';
    case '23505':
      return 'Esse valor já está em uso (por exemplo, o link escolhido já pertence a outro estúdio).';
    case '23503':
      return 'Este registro está ligado a outros dados e não pode ser alterado.';
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.';
    case 'user_already_exists':
      return 'Já existe uma conta com este e-mail.';
    case 'weak_password':
      return 'Senha fraca: use pelo menos 6 caracteres.';
    case 'email_not_confirmed':
      return 'Confirme seu e-mail antes de entrar.';
  }
  return error.message ?? 'Erro desconhecido';
}
