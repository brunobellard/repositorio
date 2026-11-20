// Cliente do Supabase para os testes de API (Node, sem AsyncStorage).
// Lê EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY do ambiente (CI) ou do .env.local (local).
// Só a chave pública: os testes enxergam o banco exatamente como o app e o link público.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
// O .env.local é carregado antes, em __tests__/load-env.js (setupFiles do Jest)

// Leitura por nome (process.env[nome]): o babel do Expo troca process.env.EXPO_PUBLIC_* por um módulo do app
const env = (name: string) => process.env[name] ?? '';
export const SUPABASE_URL = env('EXPO_PUBLIC_SUPABASE_URL');
export const SUPABASE_KEY = env('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
export const configured = !!SUPABASE_URL && !!SUPABASE_KEY;

/** Conta de teste (só no ambiente/segredos do GitHub, nunca no repositório). */
export const TEST_EMAIL = env('QA_TEST_EMAIL');
export const TEST_PASSWORD = env('QA_TEST_PASSWORD');
export const hasTestAccount = configured && !!TEST_EMAIL && !!TEST_PASSWORD;

export function newClient(): SupabaseClient {
  return createClient(SUPABASE_URL || 'http://localhost', SUPABASE_KEY || 'missing', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Slug que certamente não existe */
export const MISSING_SLUG = 'qa-nao-existe-' + 'x'.repeat(10);
