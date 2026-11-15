// Utilitários de data sem dependências externas (horário local do aparelho).

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Semana começando no domingo. */
export function startOfWeek(d: Date): Date {
  return addDays(startOfDay(d), -d.getDay());
}

export function weekDays(d: Date): Date[] {
  const s = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

/** Grade do mês (6 semanas), incluindo dias do mês anterior/seguinte. */
export function monthGrid(d: Date): Date[] {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const s = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(s, i));
}

/**
 * Divide os dias em semanas de 7, para desenhar uma linha por semana.
 * (Uma linha única com flex-wrap e largura 100/7% quebra errado no Android
 * por arredondamento: cabem só 6 dias por linha e os dias ficam fora da coluna certa.)
 */
export function chunkWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

export function formatTime(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
}

export function formatDateShort(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}`;
}

export function formatDayTitle(d: Date): string {
  const today = startOfDay(new Date());
  if (isSameDay(d, today)) return 'Hoje';
  if (isSameDay(d, addDays(today, 1))) return 'Amanhã';
  if (isSameDay(d, addDays(today, -1))) return 'Ontem';
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()].toLowerCase()}`;
}

/** 'amanhã', 'hoje' ou 'dia 12/03' — usado nas mensagens. */
export function relativeDayPhrase(d: Date): string {
  const today = startOfDay(new Date());
  if (isSameDay(d, today)) return 'hoje';
  if (isSameDay(d, addDays(today, 1))) return 'amanhã';
  return `dia ${formatDateShort(d)}`;
}

/** 'HH:mm' -> minutos desde 00:00 */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function atMinutes(day: Date, minutes: number): Date {
  const r = startOfDay(day);
  r.setMinutes(minutes);
  return r;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}
