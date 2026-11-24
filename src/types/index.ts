// Tipos do domínio. Espelham as tabelas em supabase/migrations.
import type { BillingCycle, PlanTier, SubscriptionStatus } from '@/constants/plans';

export type AppointmentStatus = 'pendente' | 'confirmado' | 'concluido' | 'cancelado';
export type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro';
export type TransactionType = 'receita' | 'despesa';
export type MessageChannel = 'whatsapp' | 'email';
export type MessageKind = 'confirmacao' | 'lembrete' | 'recibo' | 'reativacao' | 'aniversario';

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
  paymentFees: PaymentFees;
  /** Dias sem voltar para a cliente aparecer em "Para chamar de volta" */
  recallDays: number;
  /** Link público de agendamento: /agendar/<slug> */
  slug?: string;
  /** Agendamentos online entram como confirmados (true) ou pendentes (false) */
  bookingAutoApprove: boolean;
  /** Token do Expo Push deste aparelho (para avisar de agendamentos online) */
  expoPushToken?: string;
  pushNotificationsEnabled: boolean;
  // Assinatura (só o sistema de pagamento altera; ver src/constants/plans.ts)
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  /** Fim do período de teste (ISO) */
  trialEndsAt?: string;
  billingCycle: BillingCycle;
  /** false até a conta nova concluir os 3 passos iniciais */
  onboardingCompleted: boolean;
  /** Onde atende: espaço fixo, a domicílio ou os dois */
  serviceMode: ServiceMode;
  /** Minutos bloqueados depois de um atendimento em domicílio (deslocamento) */
  travelBufferMinutes: number;
  /** Cor principal do tema (HEX), usada no app e no link público */
  themeColor: string;
}

export type ServiceMode = 'fixed' | 'home_service' | 'hybrid';
export type LocationType = 'fixed' | 'home_service';

/** Bairro/região atendida a domicílio. */
export interface ServiceArea {
  id: string;
  name: string;
  travelFee: number;
  /** Dias da semana em que atende o bairro (0 = domingo ... 6 = sábado) */
  allowedDays: number[];
  isActive: boolean;
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
  /** Endereço para atendimento a domicílio (rua, número, complemento) */
  address?: string;
  neighborhood?: string;
  /**
   * Excluída com histórico: dados pessoais apagados, continua só para a agenda e o Financeiro
   * mostrarem os atendimentos antigos. Não aparece nas listas nem conta no limite do plano.
   */
  removed?: boolean;
  /** Criada por "Carregar dados de exemplo" (sai em "Remover dados de exemplo") */
  isExample?: boolean;
}

/** Resumo de todo o histórico da cliente (inclusive o que é mais antigo que os 12 meses carregados). */
export interface ClientHistory {
  /** Atendimentos em qualquer situação */
  appointments: number;
  /** Último atendimento concluído */
  lastDoneAt?: string;
  lastService?: string;
}

export interface AppointmentService {
  serviceId: string;
  name: string;
  price: number;
  durationMin: number;
}

export interface Appointment {
  /** Quando foi criado (pedido online: base para medir o tempo de resposta) */
  createdAt?: string;
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
  /** Sessão paga com crédito de pacote (não gera nova receita ao concluir) */
  clientPackageId?: string;
  /** 'manual' = feito pela profissional; 'online' = pela cliente no link público */
  source: 'manual' | 'online';
  /** Onde acontece: no espaço ou na casa da cliente */
  locationType: LocationType;
  serviceAddress?: string;
  /** Taxa de deslocamento (já somada em totalPrice) */
  travelFee: number;
  /**
   * "Ocupado até", gravado pelo banco: fim + deslocamento usado quando o atendimento foi marcado.
   * Mudar o deslocamento em Ajustes não altera os já marcados. Vazio enquanto não sincronizou.
   */
  busyUntil?: string;
  /** Código secreto do link em que a cliente confirma ou cancela (/confirmar/<código>) */
  confirmToken?: string;
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
  /** Venda de pacote que gerou esta receita */
  clientPackageId?: string;
  occurredAt: string;
  /** Valor bruto (= amount), taxa da maquininha e valor líquido */
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
}

/** Percentual cobrado por forma de pagamento (ex: 4.99 = 4,99%) */
export interface PaymentFees {
  debit: number;
  credit: number;
  pix: number;
  cash: number;
}

export type PackageStatus = 'active' | 'completed';

export interface ClientPackage {
  id: string;
  clientId: string;
  /** Serviços do pacote: andam juntos (cada visita usa 1 sessão e tem todos eles) */
  serviceIds: string[];
  name: string;
  totalSessions: number;
  usedSessions: number;
  totalPaid: number;
  paymentMethod: PaymentMethod;
  status: PackageStatus;
  expiresAt?: string; // 'YYYY-MM-DD'
  createdAt: string;
}

export interface MessageTemplate {
  channel: MessageChannel;
  kind: MessageKind;
  subject?: string;
  body: string;
}
