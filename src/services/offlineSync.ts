// Suporte offline: cópia local dos dados (cache) e fila de alterações (outbox).
//
// - Cache: a última cópia carregada do Supabase fica no aparelho. Sem internet,
//   o app abre na hora com esses dados em vez de dar erro.
// - Outbox: criar cliente, criar agendamento e concluir atendimento sem internet
//   entram numa fila local; a tela já mostra a mudança (optimistic UI) e a fila
//   é enviada ao Supabase sozinha quando a conexão volta.
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';

import type {
  Appointment,
  BusinessHours,
  Client,
  ClientHistory,
  ClientPackage,
  MessageTemplate,
  PaymentMethod,
  Profile,
  ScheduleBlock,
  Service,
  ServiceArea,
  Transaction,
} from '@/types';

// ---------------------------------------------------------------------
// Conexão
// ---------------------------------------------------------------------
const isOnlineState = (s: NetInfoState) => s.isConnected !== false && s.isInternetReachable !== false;

export async function isOnline(): Promise<boolean> {
  try {
    return isOnlineState(await NetInfo.fetch());
  } catch {
    return true; // na dúvida, tenta a internet (o Supabase dirá se falhou)
  }
}

/** true/false conforme a conexão; atualiza sozinho quando ela cai ou volta. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(isOnlineState(s))), []);
  return online;
}

/** Chama `onReconnect` sempre que a conexão volta depois de cair. */
export function onReconnect(onReconnectCb: () => void): () => void {
  let wasOnline = true;
  return NetInfo.addEventListener((s) => {
    const now = isOnlineState(s);
    if (now && !wasOnline) onReconnectCb();
    wasOnline = now;
  });
}

/** Erro de rede (sem internet / servidor inacessível), diferente de erro de regra do banco. */
export function isNetworkError(e: { message?: string } | null | undefined): boolean {
  return /network request failed|failed to fetch|fetch failed|networkerror|load failed|timed? ?out/i.test(
    e?.message ?? '',
  );
}

export const newId = () => Crypto.randomUUID();

// ---------------------------------------------------------------------
// Cache dos dados
// ---------------------------------------------------------------------
export interface Snapshot {
  savedAt: string;
  profile: Profile;
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  transactions: Transaction[];
  templates: MessageTemplate[];
  businessHours: BusinessHours[];
  packages: ClientPackage[];
  /** Opcional: caches antigos não têm */
  serviceAreas?: ServiceArea[];
  /** Opcional: caches antigos não têm */
  clientHistory?: Record<string, ClientHistory>;
}

const cacheKey = (uid: string) => `agenda-beleza:cache:v1:${uid}`;
const outboxKey = (uid: string) => `agenda-beleza:outbox:v1:${uid}`;

export async function loadSnapshot(uid: string): Promise<Snapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid));
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(uid: string, s: Omit<Snapshot, 'savedAt'>) {
  try {
    await AsyncStorage.setItem(cacheKey(uid), JSON.stringify({ ...s, savedAt: new Date().toISOString() }));
  } catch {
    // sem espaço / navegador privado: segue sem cache
  }
}

export async function clearOfflineData(uid: string) {
  try {
    await AsyncStorage.multiRemove([cacheKey(uid), outboxKey(uid)]);
  } catch {
    // ignora
  }
}

// ---------------------------------------------------------------------
// Fila de alterações (outbox)
// ---------------------------------------------------------------------
export type OutboxOp =
  | {
      kind: 'addClient';
      /** id gerado no aparelho: o mesmo id é gravado no Supabase (sem precisar trocar depois) */
      row: { id: string; name: string; whatsapp: string | null; email: string | null; birth_date: string | null; technical_notes: string | null };
    }
  | {
      kind: 'addAppointment';
      appointment: {
        id: string;
        client_id: string;
        starts_at: string;
        ends_at: string;
        status: 'pendente';
        total_price: number;
        notes: string | null;
        source: 'manual';
        client_package_id: string | null;
      };
      services: { service_id: string; name: string; price: number; duration_min: number; position: number }[];
    }
  | { kind: 'completeAppointment'; appointmentId: string; method: PaymentMethod | null };

export interface OutboxItem {
  id: string;
  createdAt: string;
  op: OutboxOp;
}

export async function loadOutbox(uid: string): Promise<OutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(outboxKey(uid));
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveOutbox(uid: string, items: OutboxItem[]) {
  try {
    if (items.length) await AsyncStorage.setItem(outboxKey(uid), JSON.stringify(items));
    else await AsyncStorage.removeItem(outboxKey(uid));
  } catch {
    // ignora
  }
}

export const outboxItem = (op: OutboxOp): OutboxItem => ({ id: newId(), createdAt: new Date().toISOString(), op });

/** Descrição curta de uma alteração pendente (para avisos). */
export function describeOp(op: OutboxOp): string {
  switch (op.kind) {
    case 'addClient':
      return `cadastro de ${op.row.name}`;
    case 'addAppointment':
      return 'novo agendamento';
    case 'completeAppointment':
      return 'conclusão de atendimento';
  }
}
