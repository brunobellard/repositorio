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
  if (/network request failed|failed to fetch|fetch failed|networkerror|load failed/i.test(error.message ?? '')) {
    return 'Sem conexão com a internet. Tente de novo quando a conexão voltar.';
  }
  switch (error.code) {
    case '23P01':
      return 'Já existe um agendamento nesse horário.';
    case '23505':
      return 'Esse valor já está em uso (por exemplo, o link escolhido já pertence a outro estúdio).';
    case '23503':
      return 'Este registro está ligado a outros dados e não pode ser alterado.';
    case '23514':
      // Regra de valor do banco (ex: pacote com todas as sessões já usadas)
      return /client_packages/.test(error.message ?? '')
        ? 'O pacote já usou todas as sessões. Não dá para concluir mais uma sessão com ele.'
        : 'Algum valor ficou fora do permitido. Confira os dados e tente de novo.';
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.';
    case 'user_already_exists':
      return 'Já existe uma conta com este e-mail.';
    case 'weak_password':
      return 'Senha fraca: use pelo menos 6 caracteres.';
    case 'email_not_confirmed':
      return 'Confirme seu e-mail antes de entrar.';
    case 'email_exists':
      return 'Já existe uma conta com este e-mail.';
    case 'same_password':
      return 'A nova senha precisa ser diferente da atual.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Confira o e-mail digitado.';
    case 'over_email_send_rate_limit':
      return 'Muitos e-mails enviados em pouco tempo. Espere alguns minutos e tente de novo.';
    case 'over_request_rate_limit':
      return 'Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo.';
    case 'signup_disabled':
      return 'Novos cadastros estão pausados no momento.';
    case 'user_banned':
      return 'Esta conta está bloqueada. Fale com o suporte.';
    case 'otp_expired':
      return 'O link expirou. Peça um novo e-mail.';
    // Token de acesso inválido ou vencido recusado pelo banco (PostgREST), ex.: chave do projeto trocada (BUG-022)
    case 'PGRST301':
    case 'PGRST302':
    case 'PGRST303':
    case 'session_expired':
    case 'session_not_found':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
      return 'Sua sessão expirou. Entre de novo.';
  }
  // Outros erros de login vêm em inglês do Supabase: mostra um texto em português
  if ((error as { name?: string }).name?.startsWith('Auth')) {
    return 'Não foi possível concluir agora. Tente de novo em instantes.';
  }
  return error.message ?? 'Erro desconhecido';
}
