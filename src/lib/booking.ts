// Link público de agendamento online.
import { Platform } from 'react-native';

import { normalize } from '@/lib/format';

/**
 * Endereço do site publicado (ex: https://agenda-beleza.expo.app).
 * Defina EXPO_PUBLIC_BOOKING_URL no .env.local depois de publicar a versão web.
 */
export function bookingBaseUrl(): string | null {
  const env = process.env.EXPO_PUBLIC_BOOKING_URL?.replace(/\/+$/, '');
  if (env) return env;
  // No navegador, usa o próprio endereço (útil para testar localmente)
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return null;
}

export function bookingUrl(slug: string): string | null {
  const base = bookingBaseUrl();
  return base ? `${base}/agendar/${slug}` : null;
}

/** "Studio Ana Lima" -> "studio-ana-lima" */
export function slugify(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export const isValidSlug = (s: string) => /^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$/.test(s);

/** Limpa o que a pessoa digita no campo do link, sem atrapalhar a digitação (mantém o hífen no fim). */
export function sanitizeSlugInput(text: string): string {
  return normalize(text)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40);
}
