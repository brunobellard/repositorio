// Medição de uso (docs/ux/metricas.md, opção A): eventos curtos gravados na tabela app_events.
//
// Regras:
// - NUNCA mandar dados das clientes (nome, telefone, e-mail, endereço, observações, ids) nem texto digitado.
//   Só nomes de evento e números / códigos curtos; sanitizeProps descarta o resto.
// - track() nunca lança erro e nunca trava a tela: junta os eventos e envia em lote.
// - Sem internet (ou sem a migração no banco), os eventos ficam numa fila no aparelho e
//   seguem depois; a fila tem limite, e o que passar dele é descartado.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { isValidEventName, sanitizeProps, type EventProps } from '@/lib/analytics-props';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type { EventProps } from '@/lib/analytics-props';

interface QueuedEvent {
  name: string;
  props: Record<string, string | number | boolean>;
  platform: string;
  app_version: string | null;
  session_id: string;
  created_at: string;
}

const QUEUE_KEY = 'analytics-queue-v1';
const MAX_QUEUE = 300;
const BATCH = 50;
const FLUSH_MS = 15_000;

const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
const appVersion = (Constants.expoConfig?.version ?? null) as string | null;

/** Identificador desta abertura do app (aleatório, não liga a pessoa a nada fora da conta). */
export const sessionId = randomId();

function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 24);
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

let queue: QueuedEvent[] = [];
let loaded = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;

async function loadQueue() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = await AsyncStorage.getItem(QUEUE_KEY);
    if (saved) queue = [...(JSON.parse(saved) as QueuedEvent[]), ...queue].slice(-MAX_QUEUE);
  } catch {
    // Fila do aparelho ilegível: começa vazia
  }
}

function persist() {
  AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE))).catch(() => {});
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, FLUSH_MS);
}

/** Registra um evento do app logado. Nunca lança erro. */
export function track(name: string, props?: EventProps) {
  try {
    if (!isSupabaseConfigured || !isValidEventName(name)) return;
    queue.push({
      name,
      props: sanitizeProps(props),
      platform,
      app_version: appVersion,
      session_id: sessionId,
      created_at: new Date().toISOString(),
    });
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    persist();
    if (queue.length >= BATCH) flush();
    else schedule();
  } catch {
    // A medição nunca atrapalha o uso
  }
}

/** Envia o que estiver na fila (só com login; a conta é preenchida pelo banco). */
export function flush(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      await loadQueue();
      if (!queue.length) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return; // sem login: espera (a fila fica no aparelho)
      while (queue.length) {
        const batch = queue.slice(0, BATCH);
        // created_at é preenchido pelo banco; o atraso da fila vai em queued_s
        const rows = batch.map(({ created_at, ...e }) => ({ ...e, props: { ...e.props, queued_s: secondsSince(created_at) } }));
        const { error } = await supabase.from('app_events').insert(rows);
        if (error) {
          // Erro de dados (ex.: migração não rodou): descarta para não insistir para sempre
          if (!/fetch|network|timeout/i.test(error.message ?? '')) queue = queue.slice(batch.length);
          break;
        }
        queue = queue.slice(batch.length);
      }
      persist();
    } catch {
      // Sem internet: tenta de novo no próximo evento
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

const secondsSince = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));

/** Esquece a fila (ao sair da conta: os eventos pendentes eram da conta anterior). */
export function resetAnalytics() {
  queue = [];
  persist();
}

// ---------------------------------------------------------------------
// Link público (sem login): grava direto pela função log_public_event
// ---------------------------------------------------------------------
const publicVisit = randomId();

/** Funil do agendamento online. Só números e códigos; nunca nome ou WhatsApp de quem agenda. */
export function trackPublic(slug: string, name: string, props?: EventProps) {
  try {
    if (!isSupabaseConfigured || !slug || !isValidEventName(name)) return;
    supabase
      .rpc('log_public_event', {
        p_slug: slug,
        p_name: name,
        p_props: sanitizeProps(props),
        p_session: publicVisit,
        p_platform: platform,
      })
      .then(
        () => {},
        () => {},
      );
  } catch {
    // A medição nunca atrapalha o agendamento
  }
}
