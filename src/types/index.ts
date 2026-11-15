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
}

export interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  durationMin: number;
  color: string;
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
