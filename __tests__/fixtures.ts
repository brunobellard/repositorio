// Massa de dados dos testes automatizados: fábricas com valores padrão válidos.
// Cada teste muda só o que importa para o cenário (ex: appt({ status: 'concluido' })).
import type { Appointment, BusinessHours, Client, ClientPackage, ScheduleBlock } from '@/types';

export function appt(p: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a1',
    clientId: 'c1',
    startsAt: '2030-03-04T13:00:00.000Z',
    endsAt: '2030-03-04T14:00:00.000Z',
    status: 'pendente',
    services: [{ serviceId: 's1', name: 'Manicure', price: 50, durationMin: 60 }],
    totalPrice: 50,
    isRecurrenceException: false,
    source: 'manual',
    locationType: 'fixed',
    travelFee: 0,
    ...p,
  };
}

export function pkg(p: Partial<ClientPackage> = {}): ClientPackage {
  return {
    id: 'p1',
    clientId: 'c1',
    serviceIds: ['s1'],
    name: 'Pacote 4x Manicure',
    totalSessions: 4,
    usedSessions: 0,
    totalPaid: 160,
    paymentMethod: 'pix',
    status: 'active',
    createdAt: '2030-01-01T12:00:00.000Z',
    ...p,
  };
}

export function client(p: Partial<Client> = {}): Client {
  return { id: 'c1', name: 'Ana Souza', whatsapp: '11987654321', ...p };
}

/** Expediente seg–sáb 09:00–18:00 com almoço 12:00–13:00; domingo fechado. */
export const weekHours: BusinessHours[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  dayOfWeek: d,
  isOpen: d !== 0,
  openTime: '09:00',
  closeTime: '18:00',
  breakStart: '12:00',
  breakEnd: '13:00',
}));

export function block(p: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return { id: 'b1', startsAt: '2030-03-04T03:00:00.000Z', endsAt: '2030-03-05T03:00:00.000Z', allDay: true, ...p };
}

/** Data local (fuso dos testes: America/Sao_Paulo) */
export const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
