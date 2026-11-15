// Tipos do domínio. Espelham as tabelas em supabase/migrations.

export type AppointmentStatus = 'pendente' | 'confirmado' | 'concluido' | 'cancelado';
export type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro';
export type TransactionType = 'receita' | 'despesa';
export type MessageChannel = 'whatsapp' | 'email';
export type MessageKind = 'confirmacao' | 'lembrete' | 'recibo';

export interface Profile {
  id: string;
  businessName: string;
  ownerName: string;
  phone?: string;
  email?: string;
  workStart: string; // 'HH:mm'
  workEnd: string; // 'HH:mm'
  slotMinutes: number;
  // Dados do estúdio (Ajustes > Dados do estúdio)
  tradeName?: string; // nome fantasia / razão social
  document?: string; // CPF ou CNPJ, só dígitos
  instagram?: string; // sem @
  logoUrl?: string;
  addressZip?: string; // CEP, só dígitos
  addressStreet?: string;
  addressNumber?: string;
  addressDistrict?: string;
  addressCity?: string;
  addressState?: string; // UF
}

/** Expediente de um dia da semana (0 = domingo ... 6 = sábado). */
export interface BusinessHours {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string; // 'HH:mm'
  closeTime: string; // 'HH:mm'
  breakStart?: string; // 'HH:mm'
  breakEnd?: string; // 'HH:mm'
}

export interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  durationMin: number;
  color: string;
  active: boolean;
}

export interface Client {
  id: string;
  name: string;
  whatsapp?: string; // apenas dígitos, com DDD
  email?: string;
  birthDate?: string; // 'YYYY-MM-DD'
  technicalNotes?: string;
}

export interface AppointmentService {
  serviceId: string;
  name: string;
  price: number;
  durationMin: number;
}

export interface Appointment {
  id: string;
  clientId: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  status: AppointmentStatus;
  services: AppointmentService[];
  totalPrice: number;
  notes?: string;
  /** Sessões da mesma série recorrente compartilham este id */
  recurrenceGroupId?: string;
  /** Regra iCalendar, ex: FREQ=WEEKLY;INTERVAL=2;COUNT=6 */
  recurrenceRule?: string;
  /** Esta sessão foi alterada fora do padrão da série */
  isRecurrenceException: boolean;
}

export interface ScheduleBlock {
  id: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  reason?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description?: string;
  paymentMethod?: PaymentMethod;
  appointmentId?: string;
  occurredAt: string;
}

export interface MessageTemplate {
  channel: MessageChannel;
  kind: MessageKind;
  subject?: string;
  body: string;
}
