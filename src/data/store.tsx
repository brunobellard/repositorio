// Estado do app sincronizado com o Supabase.
// As telas usam useStore(); cada ação grava no banco e atualiza a tela.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '@/data/auth';
import {
  defaultBusinessHours,
  defaultTemplates,
  exampleStudio,
  exampleTimeOffs,
  mockAppointments,
  mockClients,
  mockServices,
  mockTransactions,
} from '@/data/mock';
import { notify } from '@/lib/confirm';
import { friendlyError, supabase } from '@/lib/supabase';
import type {
  Appointment,
  BusinessHours,
  AppointmentStatus,
  Client,
  MessageTemplate,
  PaymentMethod,
  Profile,
  ScheduleBlock,
  Service,
  Transaction,
} from '@/types';

// ---------------------------------------------------------------------
// Conversão banco (snake_case) -> app (camelCase)
// ---------------------------------------------------------------------
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
});
const toAppointment = (r: any): Appointment => ({
  id: r.id,
  clientId: r.client_id,
  startsAt: new Date(r.starts_at).toISOString(),
  endsAt: new Date(r.ends_at).toISOString(),
  status: r.status,
  totalPrice: Number(r.total_price),
  notes: r.notes ?? undefined,
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
  occurredAt: new Date(r.occurred_at).toISOString(),
});
const toTemplate = (r: any): MessageTemplate => ({
  channel: r.channel,
  kind: r.kind,
  subject: r.subject ?? undefined,
  body: r.body,
});

const APPT_SELECT = '*, appointment_services(*)';

// ---------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------
export interface NewAppointment {
  clientId: string;
  startsAt: string;
  serviceIds: string[];
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

  reload: () => Promise<void>;
  addAppointment: (a: NewAppointment) => Promise<boolean>;
  setAppointmentStatus: (id: string, status: Exclude<AppointmentStatus, 'concluido'>) => Promise<void>;
  completeAppointment: (id: string, method: PaymentMethod) => Promise<void>;
  addBlock: (b: Omit<ScheduleBlock, 'id'>) => Promise<boolean>;
  removeBlock: (id: string) => Promise<void>;
  addClient: (c: Omit<Client, 'id'>) => Promise<Client | null>;
  addTransaction: (t: Omit<Transaction, 'id'>) => Promise<boolean>;
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
}

/** Campos do perfil (app) -> colunas do banco */
const PROFILE_COLUMNS: Partial<Record<keyof Profile, string>> = {
  businessName: 'business_name',
  ownerName: 'owner_name',
  phone: 'phone',
  email: 'email',
  slotMinutes: 'slot_minutes',
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
};

const StoreContext = createContext<Store | null>(null);

function fail(error: { code?: string; message?: string } | null) {
  notify('Não foi possível salvar', friendlyError(error));
  return false;
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
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>(defaultBusinessHours);
  const [hoursAvailable, setHoursAvailable] = useState(true);
  const seeded = useRef<string | null>(null);

  /** Conta nova: cria catálogo de serviços e modelos de mensagem padrão. */
  const ensureDefaults = useCallback(async (uid: string) => {
    if (seeded.current === uid) return;
    seeded.current = uid;
    const { count } = await supabase.from('services').select('id', { count: 'exact', head: true });
    if (!count) {
      await supabase.from('services').insert(
        mockServices.map((s) => ({
          name: s.name,
          category: s.category,
          price: s.price,
          duration_min: s.durationMin,
          color: s.color,
        })),
      );
    }
    await supabase.from('message_templates').upsert(
      defaultTemplates.map((t) => ({ channel: t.channel, kind: t.kind, subject: t.subject ?? null, body: t.body })),
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

  const reload = useCallback(async () => {
    if (!userId) return;
    const [p, s, c, a, b, t, m, h] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('services').select('*').order('name'),
      supabase.from('clients').select('*').order('name'),
      supabase.from('appointments').select(APPT_SELECT).order('starts_at'),
      supabase.from('schedule_blocks').select('*').order('starts_at'),
      supabase.from('transactions').select('*').order('occurred_at', { ascending: false }),
      supabase.from('message_templates').select('*'),
      supabase.from('business_hours').select('*'),
    ]);
    const firstError = [p, s, c, a, b, t, m].find((r) => r.error)?.error;
    // Sem a tabela business_hours (migração pendente), usa o expediente padrão
    setHoursAvailable(!h.error);
    const saved = (h.data ?? []).map(toHours);
    setBusinessHours(defaultBusinessHours.map((d) => saved.find((x) => x.dayOfWeek === d.dayOfWeek) ?? d));
    if (firstError) notify('Erro ao carregar dados', friendlyError(firstError));
    if (p.data) setProfile(toProfile(p.data));
    setServices((s.data ?? []).map(toService));
    setClients((c.data ?? []).map(toClient));
    setAppointments((a.data ?? []).map(toAppointment));
    setBlocks((b.data ?? []).map(toBlock));
    setTransactions((t.data ?? []).map(toTransaction));
    setTemplates((m.data ?? []).map(toTemplate));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      await ensureDefaults(userId);
      await reload();
      if (!cancelled) setLoadedFor(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, ensureDefaults, reload]);

  async function refreshAppointment(id: string) {
    const { data } = await supabase.from('appointments').select(APPT_SELECT).eq('id', id).single();
    if (data) setAppointments((list) => list.map((x) => (x.id === id ? toAppointment(data) : x)));
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
    businessHours,
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

    async addAppointment({ clientId, startsAt, serviceIds, notes }) {
      const { data, error } = await supabase.rpc('create_appointment', {
        p_client_id: clientId,
        p_starts_at: startsAt,
        p_service_ids: serviceIds,
        p_notes: notes ?? null,
      });
      if (error) return fail(error);
      const { data: full } = await supabase.from('appointments').select(APPT_SELECT).eq('id', data.id).single();
      if (full) setAppointments((list) => [...list, toAppointment(full)]);
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
    },

    async completeAppointment(id, method) {
      const { data, error } = await supabase.rpc('complete_appointment', {
        p_appointment_id: id,
        p_payment_method: method,
      });
      if (error) {
        fail(error);
        return;
      }
      setTransactions((list) => [toTransaction(data), ...list.filter((t) => t.appointmentId !== id)]);
      await refreshAppointment(id);
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
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: c.name,
          whatsapp: c.whatsapp ?? null,
          email: c.email ?? null,
          birth_date: c.birthDate ?? null,
          technical_notes: c.technicalNotes ?? null,
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
