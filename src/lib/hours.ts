// Regras de expediente: horário de cada dia, intervalos e folgas.
import { defaultBusinessHours } from '@/data/mock';
import { formatDateShort, formatTime, hmToMinutes, minutesOfDay, startOfDay } from '@/lib/dates';
import type { Appointment, BusinessHours, Client, Profile, ScheduleBlock } from '@/types';

export const WEEKDAYS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
/** Ordem de exibição: segunda a domingo */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function hoursForDay(day: Date, hours: BusinessHours[]): BusinessHours {
  const dow = day.getDay();
  return hours.find((h) => h.dayOfWeek === dow) ?? defaultBusinessHours[dow];
}

/** Folga/feriado (bloqueio de dia inteiro) que cobre este dia, se houver. */
export function timeOffOn(day: Date, blocks: ScheduleBlock[]): ScheduleBlock | undefined {
  const s = startOfDay(day).getTime();
  const e = s + 86_400_000;
  return blocks.find((b) => b.allDay && new Date(b.startsAt).getTime() < e && new Date(b.endsAt).getTime() > s);
}

/** Intervalos de trabalho do dia, em minutos (ex: 9–12 e 13–19). Vazio se fechado. */
export function workRanges(h: BusinessHours): [number, number][] {
  if (!h.isOpen) return [];
  const open = hmToMinutes(h.openTime);
  const close = hmToMinutes(h.closeTime);
  if (h.breakStart && h.breakEnd) {
    return [
      [open, hmToMinutes(h.breakStart)],
      [hmToMinutes(h.breakEnd), close],
    ];
  }
  return [[open, close]];
}

/** O período [start, end) cabe inteiro dentro do expediente? */
export function isWithinHours(h: BusinessHours, start: number, end: number): boolean {
  return workRanges(h).some(([s, e]) => start >= s && end <= e);
}

/** O período [start, end) cabe entre a abertura e o fechamento, sem considerar a pausa? */
export function isWithinOpenHours(h: BusinessHours, start: number, end: number): boolean {
  return h.isOpen && start >= hmToMinutes(h.openTime) && end <= hmToMinutes(h.closeTime);
}

/** O período [start, end) encosta na pausa do dia (ex: almoço)? */
export function overlapsBreak(h: BusinessHours, start: number, end: number): boolean {
  if (!h.isOpen || !h.breakStart || !h.breakEnd) return false;
  return start < hmToMinutes(h.breakEnd) && end > hmToMinutes(h.breakStart);
}

/** Faixa de horas a mostrar na agenda quando o dia está fechado. */
export function weekRange(hours: BusinessHours[]): [number, number] {
  const open = hours.filter((h) => h.isOpen);
  if (!open.length) return [8 * 60, 20 * 60];
  return [Math.min(...open.map((h) => hmToMinutes(h.openTime))), Math.max(...open.map((h) => hmToMinutes(h.closeTime)))];
}

export function describeHours(h: BusinessHours): string {
  if (!h.isOpen) return 'Fechado';
  const base = `${h.openTime}–${h.closeTime}`;
  return h.breakStart && h.breakEnd ? `${base} · pausa ${h.breakStart}–${h.breakEnd}` : base;
}

/** Endereço numa linha, para {endereco} e cabeçalho de recibos. */
export function formatAddress(p: Profile): string {
  const street = [p.addressStreet, p.addressNumber].filter(Boolean).join(', ');
  const city = [p.addressCity, p.addressState].filter(Boolean).join('/');
  const zip = p.addressZip ? `CEP ${p.addressZip.replace(/^(\d{5})(\d{3})$/, '$1-$2')}` : '';
  return [street, p.addressDistrict, city, zip].filter(Boolean).join(' – ');
}

/** Valida 'HH:mm' entre 00:00 e 23:59. */
export function isValidTime(t: string | undefined): t is string {
  return !!t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

// ---------------------------------------------------------------------
// Atendimentos afetados por bloqueios, folgas ou mudança de expediente
// ---------------------------------------------------------------------
const isOpenAppt = (a: Appointment) => a.status === 'pendente' || a.status === 'confirmado';

/** Atendimentos ainda abertos que caem no período [start, end). */
export function appointmentsBetween(appointments: Appointment[], start: Date, end: Date): Appointment[] {
  return appointments
    .filter((a) => isOpenAppt(a) && new Date(a.startsAt) < end && new Date(a.endsAt) > start)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Atendimentos futuros, ainda abertos, que ficariam fora do expediente informado. */
export function appointmentsOutsideHours(appointments: Appointment[], hours: BusinessHours[], from = new Date()): Appointment[] {
  return appointments
    .filter((a) => {
      const start = new Date(a.startsAt);
      if (!isOpenAppt(a) || start < from) return false;
      const end = new Date(a.endsAt);
      const endMin = isSameDate(start, end) ? minutesOfDay(end) : 24 * 60;
      return !isWithinHours(hoursForDay(start, hours), minutesOfDay(start), endMin);
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

const isSameDate = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** Lista curta para avisos: "• 03/12 às 14:00 – Maria" (no máximo 5 linhas). */
export function describeAppointments(list: Appointment[], clients: Client[]): string {
  const lines = list.slice(0, 5).map((a) => {
    const name = clients.find((c) => c.id === a.clientId)?.name.split(' ')[0] ?? 'Cliente';
    return `• ${formatDateShort(a.startsAt)} às ${formatTime(a.startsAt)} – ${name}`;
  });
  if (list.length > 5) lines.push(`…e mais ${list.length - 5}`);
  return lines.join('\n');
}
