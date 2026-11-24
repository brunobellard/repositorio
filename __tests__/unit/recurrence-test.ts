// CT-REC / CT-AGE: séries recorrentes e conflitos de horário (src/lib/recurrence.ts)
import { describe, expect, it } from '@jest/globals';

import {
  busyEndMs,
  generateOccurrences,
  MAX_OCCURRENCES,
  seriesTargets,
  sessionPosition,
  slotConflict,
  toRRule,
  weekdayOrdinal,
  type RecurrenceRule,
} from '@/lib/recurrence';

import { appt, block, local, weekHours } from '../fixtures';

const rule = (p: Partial<RecurrenceRule>): RecurrenceRule => ({
  freq: 'weekly',
  interval: 1,
  unit: 'weeks',
  end: { type: 'count', count: 4 },
  ...p,
});
const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}`;

describe('geração da série', () => {
  it('CT-REC-01 semanal com 4 sessões mantém dia da semana e horário', () => {
    const dates = generateOccurrences(local(2030, 3, 4, 14, 30), rule({}));
    expect(dates.map(ymd)).toEqual(['2030-3-4 14:30', '2030-3-11 14:30', '2030-3-18 14:30', '2030-3-25 14:30']);
  });

  it('CT-REC-02 quinzenal e a cada 3 semanas', () => {
    expect(generateOccurrences(local(2030, 3, 4, 9), rule({ freq: 'biweekly', end: { type: 'count', count: 2 } })).map(ymd)).toEqual([
      '2030-3-4 9:0',
      '2030-3-18 9:0',
    ]);
    expect(generateOccurrences(local(2030, 3, 4, 9), rule({ freq: 'triweekly', end: { type: 'count', count: 2 } })).map(ymd)).toEqual([
      '2030-3-4 9:0',
      '2030-3-25 9:0',
    ]);
  });

  it('CT-REC-03 mensal no dia 31 cai no último dia dos meses curtos', () => {
    const dates = generateOccurrences(local(2030, 1, 31, 10), rule({ freq: 'monthly_day', end: { type: 'count', count: 4 } }));
    expect(dates.map(ymd)).toEqual(['2030-1-31 10:0', '2030-2-28 10:0', '2030-3-31 10:0', '2030-4-30 10:0']);
  });

  it('CT-REC-04 mensal "1ª sexta" e "última sexta"', () => {
    // 1º de março de 2030 é sexta
    const first = generateOccurrences(local(2030, 3, 1, 10), rule({ freq: 'monthly_weekday', end: { type: 'count', count: 3 } }));
    expect(first.map(ymd)).toEqual(['2030-3-1 10:0', '2030-4-5 10:0', '2030-5-3 10:0']);
    // 29 de março de 2030 é a 5ª sexta: vira "a última" de cada mês
    expect(weekdayOrdinal(local(2030, 3, 29))).toBe(-1);
    const last = generateOccurrences(local(2030, 3, 29, 10), rule({ freq: 'monthly_weekday', end: { type: 'count', count: 2 } }));
    expect(last.map(ymd)).toEqual(['2030-3-29 10:0', '2030-4-26 10:0']);
  });

  it('CT-REC-05 "até" inclui o próprio dia final', () => {
    const dates = generateOccurrences(local(2030, 3, 4, 9), rule({ end: { type: 'until', date: local(2030, 3, 18) } }));
    expect(dates).toHaveLength(3);
  });

  it('CT-REC-06 "até" antes do primeiro dia não gera série vazia (regressão grupo 2)', () => {
    const start = local(2030, 3, 4, 9);
    expect(generateOccurrences(start, rule({ end: { type: 'until', date: local(2030, 3, 1) } }))).toEqual([start]);
  });

  it('CT-REC-07 limite de segurança de 52 sessões', () => {
    expect(generateOccurrences(local(2030, 3, 4, 9), rule({ end: { type: 'count', count: 500 } }))).toHaveLength(MAX_OCCURRENCES);
  });

  it('CT-REC-08 personalizado a cada 10 dias', () => {
    const dates = generateOccurrences(local(2030, 3, 4, 9), rule({ freq: 'custom', interval: 10, unit: 'days', end: { type: 'count', count: 3 } }));
    expect(dates.map(ymd)).toEqual(['2030-3-4 9:0', '2030-3-14 9:0', '2030-3-24 9:0']);
  });

  it('CT-REC-09 regra gravada no formato iCalendar', () => {
    expect(toRRule(local(2030, 3, 4), rule({ freq: 'biweekly', end: { type: 'count', count: 6 } }))).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;COUNT=6');
    expect(toRRule(local(2030, 3, 4), rule({ freq: 'none' }))).toBeNull();
  });
});

describe('ações em série', () => {
  const s = (id: string, day: number, status: 'pendente' | 'concluido' | 'cancelado' = 'pendente') =>
    appt({ id, recurrenceGroupId: 'g1', status, startsAt: `2030-03-${String(day).padStart(2, '0')}T13:00:00.000Z` });
  const series = [s('s1', 4, 'concluido'), s('s2', 11), s('s3', 18, 'cancelado'), s('s4', 25)];

  it('CT-REC-10 "este e os próximos" ignora concluídas e canceladas', () => {
    expect(seriesTargets(series[1], series, 'following')).toEqual(['s2', 's4']);
  });

  it('CT-REC-11 "só este" afeta só a sessão aberta', () => {
    expect(seriesTargets(series[1], series, 'one')).toEqual(['s2']);
  });

  it('CT-REC-12 posição da sessão na série', () => {
    expect(sessionPosition(series[3], series)).toBe('Sessão 4 de 4');
    expect(sessionPosition(appt(), [appt()])).toBeNull();
  });
});

describe('conflitos de horário', () => {
  // Segunda, 4 de março de 2030 (expediente 09–12 e 13–18)
  const ctx = { appointments: [], blocks: [], businessHours: weekHours };

  it('CT-AGE-01 horário livre dentro do expediente', () => {
    expect(slotConflict(local(2030, 3, 4, 9), 60, ctx)).toBeNull();
  });

  it('CT-AGE-02 data passada é recusada', () => {
    expect(slotConflict(local(2020, 3, 4, 9), 60, ctx)).toBe('Data já passou');
  });

  it('CT-AGE-03 domingo fechado e depois do expediente; a pausa do almoço não trava', () => {
    expect(slotConflict(local(2030, 3, 3, 9), 60, ctx)).toBe('Estúdio fechado');
    expect(slotConflict(local(2030, 3, 4, 11, 30), 60, ctx)).toBeNull();
    expect(slotConflict(local(2030, 3, 4, 17, 30), 60, ctx)).toBe('Fora do expediente');
  });

  it('CT-AGE-04 "atender fora do expediente" ignora horário, mas não outro atendimento', () => {
    const busy = appt({ startsAt: local(2030, 3, 3, 9).toISOString(), endsAt: local(2030, 3, 3, 10).toISOString() });
    expect(slotConflict(local(2030, 3, 3, 11), 60, { ...ctx, ignoreHours: true })).toBeNull();
    expect(slotConflict(local(2030, 3, 3, 9, 30), 60, { ...ctx, ignoreHours: true, appointments: [busy] })).toBe('Horário ocupado');
  });

  it('CT-AGE-05 folga de dia inteiro', () => {
    const off = block({ startsAt: local(2030, 3, 4).toISOString(), endsAt: local(2030, 3, 5).toISOString(), reason: 'Feriado' });
    expect(slotConflict(local(2030, 3, 4, 9), 60, { ...ctx, blocks: [off] })).toBe('Feriado');
  });

  it('CT-AGE-06 encostado no fim do anterior é permitido; sobreposto não', () => {
    const a = appt({ startsAt: local(2030, 3, 4, 9).toISOString(), endsAt: local(2030, 3, 4, 10).toISOString() });
    expect(slotConflict(local(2030, 3, 4, 10), 60, { ...ctx, appointments: [a] })).toBeNull();
    expect(slotConflict(local(2030, 3, 4, 9, 30), 60, { ...ctx, appointments: [a] })).toBe('Horário ocupado');
  });

  it('CT-AGE-07 atendimento cancelado não ocupa horário', () => {
    const a = appt({ status: 'cancelado', startsAt: local(2030, 3, 4, 9).toISOString(), endsAt: local(2030, 3, 4, 10).toISOString() });
    expect(slotConflict(local(2030, 3, 4, 9), 60, { ...ctx, appointments: [a] })).toBeNull();
  });

  it('CT-AGE-08 editar o próprio atendimento não conflita com ele mesmo', () => {
    const a = appt({ id: 'eu', startsAt: local(2030, 3, 4, 9).toISOString(), endsAt: local(2030, 3, 4, 10).toISOString() });
    expect(slotConflict(local(2030, 3, 4, 9, 30), 60, { ...ctx, appointments: [a], ignoreIds: ['eu'] })).toBeNull();
  });

  it('CT-AGE-09 domicílio: o deslocamento gravado (busyUntil) ocupa a agenda', () => {
    const home = appt({
      locationType: 'home_service',
      startsAt: local(2030, 3, 4, 9).toISOString(),
      endsAt: local(2030, 3, 4, 10).toISOString(),
      busyUntil: local(2030, 3, 4, 10, 45).toISOString(),
    });
    expect(busyEndMs(home, 30)).toBe(local(2030, 3, 4, 10, 45).getTime()); // usa o gravado, não o atual
    expect(slotConflict(local(2030, 3, 4, 10, 30), 60, { ...ctx, appointments: [home], travelBufferMin: 30 })).toBe('Horário ocupado');
    expect(slotConflict(local(2030, 3, 4, 10, 45), 60, { ...ctx, appointments: [home], travelBufferMin: 30 })).toBeNull();
  });

  it('CT-AGE-10 domicílio novo reserva o deslocamento depois dele', () => {
    const next = appt({ startsAt: local(2030, 3, 4, 10, 15).toISOString(), endsAt: local(2030, 3, 4, 11).toISOString() });
    expect(slotConflict(local(2030, 3, 4, 9), 60, { ...ctx, appointments: [next], travelBufferMin: 30, home: true })).toBe('Horário ocupado');
  });
});
