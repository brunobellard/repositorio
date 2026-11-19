// Datas no fuso horário do estúdio (ex: link público aberto por alguém em outro fuso).
// Um "dia" é um Date à meia-noite local que só carrega ano/mês/dia; o fuso entra na hora de virar instante.
import { atMinutes, startOfDay } from '@/lib/dates';

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

const formatters = new Map<string, Intl.DateTimeFormat>();

/** Ano, mês, dia, hora e minuto de um instante no relógio do fuso (null se o fuso não for reconhecido). */
function wallClock(instant: Date, tz: string) {
  try {
    let f = formatters.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      formatters.set(tz, f);
    }
    const parts = f.formatToParts(instant);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: get('hour') % 24,
      minute: get('minute'),
      second: get('second'),
    };
  } catch {
    return null;
  }
}

/** Diferença entre o relógio do fuso e o UTC naquele instante, em ms. */
function offsetMs(instant: Date, tz: string): number | null {
  const w = wallClock(instant, tz);
  if (!w) return null;
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instante de "dia às X minutos" no relógio do estúdio. Sem suporte ao fuso, usa o do aparelho. */
export function zonedInstant(day: Date, minutes: number, tz: string): Date {
  const guess = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
  const first = offsetMs(new Date(guess), tz);
  if (first === null) return atMinutes(day, minutes);
  // Segunda conferência: acerta dias de mudança de horário de verão
  const second = offsetMs(new Date(guess - first), tz);
  return new Date(guess - (second ?? first));
}

/** Dia (meia-noite local com a data do estúdio) e minutos do dia de um instante, no relógio do estúdio. */
export function zonedParts(instant: Date, tz: string): { day: Date; minutes: number } {
  const w = wallClock(instant, tz);
  if (!w) return { day: startOfDay(instant), minutes: instant.getHours() * 60 + instant.getMinutes() };
  return { day: new Date(w.year, w.month - 1, w.day), minutes: w.hour * 60 + w.minute };
}

/** Hoje, no calendário do estúdio. */
export function zonedToday(tz: string): Date {
  return zonedParts(new Date(), tz).day;
}

/** "09:30" a partir dos minutos do dia. */
export function minutesLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
