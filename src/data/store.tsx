// Estado do app sincronizado com o Supabase.
// As telas usam useStore(); cada ação grava no banco e atualiza a tela.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '@/data/auth';
import { defaultTemplates, mockAppointments, mockClients, mockServices, mockTransactions } from '@/data/mock';
import { notify } from '@/lib/confirm';
import { friendlyError, supabase } from '@/lib/supabase';
import type {
  Appointment,
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
});
const toService = (r: any): Service => ({
  id: r.id,
  name: r.name,
  category: r.category ?? 'Outros',
  price: Number(r.price),
  durationMin: r.duration_min,
  color: r.color ?? '#E8B4BC',
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
  }, []);

  const reload = useCallback(async () => {
    if (!userId) return;
    const [p, s, c, a, b, t, m] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('services').select('*').eq('active', true).order('name'),
      supabase.from('clients').select('*').order('name'),
      supabase.from('appointments').select(APPT_SELECT).order('starts_at'),
      supabase.from('schedule_blocks').select('*').order('starts_at'),
      supabase.from('transactions').select('*').order('occurred_at', { ascending: false }),
      supabase.from('message_templates').select('*'),
    ]);
    const firstError = [p, s, c, a, b, t, m].find((r) => r.error)?.error;
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
    reload,

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
