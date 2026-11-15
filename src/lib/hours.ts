// Regras de expediente: horário de cada dia, intervalos e folgas.
import { defaultBusinessHours } from '@/data/mock';
import { hmToMinutes, startOfDay } from '@/lib/dates';
import type { BusinessHours, Profile, ScheduleBlock } from '@/types';

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
