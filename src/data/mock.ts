// Dados fictícios para testar o fluxo antes de conectar ao Supabase.
// As datas são geradas em relação a hoje, para a agenda sempre ter conteúdo.
import { addDays, addMinutes, atMinutes, startOfDay } from '@/lib/dates';
import type {
  BusinessHours,
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

export const mockProfile: Profile = {
  id: 'me',
  businessName: 'Studio Ana Lima',
  ownerName: 'Ana Lima',
  phone: '11987650000',
  email: 'contato@studioanalima.com.br',
  workStart: '08:00',
  workEnd: '20:00',
  slotMinutes: 15,
  paymentFees: { debit: 0, credit: 0, pix: 0, cash: 0 },
};

export const mockServices: Service[] = [
  { id: 's1', name: 'Manicure', category: 'Unhas', price: 35, durationMin: 45, color: '#E8B4BC', active: true },
  { id: 's2', name: 'Pedicure', category: 'Unhas', price: 40, durationMin: 50, color: '#E8B4BC', active: true },
  { id: 's3', name: 'Esmaltação em gel', category: 'Unhas', price: 70, durationMin: 60, color: '#D99AA5', active: true },
  { id: 's4', name: 'Alongamento em fibra de vidro', category: 'Unhas', price: 160, durationMin: 150, color: '#C77F8C', active: true },
  { id: 's5', name: 'Manutenção de alongamento', category: 'Unhas', price: 110, durationMin: 105, color: '#C77F8C', active: true },
  { id: 's6', name: 'Nail art (por unha)', category: 'Unhas', price: 8, durationMin: 10, color: '#D99AA5', active: true },
  { id: 's7', name: 'Design de sobrancelhas', category: 'Sobrancelhas', price: 45, durationMin: 30, color: '#C9A98A', active: true },
  { id: 's8', name: 'Design com henna', category: 'Sobrancelhas', price: 60, durationMin: 45, color: '#B48D6A', active: true },
  { id: 's9', name: 'Brow lamination', category: 'Sobrancelhas', price: 130, durationMin: 60, color: '#B48D6A', active: true },
  { id: 's10', name: 'Extensão de cílios fio a fio', category: 'Cílios', price: 180, durationMin: 120, color: '#9FB3A1', active: true },
  { id: 's11', name: 'Manutenção de cílios', category: 'Cílios', price: 110, durationMin: 75, color: '#9FB3A1', active: true },
  { id: 's12', name: 'Limpeza de pele', category: 'Estética', price: 150, durationMin: 90, color: '#A9B8C9', active: true },
];

export const mockClients: Client[] = [
  { id: 'c1', name: 'Juliana Martins', whatsapp: '11991234567', email: 'juliana.martins@email.com', birthDate: '1992-03-18', technicalNotes: 'Prefere formato amendoado. Cutícula sensível — empurrar com cuidado.' },
  { id: 'c2', name: 'Camila Rocha', whatsapp: '11998761234', email: 'camila.rocha@email.com', birthDate: '1988-07-02', technicalNotes: 'Henna nº 3 (castanho médio). Alergia a cola de cílios com cianoacrilato forte.' },
  { id: 'c3', name: 'Fernanda Souza', whatsapp: '11987452310', birthDate: '1995-11-25', technicalNotes: 'Unhas quadradas, comprimento médio. Gosta de tons nude.' },
  { id: 'c4', name: 'Beatriz Almeida', whatsapp: '11976543210', email: 'bia.almeida@email.com', birthDate: '2000-01-09', technicalNotes: 'Cílios: curvatura C, 11mm, efeito boneca.' },
  { id: 'c5', name: 'Larissa Oliveira', whatsapp: '11965437788', birthDate: '1990-05-30', technicalNotes: 'Fibra: formato bailarina. Retorno a cada 21 dias.' },
  { id: 'c6', name: 'Patrícia Gomes', whatsapp: '11954326677', email: 'patricia.gomes@email.com', birthDate: '1979-09-14', technicalNotes: 'Pele sensível. Não usar ácido na limpeza.' },
  { id: 'c7', name: 'Amanda Ribeiro', whatsapp: '11943215566', birthDate: '1998-12-03', technicalNotes: 'Henna nº 2 (castanho claro). Sobrancelha fina, preencher falhas.' },
  { id: 'c8', name: 'Gabriela Costa', whatsapp: '11932104455', email: 'gabi.costa@email.com', birthDate: '1993-04-21' },
  { id: 'c9', name: 'Mariana Ferreira', whatsapp: '11921093344', birthDate: '1986-08-11', technicalNotes: 'Esmaltação em gel: cor favorita "Vermelho Paixão".' },
  { id: 'c10', name: 'Renata Carvalho', whatsapp: '11910982233', email: 'renata.c@email.com', birthDate: '1997-02-27', technicalNotes: 'Alérgica a látex.' },
  { id: 'c11', name: 'Tatiane Lopes', whatsapp: '11909871122', birthDate: '1991-06-16' },
  { id: 'c12', name: 'Vanessa Dias', whatsapp: '11998870011', email: 'vanessa.dias@email.com', birthDate: '1984-10-05', technicalNotes: 'Brow lamination a cada 6 semanas.' },
];

// [dia relativo a hoje, hora 'HH:mm', cliente, serviços, status]
type Seed = [number, string, string, string[], AppointmentStatus];
const seeds: Seed[] = [
  [-6, '09:00', 'c5', ['s5'], 'concluido'],
  [-6, '14:00', 'c2', ['s8'], 'concluido'],
  [-5, '10:00', 'c4', ['s11'], 'concluido'],
  [-5, '15:30', 'c9', ['s3'], 'concluido'],
  [-4, '09:30', 'c1', ['s1', 's2'], 'concluido'],
  [-4, '13:00', 'c11', ['s7'], 'cancelado'],
  [-3, '11:00', 'c12', ['s9'], 'concluido'],
  [-3, '16:00', 'c3', ['s3', 's6'], 'concluido'],
  [-2, '08:30', 'c6', ['s12'], 'concluido'],
  [-2, '14:30', 'c7', ['s8'], 'concluido'],
  [-1, '10:00', 'c8', ['s1'], 'concluido'],
  [-1, '15:00', 'c10', ['s10'], 'concluido'],
  [0, '08:30', 'c3', ['s3'], 'concluido'],
  [0, '10:00', 'c1', ['s1', 's7'], 'confirmado'],
  [0, '13:30', 'c4', ['s10'], 'confirmado'],
  [0, '16:00', 'c7', ['s8'], 'pendente'],
  [0, '17:00', 'c9', ['s1', 's2'], 'pendente'],
  [1, '09:00', 'c5', ['s4'], 'confirmado'],
  [1, '14:00', 'c2', ['s8'], 'pendente'],
  [1, '15:00', 'c12', ['s9'], 'pendente'],
  [2, '10:30', 'c6', ['s12'], 'confirmado'],
  [2, '16:00', 'c8', ['s3', 's6'], 'pendente'],
  [3, '09:00', 'c11', ['s7'], 'pendente'],
  [3, '11:00', 'c10', ['s11'], 'confirmado'],
  [4, '13:00', 'c1', ['s5'], 'pendente'],
  [6, '10:00', 'c3', ['s1'], 'pendente'],
];

const payments: PaymentMethod[] = ['pix', 'credito', 'pix', 'debito', 'dinheiro', 'pix'];

function buildAppointments(): Appointment[] {
  const today = startOfDay(new Date());
  return seeds.map(([offset, hm, clientId, serviceIds, status], i) => {
    const [h, m] = hm.split(':').map(Number);
    const start = atMinutes(addDays(today, offset), h * 60 + m);
    const services = serviceIds.map((id) => {
      const s = mockServices.find((x) => x.id === id)!;
      return { serviceId: s.id, name: s.name, price: s.price, durationMin: s.durationMin };
    });
    const duration = services.reduce((t, s) => t + s.durationMin, 0);
    return {
      id: `a${i + 1}`,
      clientId,
      startsAt: start.toISOString(),
      endsAt: addMinutes(start, duration).toISOString(),
      status,
      services,
      totalPrice: services.reduce((t, s) => t + s.price, 0),
      notes: i === 14 ? 'Primeira extensão — reservar tempo extra para explicar os cuidados.' : undefined,
      isRecurrenceException: false,
    };
  });
}

export const mockAppointments = buildAppointments();

function buildBlocks(): ScheduleBlock[] {
  const today = startOfDay(new Date());
  return [
    {
      id: 'b1',
      startsAt: atMinutes(today, 12 * 60).toISOString(),
      endsAt: atMinutes(today, 13 * 60).toISOString(),
      allDay: false,
      reason: 'Almoço',
    },
    {
      id: 'b2',
      startsAt: addDays(today, 5).toISOString(),
      endsAt: addDays(today, 6).toISOString(),
      allDay: true,
      reason: 'Folga',
    },
  ];
}

export const mockBlocks = buildBlocks();

// Valores bruto/taxa/líquido são calculados pelo banco ao gravar
type MockTransaction = Omit<Transaction, 'grossAmount' | 'feeAmount' | 'netAmount'>;

function buildTransactions(): MockTransaction[] {
  const today = startOfDay(new Date());
  const incomes: MockTransaction[] = mockAppointments
    .filter((a) => a.status === 'concluido')
    .map((a, i) => ({
      id: `t-${a.id}`,
      type: 'receita',
      amount: a.totalPrice,
      category: 'Serviço',
      description: a.services.map((s) => s.name).join(' + '),
      paymentMethod: payments[i % payments.length],
      appointmentId: a.id,
      occurredAt: a.endsAt,
    }));
  const expenses: MockTransaction[] = [
    { id: 'e1', type: 'despesa', amount: 189.9, category: 'Materiais', description: 'Kit esmaltes em gel (12 cores)', occurredAt: atMinutes(addDays(today, -5), 11 * 60).toISOString() },
    { id: 'e2', type: 'despesa', amount: 64.5, category: 'Descartáveis', description: 'Lixas, palitos e toucas', occurredAt: atMinutes(addDays(today, -3), 18 * 60).toISOString() },
    { id: 'e3', type: 'despesa', amount: 900, category: 'Aluguel', description: 'Aluguel da sala', occurredAt: atMinutes(addDays(today, -10), 9 * 60).toISOString() },
    { id: 'e4', type: 'despesa', amount: 120, category: 'Materiais', description: 'Fios para cílios 0.07', occurredAt: atMinutes(addDays(today, -1), 19 * 60).toISOString() },
  ];
  return [...incomes, ...expenses];
}

export const mockTransactions = buildTransactions();

export const defaultTemplates: MessageTemplate[] = [
  {
    channel: 'whatsapp',
    kind: 'lembrete',
    body: 'Olá {nome}! Passando para confirmar seu horário de {servico} {data} às {hora}. Podemos confirmar? 💅',
  },
  {
    channel: 'whatsapp',
    kind: 'confirmacao',
    body: 'Olá {nome}! Seu horário de {servico} está agendado para {data} às {hora}.\n📍 {estudio} – {endereco}\nAté lá! ✨',
  },
  {
    channel: 'whatsapp',
    kind: 'recibo',
    body: 'Obrigada pela visita, {nome}! Atendimento: {servico} — {valor}. Volte sempre 💕',
  },
  {
    channel: 'email',
    kind: 'confirmacao',
    subject: 'Agendamento confirmado — {estudio}',
    body: 'Olá {nome},\n\nSeu horário de {servico} está confirmado para {data} às {hora}.\nEndereço: {endereco}\n\nAté breve!\n{estudio}',
  },
  {
    channel: 'email',
    kind: 'lembrete',
    subject: 'Lembrete: seu horário é {data}',
    body: 'Olá {nome},\n\nLembrando do seu horário de {servico} {data} às {hora}.\n\n{estudio}',
  },
  {
    channel: 'email',
    kind: 'recibo',
    subject: 'Recibo do seu atendimento — {estudio}',
    body: 'Olá {nome},\n\nObrigada pela visita! Segue o resumo:\n{servico} — {valor}\n\n{estudio}',
  },
];

export const expenseCategories = ['Materiais', 'Descartáveis', 'Aluguel', 'Contas', 'Marketing', 'Outros'];

// ---------------------------------------------------------------------
// Ajustes: categorias, expediente padrão e dados de exemplo do estúdio
// ---------------------------------------------------------------------
export const serviceCategories = ['Unhas', 'Sobrancelhas', 'Cílios', 'Estética', 'Depilação', 'Cabelo', 'Outros'];

/** Expediente para contas novas: seg–sex 9h–19h com almoço, sábado até 15h, domingo fechado. */
export const defaultBusinessHours: BusinessHours[] = [0, 1, 2, 3, 4, 5, 6].map((d) =>
  d === 0
    ? { dayOfWeek: 0, isOpen: false, openTime: '09:00', closeTime: '18:00' }
    : d === 6
      ? { dayOfWeek: 6, isOpen: true, openTime: '09:00', closeTime: '15:00' }
      : { dayOfWeek: d, isOpen: true, openTime: '09:00', closeTime: '19:00', breakStart: '12:00', breakEnd: '13:00' },
);

/** Preenche só o que estiver vazio no cadastro do estúdio. */
export const exampleStudio: Partial<Profile> = {
  tradeName: 'Ana Lima Beleza e Estética LTDA',
  document: '12345678000190',
  phone: '11987650000',
  instagram: 'studioanalima',
  addressZip: '01414001',
  addressStreet: 'Rua Haddock Lobo',
  addressNumber: '595',
  addressDistrict: 'Cerqueira César',
  addressCity: 'São Paulo',
  addressState: 'SP',
};

/** Folgas e feriados de exemplo (dias inteiros, podendo ser período). */
export function exampleTimeOffs(): Omit<ScheduleBlock, 'id'>[] {
  const today = startOfDay(new Date());
  return [
    { startsAt: addDays(today, 5).toISOString(), endsAt: addDays(today, 6).toISOString(), allDay: true, reason: 'Folga' },
    { startsAt: addDays(today, 18).toISOString(), endsAt: addDays(today, 19).toISOString(), allDay: true, reason: 'Curso de atualização' },
    { startsAt: addDays(today, 38).toISOString(), endsAt: addDays(today, 44).toISOString(), allDay: true, reason: 'Férias' },
  ];
}

/** Taxas típicas de maquininha no Brasil (%), usadas nos dados de exemplo. */
export const exampleFees = { debit: 1.99, credit: 4.99, pix: 0, cash: 0 };
