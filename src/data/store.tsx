// Estado do app sincronizado com o Supabase.
// As telas usam useStore(); cada ação grava no banco e atualiza a tela.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { openUpgrade } from '@/lib/upgrade';
import { LIMIT_TO_FEATURE } from '@/constants/plans';
import { useAuth } from '@/data/auth';
import {
  defaultBusinessHours,
  clientTemplates,
  defaultTemplates,
  exampleFees,
  exampleStudio,
  exampleTimeOffs,
  mockAppointments,
  mockClients,
  mockTransactions,
} from '@/data/mock';
import { notify } from '@/lib/confirm';
import { addDays, atMinutes, startOfDay } from '@/lib/dates';
import { amountDue, feeFor } from '@/lib/packages';
import {
  describeOp,
  isNetworkError,
  isOnline,
  loadOutbox,
  loadSnapshot,
  newId,
  onReconnect,
  outboxItem,
  saveOutbox,
  saveSnapshot,
  useOnline,
  type OutboxItem,
  type OutboxOp,
  type Snapshot,
} from '@/services/offlineSync';
import { generateOccurrences, type SeriesScope } from '@/lib/recurrence';
import { friendlyError, supabase } from '@/lib/supabase';
import { DEFAULT_THEME_COLOR } from '@/theme/palette';
import type {
  Appointment,
  BusinessHours,
  ClientPackage,
  PaymentFees,
  AppointmentStatus,
  Client,
  MessageTemplate,
  PaymentMethod,
  Profile,
  LocationType,
  ScheduleBlock,
  Service,
  ServiceArea,
  Transaction,
} from '@/types';

// ---------------------------------------------------------------------
// Conversão banco (snake_case) -> app (camelCase)
// ---------------------------------------------------------------------
export const ZERO_FEES: PaymentFees = { debit: 0, credit: 0, pix: 0, cash: 0 };

const toProfile = (r: any): Profile => ({
  id: r.id,
  businessName: r.business_name || 'Meu estúdio',
  ownerName: r.owner_name || '',
  phone: r.phone ?? undefined,
  email: r.email ?? undefined,
  workStart: String(r.work_start).slice(0, 5),
  workEnd: String(r.work_end).slice(0, 5),
  slotMinutes: r.slot_minutes,
  tradeName: r.trade_name ?? undefined,
  document: r.document ?? undefined,
  instagram: r.instagram ?? undefined,
  logoUrl: r.logo_url ?? undefined,
  addressZip: r.address_zip ?? undefined,
  addressStreet: r.address_street ?? undefined,
  addressNumber: r.address_number ?? undefined,
  addressDistrict: r.address_district ?? undefined,
  addressCity: r.address_city ?? undefined,
  addressState: r.address_state ?? undefined,
  paymentFees: { ...ZERO_FEES, ...(r.payment_fees ?? {}) },
  recallDays: r.recall_days ?? 20,
  slug: r.slug ?? undefined,
  bookingAutoApprove: !!r.booking_auto_approve,
  expoPushToken: r.expo_push_token ?? undefined,
  pushNotificationsEnabled: r.push_notifications_enabled ?? true,
  // Sem as colunas (migração de planos pendente): não bloqueia nada
  planTier: r.plan_tier ?? 'pro',
  subscriptionStatus: r.subscription_status ?? 'active',
  trialEndsAt: r.trial_ends_at ?? undefined,
  billingCycle: r.billing_cycle ?? 'monthly',
  // Sem a coluna (migração pendente): não prende ninguém no onboarding
  onboardingCompleted: r.onboarding_completed ?? true,
  serviceMode: r.service_mode ?? 'fixed',
  travelBufferMinutes: r.travel_buffer_minutes ?? 30,
  themeColor: r.theme_color ?? DEFAULT_THEME_COLOR,
});
const toArea = (r: any): ServiceArea => ({
  id: r.id,
  name: r.neighborhood_name,
  travelFee: Number(r.travel_fee ?? 0),
  allowedDays: (r.allowed_days ?? []).map(Number).sort(),
  isActive: r.is_active ?? true,
});
const toService = (r: any): Service => ({
  id: r.id,
  name: r.name,
  category: r.category ?? 'Outros',
  price: Number(r.price),
  durationMin: r.duration_min,
  color: r.color ?? '#E8B4BC',
  active: r.active ?? true,
});
const hm = (t: string | null) => (t ? String(t).slice(0, 5) : undefined);
const toHours = (r: any): BusinessHours => ({
  dayOfWeek: r.day_of_week,
  isOpen: r.is_open,
  openTime: hm(r.open_time)!,
  closeTime: hm(r.close_time)!,
  breakStart: hm(r.break_start),
  breakEnd: hm(r.break_end),
});
const toClient = (r: any): Client => ({
  id: r.id,
  name: r.name,
  whatsapp: r.whatsapp ?? undefined,
  email: r.email ?? undefined,
  birthDate: r.birth_date ?? undefined,
  technicalNotes: r.technical_notes ?? undefined,
  address: r.address ?? undefined,
  neighborhood: r.neighborhood ?? undefined,
});
const toAppointment = (r: any): Appointment => ({
  id: r.id,
  clientId: r.client_id,
  startsAt: new Date(r.starts_at).toISOString(),
  endsAt: new Date(r.ends_at).toISOString(),
  status: r.status,
  totalPrice: Number(r.total_price),
  notes: r.notes ?? undefined,
  recurrenceGroupId: r.recurrence_group_id ?? undefined,
  recurrenceRule: r.recurrence_rule ?? undefined,
  isRecurrenceException: !!r.is_recurrence_exception,
  clientPackageId: r.client_package_id ?? undefined,
  source: r.source === 'online' ? 'online' : 'manual',
  locationType: r.location_type === 'home_service' ? 'home_service' : 'fixed',
  serviceAddress: r.service_address ?? undefined,
  travelFee: Number(r.travel_fee ?? 0),
  services: [...(r.appointment_services ?? [])]
    .sort((a: any, b: any) => a.position - b.position)
    .map((s: any) => ({ serviceId: s.service_id, name: s.name, price: Number(s.price), durationMin: s.duration_min })),
});
const toBlock = (r: any): ScheduleBlock => ({
  id: r.id,
  startsAt: new Date(r.starts_at).toISOString(),
  endsAt: new Date(r.ends_at).toISOString(),
  allDay: r.all_day,
  reason: r.reason ?? undefined,
});
const toTransaction = (r: any): Transaction => ({
  id: r.id,
  type: r.type,
  amount: Number(r.amount),
  category: r.category,
  description: r.description ?? undefined,
  paymentMethod: r.payment_method ?? undefined,
  appointmentId: r.appointment_id ?? undefined,
  clientPackageId: r.client_package_id ?? undefined,
  occurredAt: new Date(r.occurred_at).toISOString(),
  grossAmount: Number(r.gross_amount ?? r.amount),
  feeAmount: Number(r.fee_amount ?? 0),
  netAmount: Number(r.net_amount ?? r.amount),
});
const toPackage = (r: any): ClientPackage => ({
  id: r.id,
  clientId: r.client_id,
  serviceId: r.service_id,
  name: r.name,
  totalSessions: r.total_sessions,
  usedSessions: r.used_sessions,
  totalPaid: Number(r.total_paid),
  paymentMethod: r.payment_method,
  status: r.status,
  expiresAt: r.expires_at ?? undefined,
  createdAt: r.created_at,
});
const toTemplate = (r: any): MessageTemplate => ({
  channel: r.channel,
  kind: r.kind,
  subject: r.subject ?? undefined,
  body: r.body,
});

// Há duas chaves ligando appointment_services a appointments (a simples e a composta
// id+owner_id da blindagem RLS); o "!" diz ao Supabase qual usar, evitando ambiguidade.
const APPT_SELECT = '*, appointment_services!appt_services_appt_same_owner(*)';

// ---------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------
export interface NewAppointment {
  clientId: string;
  startsAt: string;
  serviceIds: string[];
  notes?: string;
  /** Série recorrente: início de cada sessão (inclui a primeira). Sem isso, cria só uma. */
  occurrences?: string[];
  /** Regra iCalendar salva junto da série */
  recurrenceRule?: string | null;
  /** Usar crédito deste pacote (as sessões não geram nova cobrança) */
  clientPackageId?: string;
  /** Atendimento a domicílio: endereço e taxa de deslocamento (somada ao total) */
  locationType?: LocationType;
  serviceAddress?: string;
  travelFee?: number;
}

export interface NewPackage {
  clientId: string;
  serviceId: string;
  name: string;
  totalSessions: number;
  totalPaid: number;
  paymentMethod: PaymentMethod;
  expiresAt?: string; // 'YYYY-MM-DD'
}

export interface AppointmentChanges {
  /** Quanto mover cada sessão, em milissegundos */
  shiftMs: number;
  /** Novos serviços (undefined = manter) */
  serviceIds?: string[];
  /** Observações da sessão editada */
  notes?: string;
}

interface Store {
  loading: boolean;
  profile: Profile;
  services: Service[];
  clients: Client[];
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  transactions: Transaction[];
  templates: MessageTemplate[];

  /** Busca tudo no Supabase; false quando não conseguiu (ex: sem internet) */
  reload: () => Promise<boolean>;

  // Offline
  /** Há conexão com a internet agora */
  online: boolean;
  /** Alterações feitas sem internet que ainda não foram enviadas */
  pendingSync: number;
  /** Enviando a fila de alterações para o Supabase */
  syncing: boolean;
  /** Puxar para atualizar: envia pendências e recarrega */
  refresh: () => Promise<void>;
  /** Cria um agendamento ou uma série inteira (tudo ou nada). Retorna quantos foram criados. */
  addAppointment: (a: NewAppointment) => Promise<number>;
  /**
   * Edita uma sessão ou várias da série. `editedId` é a sessão aberta na tela;
   * `ids` são todas as afetadas (ver seriesTargets).
   */
  updateAppointments: (
    editedId: string,
    ids: string[],
    changes: AppointmentChanges,
    scope: SeriesScope,
  ) => Promise<boolean>;
  cancelAppointments: (ids: string[]) => Promise<boolean>;
  setAppointmentStatus: (id: string, status: Exclude<AppointmentStatus, 'concluido'>) => Promise<void>;
  /** `method` é ignorado em sessões de pacote (já foram pagas na venda) */
  /** true se concluiu (ou ficou na fila offline) */
  completeAppointment: (id: string, method?: PaymentMethod) => Promise<boolean>;

  // Pacotes pré-pagos e taxas
  packages: ClientPackage[];
  /** Cria o pacote e lança o valor recebido no Financeiro */
  sellPackage: (p: NewPackage) => Promise<boolean>;
  updatePaymentFees: (fees: PaymentFees) => Promise<boolean>;
  addBlock: (b: Omit<ScheduleBlock, 'id'>) => Promise<boolean>;
  removeBlock: (id: string) => Promise<void>;
  addClient: (c: Omit<Client, 'id'>) => Promise<Client | null>;
  addTransaction: (t: Omit<Transaction, 'id' | 'grossAmount' | 'feeAmount' | 'netAmount'>) => Promise<boolean>;
  /** Exclui uma despesa lançada à mão (receitas saem ao desfazer a conclusão ou o pacote). */
  deleteExpense: (id: string) => Promise<boolean>;
  updateTemplate: (t: MessageTemplate) => Promise<boolean>;
  loadExampleData: () => Promise<void>;

  // Ajustes
  /** Expediente dos 7 dias (índice = dia da semana, 0 = domingo) */
  businessHours: BusinessHours[];
  /** false enquanto a migração de Ajustes não foi aplicada no Supabase */
  hoursAvailable: boolean;
  updateProfile: (patch: Partial<Omit<Profile, 'id'>>) => Promise<boolean>;
  uploadLogo: (base64: string, mimeType: string) => Promise<boolean>;
  saveService: (s: Omit<Service, 'id' | 'color'> & { id?: string }) => Promise<boolean>;
  setServiceActive: (id: string, active: boolean) => Promise<void>;
  /** 'in_use' quando o serviço já aparece em agendamentos (aí só dá para desativar) */
  deleteService: (id: string) => Promise<'ok' | 'in_use' | 'error'>;
  saveBusinessHours: (hours: BusinessHours[]) => Promise<boolean>;

  // Atendimento a domicílio
  /** Bairros/regiões atendidos */
  serviceAreas: ServiceArea[];
  saveServiceArea: (a: Omit<ServiceArea, 'id'> & { id?: string }) => Promise<boolean>;
  deleteServiceArea: (id: string) => Promise<boolean>;
  /** Guarda endereço e bairro na ficha da cliente */
  updateClientAddress: (id: string, address?: string, neighborhood?: string) => Promise<boolean>;
}

/** Campos do perfil (app) -> colunas do banco */
const PROFILE_COLUMNS: Partial<Record<keyof Profile, string>> = {
  businessName: 'business_name',
  ownerName: 'owner_name',
  phone: 'phone',
  email: 'email',
  slotMinutes: 'slot_minutes',
  recallDays: 'recall_days',
  slug: 'slug',
  bookingAutoApprove: 'booking_auto_approve',
  expoPushToken: 'expo_push_token',
  pushNotificationsEnabled: 'push_notifications_enabled',
  tradeName: 'trade_name',
  document: 'document',
  instagram: 'instagram',
  logoUrl: 'logo_url',
  addressZip: 'address_zip',
  addressStreet: 'address_street',
  addressNumber: 'address_number',
  addressDistrict: 'address_district',
  addressCity: 'address_city',
  addressState: 'address_state',
  onboardingCompleted: 'onboarding_completed',
  serviceMode: 'service_mode',
  travelBufferMinutes: 'travel_buffer_minutes',
  themeColor: 'theme_color',
};

const CATEGORY_COLORS: Record<string, string> = {
  Unhas: '#E8B4BC',
  Sobrancelhas: '#C9A98A',
  Cílios: '#9FB3A1',
  Estética: '#A9B8C9',
};

/** Sufixo único para nomes de arquivo enviados ao Storage. */
function uniqueSuffix() {
  return Date.now().toString(36);
}

/** Converte base64 em bytes para enviar ao Storage (funciona no celular e na web). */
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const emptyProfile: Profile = {
  id: '',
  businessName: '',
  ownerName: '',
  workStart: '08:00',
  workEnd: '20:00',
  slotMinutes: 15,
  paymentFees: ZERO_FEES,
  recallDays: 20,
  bookingAutoApprove: false,
  pushNotificationsEnabled: true,
  planTier: 'pro',
  subscriptionStatus: 'active',
  billingCycle: 'monthly',
  onboardingCompleted: true,
  serviceMode: 'fixed',
  travelBufferMinutes: 30,
  themeColor: DEFAULT_THEME_COLOR,
};

const StoreContext = createContext<Store | null>(null);

function fail(error: { code?: string; message?: string } | null) {
  // Limite do plano barrado pelo banco: mostra o aviso de upgrade em vez de um erro
  const limit = error?.message?.match(/PLAN_LIMIT:(\w+)/)?.[1];
  if (limit && LIMIT_TO_FEATURE[limit]) {
    openUpgrade(LIMIT_TO_FEATURE[limit]);
    return false;
  }
  notify('Não foi possível salvar', friendlyError(error));
  return false;
}

/** Envia ao Supabase uma alteração que ficou na fila offline. Devolve o erro, se houver. */
async function runOp(op: OutboxOp): Promise<{ code?: string; message?: string } | null> {
  switch (op.kind) {
    case 'addClient': {
      const { error } = await supabase.from('clients').upsert(op.row, { onConflict: 'id', ignoreDuplicates: true });
      return error;
    }
    case 'addAppointment': {
      // Já enviado antes (ex: a conexão caiu no meio)? Não duplica.
      const { data: exists, error: e0 } = await supabase
        .from('appointments')
        .select('id')
        .eq('id', op.appointment.id)
        .maybeSingle();
      if (e0) return e0;
      if (exists) return null;
      const { error } = await supabase.from('appointments').insert(op.appointment);
      if (error) return error;
      const { error: e2 } = await supabase
        .from('appointment_services')
        .insert(op.services.map((s) => ({ ...s, appointment_id: op.appointment.id })));
      if (e2) {
        // Sem os serviços o agendamento fica incompleto: desfaz
        await supabase.from('appointments').delete().eq('id', op.appointment.id);
        return e2;
      }
      return null;
    }
    case 'completeAppointment': {
      const { error } = await supabase.rpc('complete_appointment', {
        p_appointment_id: op.appointmentId,
        p_payment_method: op.method,
      });
      return error;
    }
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id;

  // Carregando enquanto os dados do usuário logado ainda não chegaram
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = !!userId && loadedFor !== userId;
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [packages, setPackages] = useState<ClientPackage[]>([]);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>(defaultBusinessHours);
  const [hoursAvailable, setHoursAvailable] = useState(true);
  const seeded = useRef<string | null>(null);

  // Offline: conexão, fila de alterações pendentes e sincronização
  const online = useOnline();
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const outboxRef = useRef<OutboxItem[]>([]);
  const flushing = useRef(false);

  /** Atualiza a fila na memória e no aparelho. */
  const writeOutbox = useCallback(
    (items: OutboxItem[]) => {
      outboxRef.current = items;
      setOutbox(items);
      if (userId) saveOutbox(userId, items);
    },
    [userId],
  );
  const enqueue = (op: OutboxOp) => writeOutbox([...outboxRef.current, outboxItem(op)]);

  /**
   * Conta nova: cria os modelos de mensagem e o expediente padrão.
   * Os serviços NÃO são criados aqui: quem cadastra é o passo de especialidade do primeiro acesso.
   */
  const ensureDefaults = useCallback(async (uid: string) => {
    if (seeded.current === uid) return;
    seeded.current = uid;
    await supabase.from('message_templates').upsert(
      defaultTemplates.map((t) => ({ channel: t.channel, kind: t.kind, subject: t.subject ?? null, body: t.body })),
      { onConflict: 'owner_id,channel,kind', ignoreDuplicates: true },
    );
    // Retorno e aniversário (separado: depende da migração de retorno de clientes)
    await supabase.from('message_templates').upsert(
      clientTemplates.map((t) => ({ channel: t.channel, kind: t.kind, subject: null, body: t.body })),
      { onConflict: 'owner_id,channel,kind', ignoreDuplicates: true },
    );
    // Expediente padrão (ignora erro se a migração de Ajustes ainda não rodou)
    await supabase.from('business_hours').upsert(
      defaultBusinessHours.map((h) => ({
        day_of_week: h.dayOfWeek,
        is_open: h.isOpen,
        open_time: h.openTime,
        close_time: h.closeTime,
        break_start: h.breakStart ?? null,
        break_end: h.breakEnd ?? null,
      })),
      { onConflict: 'owner_id,day_of_week', ignoreDuplicates: true },
    );
  }, []);

  /** Aplica uma cópia completa dos dados na tela (do cache ou do Supabase). */
  const applySnapshot = useCallback((snap: Omit<Snapshot, 'savedAt'>) => {
    setProfile(snap.profile);
    setServices(snap.services);
    setClients(snap.clients);
    setAppointments(snap.appointments);
    setBlocks(snap.blocks);
    setTransactions(snap.transactions);
    setTemplates(snap.templates);
    setBusinessHours(snap.businessHours);
    setPackages(snap.packages);
    setServiceAreas(snap.serviceAreas ?? []);
  }, []);

  /**
   * Busca tudo no Supabase. Sem internet (erro de rede), mantém o que está na tela
   * (vindo do cache) em vez de zerar as listas. Retorna true se carregou.
   */
  const reload = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    const [p, s, c, a, b, t, m, h, pk, ar] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('services').select('*').order('name'),
      supabase.from('clients').select('*').order('name'),
      supabase.from('appointments').select(APPT_SELECT).order('starts_at'),
      supabase.from('schedule_blocks').select('*').order('starts_at'),
      supabase.from('transactions').select('*').order('occurred_at', { ascending: false }),
      supabase.from('message_templates').select('*'),
      supabase.from('business_hours').select('*'),
      supabase.from('client_packages').select('*').order('created_at', { ascending: false }),
      // Sem a tabela (migração de domicílio pendente): lista vazia
      supabase.from('service_areas').select('*').order('neighborhood_name'),
    ]);
    const firstError = [p, s, c, a, b, t, m].find((r) => r.error)?.error;
    // Sem internet: não mexe nos dados da tela (o cache continua valendo)
    if (firstError && isNetworkError(firstError)) return false;
    if (firstError) notify('Erro ao carregar dados', friendlyError(firstError));
    if (!p.data) return false;

    // Sem a tabela business_hours (migração pendente), usa o expediente padrão
    setHoursAvailable(!h.error);
    const savedHours = (h.data ?? []).map(toHours);
    const snap = {
      profile: toProfile(p.data),
      services: (s.data ?? []).map(toService),
      clients: (c.data ?? []).map(toClient),
      appointments: (a.data ?? []).map(toAppointment),
      blocks: (b.data ?? []).map(toBlock),
      transactions: (t.data ?? []).map(toTransaction),
      templates: (m.data ?? []).map(toTemplate),
      businessHours: defaultBusinessHours.map((d) => savedHours.find((x) => x.dayOfWeek === d.dayOfWeek) ?? d),
      packages: (pk.data ?? []).map(toPackage),
      serviceAreas: (ar.data ?? []).map(toArea),
    };
    applySnapshot(snap);
    return true;
  }, [userId, applySnapshot]);

  // Guarda no aparelho a cópia atual (inclusive mudanças feitas offline)
  useEffect(() => {
    if (!userId || loadedFor !== userId || !profile.id) return;
    const t = setTimeout(
      () =>
        saveSnapshot(userId, {
          profile,
          services,
          clients,
          appointments,
          blocks,
          transactions,
          templates,
          businessHours,
          packages,
          serviceAreas,
        }),
      400,
    );
    return () => clearTimeout(t);
  }, [userId, loadedFor, profile, services, clients, appointments, blocks, transactions, templates, businessHours, packages, serviceAreas]);

  /**
   * Envia a fila de alterações feitas offline, na ordem em que foram feitas.
   * Para no primeiro erro de rede (tenta de novo depois); conflitos (ex: horário
   * já ocupado) descartam aquela alteração e avisam.
   */
  const flushOutbox = useCallback(async (): Promise<boolean> => {
    if (flushing.current || !outboxRef.current.length) return false;
    flushing.current = true;
    setSyncing(true);
    let sent = 0;
    const dropped: string[] = [];
    try {
      while (outboxRef.current.length) {
        const [item, ...rest] = outboxRef.current;
        const error = await runOp(item.op);
        if (error && isNetworkError(error)) break; // continua offline: tenta depois
        if (error) dropped.push(`${describeOp(item.op)} (${friendlyError(error)})`);
        else sent++;
        writeOutbox(rest);
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
    }
    if (dropped.length) notify('Não foi possível sincronizar', dropped.join('; '));
    else if (sent) notify('Sincronizado com a nuvem', `${sent} ${sent === 1 ? 'alteração enviada' : 'alterações enviadas'}.`);
    return sent > 0 || dropped.length > 0;
  }, [writeOutbox]);

  // Abertura do app: mostra o cache na hora, depois sincroniza com o Supabase
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [cached, pending] = await Promise.all([loadSnapshot(userId), loadOutbox(userId)]);
      if (cancelled) return;
      outboxRef.current = pending;
      setOutbox(pending);
      if (cached) {
        applySnapshot(cached);
        setLoadedFor(userId); // tela pronta com os dados do aparelho
      }
      if (await isOnline()) {
        await ensureDefaults(userId);
        await flushOutbox();
        await reload();
      }
      if (!cancelled) setLoadedFor(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, ensureDefaults, reload, applySnapshot, flushOutbox]);

  // Quando a internet volta: envia a fila e atualiza os dados
  useEffect(() => {
    if (!userId) return;
    return onReconnect(async () => {
      await flushOutbox();
      await reload();
    });
  }, [userId, reload, flushOutbox]);

  async function refreshAppointment(id: string) {
    const { data } = await supabase.from('appointments').select(APPT_SELECT).eq('id', id).single();
    if (data) setAppointments((list) => list.map((x) => (x.id === id ? toAppointment(data) : x)));
  }

  async function refreshPackages() {
    const { data } = await supabase.from('client_packages').select('*').order('created_at', { ascending: false });
    if (data) setPackages(data.map(toPackage));
  }

  const store: Store = {
    loading,
    profile,
    services,
    clients,
    appointments,
    blocks,
    transactions,
    templates,
    packages,
    businessHours,

    async sellPackage(p) {
      const { error } = await supabase.rpc('sell_package', {
        p_client_id: p.clientId,
        p_service_id: p.serviceId,
        p_name: p.name,
        p_total_sessions: p.totalSessions,
        p_total_paid: p.totalPaid,
        p_payment_method: p.paymentMethod,
        p_expires_at: p.expiresAt ?? null,
      });
      if (error) return fail(error);
      // Pacote novo + receita lançada (com taxa calculada no banco)
      const [pk, tx] = await Promise.all([
        supabase.from('client_packages').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').order('occurred_at', { ascending: false }),
      ]);
      if (pk.data) setPackages(pk.data.map(toPackage));
      if (tx.data) setTransactions(tx.data.map(toTransaction));
      return true;
    },

    async updatePaymentFees(fees) {
      const { data, error } = await supabase
        .from('profiles')
        .update({ payment_fees: fees })
        .eq('id', userId!)
        .select()
        .single();
      if (error) return fail(error);
      setProfile(toProfile(data));
      return true;
    },
    hoursAvailable,
    reload,

    async updateProfile(patch) {
      const row: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        const col = PROFILE_COLUMNS[k as keyof Profile];
        if (col) row[col] = v === '' || v === undefined ? null : v;
      }
      const { data, error } = await supabase.from('profiles').update(row).eq('id', userId!).select().single();
      if (error) return fail(error);
      setProfile(toProfile(data));
      return true;
    },

    async uploadLogo(base64, mimeType) {
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      // Nome novo a cada envio: evita o logo antigo ficar em cache
      const path = `${userId}/logo-${uniqueSuffix()}.${ext}`;
      const { error } = await supabase.storage.from('logos').upload(path, base64ToBytes(base64), {
        contentType: mimeType,
      });
      if (error) {
        notify('Não foi possível enviar o logo', error.message);
        return false;
      }
      const old = profile.logoUrl?.split('/logos/')[1];
      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      const ok = await store.updateProfile({ logoUrl: data.publicUrl });
      if (ok && old) await supabase.storage.from('logos').remove([decodeURIComponent(old)]);
      return ok;
    },

    async saveService({ id, ...s }) {
      const row = {
        name: s.name,
        category: s.category,
        price: s.price,
        duration_min: s.durationMin,
        active: s.active,
        color: CATEGORY_COLORS[s.category] ?? '#D4B8C0',
      };
      const { data, error } = id
        ? await supabase.from('services').update(row).eq('id', id).select().single()
        : await supabase.from('services').insert(row).select().single();
      if (error) return fail(error);
      const saved = toService(data);
      setServices((list) =>
        [...list.filter((x) => x.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)),
      );
      return true;
    },

    async setServiceActive(id, active) {
      setServices((list) => list.map((s) => (s.id === id ? { ...s, active } : s)));
      const { error } = await supabase.from('services').update({ active }).eq('id', id);
      if (error) {
        setServices((list) => list.map((s) => (s.id === id ? { ...s, active: !active } : s)));
        fail(error);
      }
    },

    async deleteService(id) {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error?.code === '23503') return 'in_use';
      if (error) {
        fail(error);
        return 'error';
      }
      setServices((list) => list.filter((s) => s.id !== id));
      return 'ok';
    },

    async saveBusinessHours(hours) {
      const { data, error } = await supabase
        .from('business_hours')
        .upsert(
          hours.map((h) => ({
            day_of_week: h.dayOfWeek,
            is_open: h.isOpen,
            open_time: h.openTime,
            close_time: h.closeTime,
            break_start: h.breakStart ?? null,
            break_end: h.breakEnd ?? null,
          })),
          { onConflict: 'owner_id,day_of_week' },
        )
        .select();
      if (error) return fail(error);
      const saved = (data ?? []).map(toHours);
      setBusinessHours(defaultBusinessHours.map((d) => saved.find((x) => x.dayOfWeek === d.dayOfWeek) ?? d));
      setHoursAvailable(true);
      return true;
    },

    serviceAreas,

    async saveServiceArea({ id, ...a }) {
      const row = {
        neighborhood_name: a.name.trim(),
        travel_fee: a.travelFee,
        allowed_days: [...a.allowedDays].sort(),
        is_active: a.isActive,
      };
      const { data, error } = id
        ? await supabase.from('service_areas').update(row).eq('id', id).select().single()
        : await supabase.from('service_areas').insert(row).select().single();
      if (error) return fail(error);
      const saved = toArea(data);
      setServiceAreas((list) =>
        [...list.filter((x) => x.id !== saved.id), saved].sort((x, y) => x.name.localeCompare(y.name)),
      );
      return true;
    },

    async deleteServiceArea(id) {
      const { error } = await supabase.from('service_areas').delete().eq('id', id);
      if (error) return fail(error);
      setServiceAreas((list) => list.filter((x) => x.id !== id));
      return true;
    },

    async updateClientAddress(id, address, neighborhood) {
      const clean = (v?: string) => v?.trim() || undefined;
      const { error } = await supabase
        .from('clients')
        .update({ address: clean(address) ?? null, neighborhood: clean(neighborhood) ?? null })
        .eq('id', id);
      if (error) return fail(error);
      setClients((list) =>
        list.map((c) => (c.id === id ? { ...c, address: clean(address), neighborhood: clean(neighborhood) } : c)),
      );
      return true;
    },

    async addAppointment({
      clientId,
      startsAt,
      serviceIds,
      notes,
      occurrences,
      recurrenceRule,
      clientPackageId,
      locationType = 'fixed',
      serviceAddress,
      travelFee = 0,
    }) {
      const starts = occurrences?.length ? occurrences : [startsAt];
      const home = locationType === 'home_service';
      const fee = home ? travelFee : 0;

      if (!(await isOnline())) {
        if (starts.length > 1) {
          notify('Sem conexão', 'Séries recorrentes só podem ser criadas com internet. Agende uma sessão por vez.');
          return 0;
        }
        // Offline: monta o agendamento com os preços do catálogo salvo no aparelho
        const chosen = serviceIds.map((id) => services.find((s) => s.id === id)).filter((s): s is Service => !!s);
        if (!chosen.length) return 0;
        const id = newId();
        const minutes = chosen.reduce((t, s) => t + s.durationMin, 0);
        const total = chosen.reduce((t, s) => t + s.price, 0) + fee;
        const endsAt = new Date(new Date(starts[0]).getTime() + minutes * 60_000).toISOString();
        const optimistic: Appointment = {
          id,
          clientId,
          startsAt: starts[0],
          endsAt,
          status: 'pendente',
          totalPrice: total,
          notes,
          services: chosen.map((s) => ({ serviceId: s.id, name: s.name, price: s.price, durationMin: s.durationMin })),
          isRecurrenceException: false,
          clientPackageId,
          source: 'manual',
          locationType,
          serviceAddress: home ? serviceAddress : undefined,
          travelFee: fee,
        };
        setAppointments((list) => [...list, optimistic]);
        enqueue({
          kind: 'addAppointment',
          appointment: {
            id,
            client_id: clientId,
            starts_at: starts[0],
            ends_at: endsAt,
            status: 'pendente',
            total_price: total,
            notes: notes ?? null,
            source: 'manual',
            client_package_id: clientPackageId ?? null,
            ...(home ? { location_type: 'home_service', service_address: serviceAddress ?? null, travel_fee: fee } : {}),
          },
          services: chosen.map((s, i) => ({
            service_id: s.id,
            name: s.name,
            price: s.price,
            duration_min: s.durationMin,
            position: i + 1,
          })),
        });
        notify('Agendamento salvo no aparelho', 'Será enviado quando a internet voltar.', 'info');
        return 1;
      }
      await flushOutbox(); // mantém a ordem das alterações feitas offline

      // Pacote e domicílio vão na mesma chamada: o banco grava tudo junto ou nada
      const extra = {
        ...(clientPackageId ? { p_client_package_id: clientPackageId } : {}),
        ...(home ? { p_location_type: 'home_service', p_service_address: serviceAddress ?? null, p_travel_fee: fee } : {}),
      };
      let ids: string[];
      if (starts.length === 1) {
        const { data, error } = await supabase.rpc('create_appointment', {
          p_client_id: clientId,
          p_starts_at: starts[0],
          p_service_ids: serviceIds,
          p_notes: notes ?? null,
          ...extra,
        });
        if (error) {
          fail(error);
          return 0;
        }
        ids = [data.id];
      } else {
        const { data, error } = await supabase.rpc('create_appointment_series', {
          p_client_id: clientId,
          p_starts_at: starts,
          p_service_ids: serviceIds,
          p_notes: notes ?? null,
          p_recurrence_rule: recurrenceRule ?? null,
          ...extra,
        });
        if (error) {
          fail(error);
          return 0;
        }
        ids = (data as any[]).map((r) => r.id);
      }
      const { data: full } = await supabase.from('appointments').select(APPT_SELECT).in('id', ids);
      if (full) setAppointments((list) => [...list, ...full.map(toAppointment)]);
      return ids.length;
    },

    async updateAppointments(editedId, ids, { shiftMs, serviceIds, notes }, scope) {
      const { error } = await supabase.rpc('update_appointments', {
        p_ids: ids,
        p_shift: `${Math.round(shiftMs / 1000)} seconds`,
        p_service_ids: serviceIds ?? null,
        // Só esta sessão mudou: ela passa a ser uma exceção da série
        p_mark_exception: scope === 'one' && !!appointments.find((a) => a.id === editedId)?.recurrenceGroupId,
        // "Este e os próximos" vira uma série própria, separada das sessões anteriores
        p_new_group: scope === 'following',
      });
      if (error) return fail(error);
      if (notes !== undefined) {
        const { error: e } = await supabase.from('appointments').update({ notes: notes || null }).eq('id', editedId);
        if (e) return fail(e);
      }
      const { data } = await supabase.from('appointments').select(APPT_SELECT).in('id', ids);
      const fresh = new Map((data ?? []).map((r) => [r.id as string, toAppointment(r)]));
      setAppointments((list) => list.map((a) => fresh.get(a.id) ?? a));
      return true;
    },

    async cancelAppointments(ids) {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelado' })
        .in('id', ids)
        .not('status', 'in', '(concluido,cancelado)');
      if (error) return fail(error);
      setAppointments((list) =>
        list.map((a) => (ids.includes(a.id) && a.status !== 'concluido' ? { ...a, status: 'cancelado' } : a)),
      );
      return true;
    },

    async setAppointmentStatus(id, status) {
      const prev = appointments;
      setAppointments((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) {
        setAppointments(prev);
        fail(error);
        return;
      }
      // Se estava concluído e voltou, remove a receita lançada automaticamente
      if (transactions.some((t) => t.appointmentId === id)) {
        await supabase.from('transactions').delete().eq('appointment_id', id);
        setTransactions((list) => list.filter((t) => t.appointmentId !== id));
      }
      // Sessão de pacote: o banco devolve/consome o crédito; atualiza o saldo na tela
      if (prev.find((a) => a.id === id)?.clientPackageId) await refreshPackages();
    },

    async completeAppointment(id, method) {
      if (!(await isOnline())) {
        // Offline: marca como concluído e mostra a receita prevista; o banco confirma depois
        const appt = appointments.find((a) => a.id === id);
        if (!appt) return false;
        setAppointments((list) => list.map((a) => (a.id === id ? { ...a, status: 'concluido' } : a)));
        if (appt.clientPackageId) {
          setPackages((list) =>
            list.map((p) => (p.id === appt.clientPackageId ? { ...p, usedSessions: p.usedSessions + 1 } : p)),
          );
        }
        const gross = amountDue(appt, packages);
        if (method && gross > 0) {
          const fee = feeFor(gross, method, profile.paymentFees);
          setTransactions((list) => [
            {
              id: `pendente-${id}`,
              type: 'receita',
              amount: gross,
              category: 'Serviço',
              description: appt.services.map((s) => s.name).join(' + '),
              paymentMethod: method,
              appointmentId: id,
              occurredAt: new Date().toISOString(),
              grossAmount: gross,
              feeAmount: fee,
              netAmount: gross - fee,
            },
            ...list.filter((t) => t.appointmentId !== id),
          ]);
        }
        enqueue({ kind: 'completeAppointment', appointmentId: id, method: method ?? null });
        notify('Atendimento concluído', 'Salvo no aparelho; será sincronizado quando a internet voltar.', 'info');
        return true;
      }
      await flushOutbox(); // mantém a ordem das alterações feitas offline

      const { data, error } = await supabase.rpc('complete_appointment', {
        p_appointment_id: id,
        p_payment_method: method ?? null,
      });
      if (error) return fail(error);
      // Receita do que não foi pago pelo pacote (vazio quando o pacote cobre tudo)
      if (data?.id) {
        setTransactions((list) => [toTransaction(data), ...list.filter((t) => t.appointmentId !== id)]);
      }
      if (appointments.find((a) => a.id === id)?.clientPackageId) await refreshPackages();
      await refreshAppointment(id);
      return true;
    },

    online,
    pendingSync: outbox.length,
    syncing,
    /** Puxar para atualizar: envia pendências e recarrega tudo. */
    async refresh() {
      if (!(await isOnline())) {
        notify('Sem conexão', 'Mostrando os dados salvos no aparelho.', 'info');
        return;
      }
      await flushOutbox();
      await reload();
    },

    async addBlock(b) {
      const { data, error } = await supabase
        .from('schedule_blocks')
        .insert({ starts_at: b.startsAt, ends_at: b.endsAt, all_day: b.allDay, reason: b.reason ?? null })
        .select()
        .single();
      if (error) return fail(error);
      setBlocks((list) => [...list, toBlock(data)]);
      return true;
    },

    async removeBlock(id) {
      const { error } = await supabase.from('schedule_blocks').delete().eq('id', id);
      if (error) {
        fail(error);
        return;
      }
      setBlocks((list) => list.filter((b) => b.id !== id));
    },

    async addClient(c) {
      if (!(await isOnline())) {
        // Offline: cria com um id gerado no aparelho e manda depois
        const created: Client = { ...c, id: newId() };
        setClients((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
        enqueue({
          kind: 'addClient',
          row: {
            id: created.id,
            name: c.name,
            whatsapp: c.whatsapp ?? null,
            email: c.email ?? null,
            birth_date: c.birthDate ?? null,
            technical_notes: c.technicalNotes ?? null,
            ...(c.address || c.neighborhood ? { address: c.address ?? null, neighborhood: c.neighborhood ?? null } : {}),
          },
        });
        notify('Cliente salva no aparelho', 'Será enviada quando a internet voltar.', 'info');
        return created;
      }
      await flushOutbox(); // mantém a ordem das alterações feitas offline
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: c.name,
          whatsapp: c.whatsapp ?? null,
          email: c.email ?? null,
          birth_date: c.birthDate ?? null,
          technical_notes: c.technicalNotes ?? null,
          ...(c.address || c.neighborhood ? { address: c.address ?? null, neighborhood: c.neighborhood ?? null } : {}),
        })
        .select()
        .single();
      if (error) {
        fail(error);
        return null;
      }
      const created = toClient(data);
      setClients((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      return created;
    },

    async addTransaction(t) {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          type: t.type,
          amount: t.amount,
          category: t.category,
          description: t.description ?? null,
          payment_method: t.paymentMethod ?? null,
          occurred_at: t.occurredAt,
        })
        .select()
        .single();
      if (error) return fail(error);
      setTransactions((list) => [toTransaction(data), ...list]);
      return true;
    },

    async deleteExpense(id) {
      const { error } = await supabase.from('transactions').delete().eq('id', id).eq('type', 'despesa');
      if (error) return fail(error);
      setTransactions((list) => list.filter((t) => t.id !== id));
      return true;
    },

    async updateTemplate(t) {
      const { error } = await supabase.from('message_templates').upsert(
        { channel: t.channel, kind: t.kind, subject: t.subject ?? null, body: t.body },
        { onConflict: 'owner_id,channel,kind' },
      );
      if (error) return fail(error);
      setTemplates((list) => list.map((x) => (x.channel === t.channel && x.kind === t.kind ? t : x)));
      return true;
    },

    /** Preenche a conta com clientes, agendamentos e despesas de exemplo. */
    async loadExampleData() {
      // Taxas típicas de maquininha (só se ainda estiverem zeradas), antes de lançar as receitas
      const f = profile.paymentFees;
      if (!f.debit && !f.credit && !f.pix) {
        await supabase.from('profiles').update({ payment_fees: exampleFees }).eq('id', userId!);
      }

      const { data: newClients, error } = await supabase
        .from('clients')
        .insert(
          mockClients.map((c) => ({
            name: c.name,
            whatsapp: c.whatsapp ?? null,
            email: c.email ?? null,
            birth_date: c.birthDate ?? null,
            technical_notes: c.technicalNotes ?? null,
          })),
        )
        .select();
      if (error || !newClients) {
        fail(error);
        return;
      }
      const clientIdMap = new Map(mockClients.map((c, i) => [c.id, newClients[i].id as string]));
      const serviceIdByName = new Map(services.map((s) => [s.name, s.id]));
      const mockTx = new Map(mockTransactions.filter((t) => t.appointmentId).map((t) => [t.appointmentId, t]));

      for (const a of mockAppointments) {
        const serviceIds = a.services.map((s) => serviceIdByName.get(s.name)).filter(Boolean) as string[];
        if (!serviceIds.length) continue;
        const { data: appt, error: e } = await supabase.rpc('create_appointment', {
          p_client_id: clientIdMap.get(a.clientId),
          p_starts_at: a.startsAt,
          p_service_ids: serviceIds,
          p_notes: a.notes ?? null,
          p_status: a.status,
        });
        if (e || !appt) continue; // ex: horário já ocupado por agendamento real
        const tx = mockTx.get(a.id);
        if (a.status === 'concluido' && tx) {
          await supabase.from('transactions').insert({
            type: 'receita',
            amount: appt.total_price,
            category: 'Serviço',
            description: a.services.map((s) => s.name).join(' + '),
            payment_method: tx.paymentMethod,
            appointment_id: appt.id,
            occurred_at: a.endsAt,
          });
        }
      }

      await supabase.from('transactions').insert(
        mockTransactions
          .filter((t) => t.type === 'despesa')
          .map((t) => ({
            type: 'despesa',
            amount: t.amount,
            category: t.category,
            description: t.description ?? null,
            occurred_at: t.occurredAt,
          })),
      );

      // Uma série recorrente de exemplo: manutenção de cílios a cada 3 semanas
      const lashes = serviceIdByName.get('Manutenção de cílios');
      const firstClient = newClients[1]?.id;
      if (lashes && firstClient) {
        const first = atMinutes(addDays(startOfDay(new Date()), 3), 14 * 60);
        const series = generateOccurrences(first, {
          freq: 'triweekly',
          interval: 3,
          unit: 'weeks',
          end: { type: 'count', count: 4 },
        });
        const { data: sessions } = await supabase.rpc('create_appointment_series', {
          p_client_id: firstClient,
          p_starts_at: series.map((d) => d.toISOString()),
          p_service_ids: [lashes],
          p_notes: 'Manutenção de rotina',
          p_recurrence_rule: 'FREQ=WEEKLY;INTERVAL=3;COUNT=4',
        }); // ignora erro: algum horário pode já estar ocupado

        // Pacote pré-pago de exemplo cobrindo essa série
        const { data: pkg } = await supabase.rpc('sell_package', {
          p_client_id: firstClient,
          p_service_id: lashes,
          p_name: 'Combo 4 manutenções de cílios',
          p_total_sessions: 4,
          p_total_paid: 400,
          p_payment_method: 'credito',
          p_expires_at: null,
        });
        if (pkg?.id && sessions?.length) {
          await supabase
            .from('appointments')
            .update({ client_package_id: pkg.id })
            .in('id', (sessions as any[]).map((s) => s.id));
        }
      }

      // Folgas/feriados de exemplo
      await supabase.from('schedule_blocks').insert(
        exampleTimeOffs().map((b) => ({ starts_at: b.startsAt, ends_at: b.endsAt, all_day: true, reason: b.reason })),
      );

      // Completa só os dados do estúdio que ainda estão vazios
      const blanks = Object.fromEntries(
        Object.entries(exampleStudio).filter(([k]) => !profile[k as keyof Profile]),
      ) as Partial<Profile>;
      if (Object.keys(blanks).length) {
        const row = Object.fromEntries(
          Object.entries(blanks).map(([k, v]) => [PROFILE_COLUMNS[k as keyof Profile]!, v]),
        );
        await supabase.from('profiles').update(row).eq('id', userId!); // ignora erro se a migração não rodou
      }
      await reload();
    },
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore precisa estar dentro de <StoreProvider>');
  return s;
}
