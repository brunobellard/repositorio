// Endereço do site publicado (versão web do app): páginas legais, redefinição de senha.
import { Platform } from 'react-native';

/**
 * Ex: https://projeto-app-beleza.expo.app
 * Usa EXPO_PUBLIC_WEB_URL; se não existir, o mesmo endereço do link de agendamento.
 */
export function webBaseUrl(): string | null {
  const env = (process.env.EXPO_PUBLIC_WEB_URL || process.env.EXPO_PUBLIC_BOOKING_URL)?.replace(/\/+$/, '');
  if (env) return env;
  // No navegador, usa o próprio endereço (útil para testar localmente)
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return null;
}

export const LEGAL_PATHS = { terms: '/termos', privacy: '/privacidade' } as const;

/** Endereço completo de uma página do site (ou só o caminho, se o site não estiver configurado). */
export function webUrl(path: string): string {
  const base = webBaseUrl();
  return base ? `${base}${path}` : path;
}
