// Agendamentos recorrentes: gera as datas da série, descreve a regra em
// português e converte para o formato iCalendar (RRULE) salvo no banco.
import { addDays, formatDateShort, minutesOfDay, startOfDay } from '@/lib/dates';
import { hoursForDay, isWithinOpenHours, timeOffOn } from '@/lib/hours';
import type { Appointment, BusinessHours, ScheduleBlock } from '@/types';

export type RecurrenceFreq =
  | 'none'
  | 'weekly'
  | 'biweekly'
  | 'triweekly'
  | 'monthly_day' // mesmo dia do mês (ex: todo dia 15)
  | 'monthly_weekday' // mesma semana/dia da semana (ex: toda 1ª sexta)
  | 'custom';

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  /** Só para 'custom': a cada N dias/semanas */
  interval: number;
  unit: 'days' | 'weeks';
  /** never = sem data para acabar: cria 1 ano e o app vai criando as próximas sozinho */
  end: { type: 'count'; count: number } | { type: 'until'; date: Date } | { type: 'never' };
}

/** Limite de segurança: no máximo 1 ano de sessões. */
export const MAX_OCCURRENCES = 52;
/** Série sem fim: quantos dias à frente ficam sempre criados */
export const OPEN_SERIES_HORIZON_DAYS = 365;

const WEEKDAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Qual ocorrência do dia da semana no mês (1ª, 2ª…); -1 = última. */
export function weekdayOrdinal(d: Date): number {
  const nth = Math.ceil(d.getDate() / 7);
  // A 5ª ocorrência não existe em todo mês: vira "a última"
  return nth >= 5 ? -1 : nth;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): Date {
  if (nth === -1) {
    const last = new Date(year, month + 1, 0);
    const diff = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month, last.getDate() - diff);
  }
  const first = new Date(year, month, 1);
  const diff = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + diff + (nth - 1) * 7);
}

function sameDayOfMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay)); // dia 31 vira o último dia do mês
}

/** Dias entre sessões, para frequências de intervalo fixo. */
function stepDays(rule: RecurrenceRule): number | null {
  switch (rule.freq) {
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'triweekly':
      return 21;
    case 'custom':
      return Math.max(1, rule.interval) * (rule.unit === 'weeks' ? 7 : 1);
    default:
      return null;
  }
}

/** Datas de início de cada sessão (a primeira é o próprio `start`). */
export function generateOccurrences(start: Date, rule: RecurrenceRule): Date[] {
  if (rule.freq === 'none') return [start];
  const minutes = minutesOfDay(start);
  const until =
    rule.end.type === 'until'
      ? startOfDay(rule.end.date).getTime() + 86_400_000
      : rule.end.type === 'never'
        ? startOfDay(start).getTime() + OPEN_SERIES_HORIZON_DAYS * 86_400_000
        : Infinity;
  const count = rule.end.type === 'count' ? Math.min(rule.end.count, MAX_OCCURRENCES) : MAX_OCCURRENCES;
  const withTime = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes);

  const dates: Date[] = [];
  const step = stepDays(rule);
  for (let i = 0; dates.length < count; i++) {
    let d: Date;
    if (step) d = withTime(addDays(startOfDay(start), i * step));
    else {
      const y = start.getFullYear();
      const m = start.getMonth() + i;
      d = withTime(
        rule.freq === 'monthly_day'
          ? sameDayOfMonth(y, m, start.getDate())
          : nthWeekdayOfMonth(y, m, start.getDay(), weekdayOrdinal(start)),
      );
    }
    if (d.getTime() >= until) break;
    dates.push(d);
    if (i > 400) break;
  }
  // "Até" antes do primeiro dia: fica só o agendamento escolhido (nunca uma série vazia)
  return dates.length ? dates : [start];
}

/** Regra no formato iCalendar, ex: FREQ=WEEKLY;INTERVAL=2;COUNT=6 */
export function toRRule(start: Date, rule: RecurrenceRule): string | null {
  if (rule.freq === 'none') return null;
  const parts: string[] = [];
  const step = stepDays(rule);
  if (step) {
    if (step % 7 === 0) parts.push('FREQ=WEEKLY', `INTERVAL=${step / 7}`, `BYDAY=${RRULE_DAYS[start.getDay()]}`);
    else parts.push('FREQ=DAILY', `INTERVAL=${step}`);
  } else if (rule.freq === 'monthly_day') {
    parts.push('FREQ=MONTHLY', `BYMONTHDAY=${start.getDate()}`);
  } else {
    parts.push('FREQ=MONTHLY', `BYDAY=${weekdayOrdinal(start)}${RRULE_DAYS[start.getDay()]}`);
  }
  if (rule.end.type === 'count') parts.push(`COUNT=${rule.end.count}`);
  else if (rule.end.type === 'until') {
    const u = rule.end.date;
    parts.push(`UNTIL=${u.getFullYear()}${String(u.getMonth() + 1).padStart(2, '0')}${String(u.getDate()).padStart(2, '0')}`);
  }
  return parts.join(';');
}

const ordinalLabel = (n: number) => (n === -1 ? 'última' : `${n}ª`);

/** "A cada 2 semanas", "Toda 1ª sexta-feira do mês"… */
export function describeFrequency(start: Date, rule: Pick<RecurrenceRule, 'freq' | 'interval' | 'unit'>): string {
  switch (rule.freq) {
    case 'none':
      return 'Não se repete';
    case 'weekly':
      return `Toda semana (${WEEKDAY_NAMES[start.getDay()]})`;
    case 'biweekly':
      return 'A cada 2 semanas';
    case 'triweekly':
      return 'A cada 3 semanas';
    case 'monthly_day':
      return `Todo mês, no dia ${start.getDate()}`;
    case 'monthly_weekday': {
      const n = weekdayOrdinal(start);
      const wd = WEEKDAY_NAMES[start.getDay()];
      return `Toda ${ordinalLabel(n)} ${wd} do mês`;
    }
    case 'custom': {
      const n = Math.max(1, rule.interval);
      const unit = rule.unit === 'weeks' ? (n === 1 ? 'semana' : 'semanas') : n === 1 ? 'dia' : 'dias';
      return `A cada ${n} ${unit}`;
    }
  }
}

const ADJECTIVE: Partial<Record<RecurrenceFreq, string>> = {
  weekly: 'semanais',
  biweekly: 'quinzenais',
  triweekly: 'a cada 3 semanas',
  monthly_day: 'mensais',
  monthly_weekday: 'mensais',
};

/** "Serão criados 6 agendamentos quinzenais, de 15/11 até 24/01" */
export function summarize(dates: Date[], rule: RecurrenceRule): string {
  if (dates.length <= 1) return 'Só este agendamento será criado.';
  const kind = ADJECTIVE[rule.freq] ?? `(${describeFrequency(dates[0], rule).toLowerCase()})`;
  if (rule.end.type === 'never') {
    return `Sem data para acabar: serão criados ${dates.length} agendamentos ${kind} (1 ano, até ${formatDateShort(dates[dates.length - 1])}), e o app cria os próximos sozinho. Para parar, cancele "este e os próximos".`;
  }
  return `Serão criados ${dates.length} agendamentos ${kind}, de ${formatDateShort(dates[0])} até ${formatDateShort(dates[dates.length - 1])}.`;
}

/** Lê o RRULE salvo e devolve um texto curto para a tela do agendamento. */
export function describeRRule(rrule: string | undefined, start: Date): string | null {
  if (!rrule) return null;
  const p = Object.fromEntries(rrule.split(';').map((kv) => kv.split('=')));
  const interval = Number(p.INTERVAL ?? 1);
  if (p.FREQ === 'WEEKLY') {
    if (interval === 1) return 'Toda semana';
    if (interval === 2) return 'A cada 2 semanas (quinzenal)';
    return `A cada ${interval} semanas`;
  }
  if (p.FREQ === 'DAILY') return `A cada ${interval} ${interval === 1 ? 'dia' : 'dias'}`;
  if (p.FREQ === 'MONTHLY' && p.BYMONTHDAY) return `Todo mês, no dia ${p.BYMONTHDAY}`;
  if (p.FREQ === 'MONTHLY') return describeFrequency(start, { freq: 'monthly_weekday', interval: 1, unit: 'days' });
  return null;
}

// ---------------------------------------------------------------------
// Conflitos
// ---------------------------------------------------------------------
export interface AvailabilityContext {
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  businessHours: BusinessHours[];
  /** Agendamentos a desconsiderar (ex: o próprio, numa edição) */
  ignoreIds?: string[];
  /** true = profissional escolheu atender fora do expediente */
  ignoreHours?: boolean;
  /** Minutos de deslocamento reservados depois de cada atendimento a domicílio */
  travelBufferMin?: number;
  /** O novo atendimento é a domicílio (reserva o deslocamento depois dele também) */
  home?: boolean;
}

/**
 * Até quando um atendimento já marcado ocupa a agenda (em ms): o "ocupado até" gravado pelo banco,
 * que guarda o deslocamento da época em que foi marcado. Sem ele (feito offline, ainda não
 * sincronizado), usa o deslocamento atual.
 */
export function busyEndMs(a: Appointment, travelBufferMin: number): number {
  if (a.busyUntil) return new Date(a.busyUntil).getTime();
  return new Date(a.endsAt).getTime() + (a.locationType === 'home_service' ? travelBufferMin * 60_000 : 0);
}

/** Motivo pelo qual o horário não está livre, ou null se estiver. */
export function slotConflict(start: Date, durationMin: number, ctx: AvailabilityContext): string | null {
  const end = new Date(start.getTime() + durationMin * 60_000);
  if (start.getTime() < Date.now()) return 'Data já passou';
  if (!ctx.ignoreHours) {
    const off = timeOffOn(start, ctx.blocks);
    if (off) return off.reason ?? 'Folga';
    const h = hoursForDay(start, ctx.businessHours);
    if (!h.isOpen) return 'Estúdio fechado';
    const s = minutesOfDay(start);
    // A pausa (almoço) não conta como conflito: quem agenda na pausa já confirmou ao escolher o horário
    if (!isWithinOpenHours(h, s, s + durationMin)) return 'Fora do expediente';
  }
  const busyBlock = ctx.blocks.find(
    (b) => !b.allDay && new Date(b.startsAt) < end && new Date(b.endsAt) > start,
  );
  if (busyBlock) return busyBlock.reason ?? 'Horário bloqueado';
  // Atendimento a domicílio ocupa também o deslocamento depois dele (o novo e os já marcados)
  const buffer = (ctx.travelBufferMin ?? 0) * 60_000;
  const endWithTravel = end.getTime() + (ctx.home ? buffer : 0);
  const clash = ctx.appointments.find(
    (a) =>
      a.status !== 'cancelado' &&
      !ctx.ignoreIds?.includes(a.id) &&
      new Date(a.startsAt).getTime() < endWithTravel &&
      busyEndMs(a, ctx.travelBufferMin ?? 0) > start.getTime(),
  );
  if (clash) return 'Horário ocupado';
  return null;
}

// ---------------------------------------------------------------------
// Ações em série (editar / cancelar)
// ---------------------------------------------------------------------
export type SeriesScope = 'one' | 'following' | 'all';

/** Sessões da série de `appt`, em ordem de data. */
export function seriesOf(appt: Appointment, appointments: Appointment[]): Appointment[] {
  if (!appt.recurrenceGroupId) return [appt];
  return appointments
    .filter((a) => a.recurrenceGroupId === appt.recurrenceGroupId)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Tem outras sessões abertas (não concluídas/canceladas) além desta? */
export function hasOpenSiblings(appt: Appointment, appointments: Appointment[]): boolean {
  return seriesOf(appt, appointments).some(
    (a) => a.id !== appt.id && a.status !== 'concluido' && a.status !== 'cancelado',
  );
}

/**
 * Ids afetados por uma ação em série. Sessões concluídas ou canceladas nunca entram;
 * "todos" considera só as sessões de hoje em diante (e a própria sessão aberta).
 */
export function seriesTargets(appt: Appointment, appointments: Appointment[], scope: SeriesScope): string[] {
  if (scope === 'one') return [appt.id];
  const open = seriesOf(appt, appointments).filter((a) => a.status !== 'concluido' && a.status !== 'cancelado');
  if (scope === 'following') return open.filter((a) => a.startsAt >= appt.startsAt).map((a) => a.id);
  const today = startOfDay(new Date()).toISOString();
  return open.filter((a) => a.startsAt >= today || a.id === appt.id).map((a) => a.id);
}

/** "Sessão 3 de 6" */
export function sessionPosition(appt: Appointment, appointments: Appointment[]): string | null {
  const all = seriesOf(appt, appointments);
  if (all.length <= 1) return null;
  return `Sessão ${all.findIndex((a) => a.id === appt.id) + 1} de ${all.length}`;
}

// ---------------------------------------------------------------------
// Séries sem fim (sem COUNT nem UNTIL): o app cria as próximas sessões sozinho
// ---------------------------------------------------------------------

/** A regra salva é "sem data para acabar"? */
export function isOpenEnded(rrule: string | undefined): boolean {
  return !!rrule && !/(^|;)(COUNT|UNTIL)=/.test(rrule);
}

/** Converte o RRULE salvo de volta para a regra da tela (só a frequência; o fim fica "sem fim"). */
export function parseRRule(rrule: string): RecurrenceRule | null {
  const p = Object.fromEntries(rrule.split(';').map((kv) => kv.split('=')));
  const interval = Math.max(1, Number(p.INTERVAL ?? 1));
  const end = { type: 'never' } as const;
  if (p.FREQ === 'WEEKLY') return { freq: 'custom', interval, unit: 'weeks', end };
  if (p.FREQ === 'DAILY') return { freq: 'custom', interval, unit: 'days', end };
  if (p.FREQ === 'MONTHLY' && p.BYMONTHDAY) return { freq: 'monthly_day', interval: 1, unit: 'days', end };
  if (p.FREQ === 'MONTHLY') return { freq: 'monthly_weekday', interval: 1, unit: 'days', end };
  return null;
}

/** Quando a última sessão criada fica a menos disto de hoje, a série ganha mais um ano */
export const OPEN_SERIES_EXTEND_WHEN_DAYS = 180;

/**
 * Séries sem fim que precisam de mais sessões, com as datas a criar (até 1 ano à frente de hoje).
 * Não estende a série cuja última sessão foi cancelada ("este e os próximos" cancelados = série encerrada).
 * As datas que já têm outro compromisso ficam de fora (ctx: agenda, bloqueios e expediente).
 */
export function seriesToExtend(
  appointments: Appointment[],
  ctx: Omit<AvailabilityContext, 'appointments' | 'ignoreIds' | 'home'>,
  now = new Date(),
): { groupId: string; dates: Date[] }[] {
  const latest = new Map<string, Appointment>();
  for (const a of appointments) {
    if (!a.recurrenceGroupId) continue;
    const cur = latest.get(a.recurrenceGroupId);
    if (!cur || a.startsAt > cur.startsAt) latest.set(a.recurrenceGroupId, a);
  }
  const horizon = startOfDay(now).getTime() + OPEN_SERIES_HORIZON_DAYS * 86_400_000;
  const result: { groupId: string; dates: Date[] }[] = [];
  for (const [groupId, last] of latest) {
    if (last.status === 'cancelado' || !isOpenEnded(last.recurrenceRule)) continue;
    const lastStart = new Date(last.startsAt);
    if (lastStart.getTime() - now.getTime() > OPEN_SERIES_EXTEND_WHEN_DAYS * 86_400_000) continue;
    const rule = parseRRule(last.recurrenceRule!);
    if (!rule) continue;
    const minutes = (new Date(last.endsAt).getTime() - lastStart.getTime()) / 60_000;
    const dates = generateOccurrences(lastStart, { ...rule, end: { type: 'until', date: new Date(horizon) } })
      .slice(1)
      .filter((d) => d.getTime() > now.getTime())
      .filter(
        (d) =>
          !slotConflict(d, minutes, {
            ...ctx,
            appointments,
            home: last.locationType === 'home_service',
          }),
      )
      .slice(0, MAX_OCCURRENCES);
    if (dates.length) result.push({ groupId, dates });
  }
  return result;
}

/** Regra da série sem fim encerrada: termina no dia anterior a `from` (as sessões a partir dele saíram). */
export function closedRRule(rrule: string, from: Date): string {
  const u = addDays(startOfDay(from), -1);
  const until = `${u.getFullYear()}${String(u.getMonth() + 1).padStart(2, '0')}${String(u.getDate()).padStart(2, '0')}`;
  return `${rrule.replace(/;?(COUNT|UNTIL)=[^;]*/g, '')};UNTIL=${until}`;
}
