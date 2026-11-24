import { Pressable, Text, View } from 'react-native';

import { layoutColumns } from '@/components/agenda/day-timeline';
import { addDays, formatTime, isSameDay, minutesOfDay, startOfDay, weekDays, WEEKDAYS_SHORT } from '@/lib/dates';
import { hoursForDay, timeOffOn, weekRange, workRanges } from '@/lib/hours';
import { colors, statusInfo } from '@/theme/colors';
import type { Appointment, BusinessHours, Client, ScheduleBlock } from '@/types';

const HOUR_HEIGHT = 52;
const LABEL_WIDTH = 30;
const OFF_BG = 'rgba(241, 236, 234, 0.75)';

interface Props {
  /** Qualquer dia da semana mostrada */
  selected: Date;
  businessHours: BusinessHours[];
  /** Atendimentos ativos (sem cancelados) */
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  clientsById: Map<string, Client>;
  onPressAppointment: (a: Appointment) => void;
  onPressBlock: (b: ScheduleBlock) => void;
  onPressSlot: (day: Date, minutes: number) => void;
  /** Toque no cabeçalho de um dia: abre esse dia na visão Dia */
  onPressDay: (day: Date) => void;
}

const hh = (m: number) => String(Math.floor(m / 60)).padStart(2, '0');
const firstName = (name?: string) => (name ?? 'Cliente').trim().split(/\s+/)[0];

/** Grade da semana: 7 colunas, horas na lateral e os atendimentos como blocos. */
export function WeekGrid({
  selected,
  businessHours,
  appointments,
  blocks,
  clientsById,
  onPressAppointment,
  onPressBlock,
  onPressSlot,
  onPressDay,
}: Props) {
  const days = weekDays(selected);
  const today = startOfDay(new Date());
  const now = new Date();

  // Faixa de horas: o expediente da semana, ampliada se houver atendimento fora dele
  const [ws, we] = weekRange(businessHours);
  let startMin = Math.floor(ws / 60) * 60;
  let endMin = Math.ceil(we / 60) * 60;
  const perDay = days.map((d) => {
    const s = d.getTime();
    const e = addDays(d, 1).getTime();
    const mins = (iso: string) => Math.max(0, Math.min(24 * 60, (new Date(iso).getTime() - s) / 60_000));
    const appts = appointments.filter((a) => new Date(a.startsAt).getTime() < e && new Date(a.endsAt).getTime() > s);
    const timed = blocks.filter(
      (b) => !b.allDay && new Date(b.startsAt).getTime() < e && new Date(b.endsAt).getTime() > s,
    );
    const hours = hoursForDay(d, businessHours);
    const off = timeOffOn(d, blocks);
    return { day: d, mins, appts, timed, hours, off, closed: !hours.isOpen || !!off };
  });
  for (const { appts, mins } of perDay) {
    for (const a of appts) {
      startMin = Math.min(startMin, Math.floor(mins(a.startsAt) / 60) * 60);
      endMin = Math.max(endMin, Math.ceil(mins(a.endsAt) / 60) * 60);
    }
  }
  if (endMin <= startMin) endMin = startMin + 60;

  const hourMarks: number[] = [];
  for (let m = startMin; m < endMin; m += 60) hourMarks.push(m);
  const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
  const y = (min: number) => ((min - startMin) / 60) * HOUR_HEIGHT;

  return (
    <View className="mx-2 mt-3">
      {/* Cabeçalho: dia da semana e número */}
      <View className="flex-row" style={{ paddingLeft: LABEL_WIDTH }}>
        {perDay.map(({ day, closed, appts }) => {
          const isToday = isSameDay(day, today);
          const isSel = isSameDay(day, selected);
          return (
            <Pressable
              key={day.toDateString()}
              accessibilityRole="button"
              accessibilityLabel={`${day.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}, ${appts.length} atendimentos. Abrir o dia`}
              onPress={() => onPressDay(day)}
              className="flex-1 items-center pb-1.5">
              <Text className={`text-[11px] font-medium ${isToday ? 'text-primary-dark' : 'text-muted'}`}>
                {WEEKDAYS_SHORT[day.getDay()]}
              </Text>
              <View
                className={`mt-0.5 h-7 w-7 items-center justify-center rounded-full ${
                  isToday ? 'bg-primary' : isSel ? 'bg-primary-soft' : ''
                }`}>
                <Text
                  className={`text-[14px] ${
                    isToday ? 'font-bold text-on-primary' : closed ? 'text-muted line-through' : 'font-semibold text-ink'
                  }`}>
                  {day.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: height + 12 }} className="border-t border-line">
        {/* Horas e linhas */}
        {hourMarks.map((m) => (
          <View
            key={m}
            pointerEvents="none"
            style={{ position: 'absolute', top: y(m), left: 0, right: 0 }}
            className="flex-row">
            <Text style={{ width: LABEL_WIDTH }} className="-mt-1.5 text-[10px] text-muted">
              {m === startMin ? '' : hh(m)}
            </Text>
            <View className="h-px flex-1 bg-line/70" />
          </View>
        ))}

        <View style={{ position: 'absolute', top: 0, bottom: 12, left: LABEL_WIDTH, right: 0 }} className="flex-row">
          {perDay.map(({ day, mins, appts, timed, hours, off, closed }) => {
            // Faixas fora do expediente (antes de abrir, pausa, depois de fechar)
            const unavailable: [number, number][] = [];
            if (closed) unavailable.push([startMin, endMin]);
            else {
              let cursor = startMin;
              for (const [s, e] of workRanges(hours)) {
                if (s > cursor) unavailable.push([cursor, s]);
                cursor = Math.max(cursor, e);
              }
              if (cursor < endMin) unavailable.push([cursor, endMin]);
            }
            const showNow =
              isSameDay(day, now) && minutesOfDay(now) >= startMin && minutesOfDay(now) <= endMin;
            return (
              <View key={day.toDateString()} className="flex-1 border-l border-line/70">
                {unavailable.map(([f, t]) => (
                  <View
                    key={f}
                    pointerEvents="none"
                    style={{ position: 'absolute', top: y(f), height: y(t) - y(f), left: 0, right: 0, backgroundColor: OFF_BG }}
                  />
                ))}
                {closed && off ? (
                  <Text
                    pointerEvents="none"
                    numberOfLines={3}
                    style={{ position: 'absolute', top: 6, left: 2, right: 2 }}
                    className="text-center text-[9px] font-medium uppercase text-muted">
                    {off.reason ?? 'Folga'}
                  </Text>
                ) : null}

                {/* Toque num espaço vazio: agenda naquele dia e horário (de meia em meia hora) */}
                {hourMarks.map((m) => (
                  <View key={m} style={{ position: 'absolute', top: y(m), height: HOUR_HEIGHT, left: 0, right: 0 }}>
                    {[m, m + 30].map((slot) => (
                      <Pressable
                        key={slot}
                        accessibilityRole="button"
                        accessibilityLabel={`Agendar ${WEEKDAYS_SHORT[day.getDay()]} ${day.getDate()} às ${hh(slot)}:${String(slot % 60).padStart(2, '0')}`}
                        className="flex-1"
                        onPress={() => onPressSlot(day, slot)}
                      />
                    ))}
                  </View>
                ))}

                {timed.map((b) => {
                  const top = y(Math.max(startMin, mins(b.startsAt)));
                  const h = y(Math.min(endMin, mins(b.endsAt))) - top;
                  return (
                    <Pressable
                      key={b.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${b.reason ?? 'Bloqueio'}, ${formatTime(b.startsAt)} a ${formatTime(b.endsAt)}`}
                      onPress={() => onPressBlock(b)}
                      style={{ position: 'absolute', top: top + 1, height: Math.max(h - 2, 10), left: 1, right: 1 }}
                      className="overflow-hidden rounded-md border border-dashed border-[#D9D1CF] bg-[#F3EFED] px-0.5"
                    />
                  );
                })}

                {showNow ? (
                  <View
                    pointerEvents="none"
                    style={{ position: 'absolute', top: y(minutesOfDay(now)) - 1, left: 0, right: 0 }}
                    className="flex-row items-center">
                    <View className="-ml-1 h-2 w-2 rounded-full bg-primary" />
                    <View className="h-[1.5px] flex-1 bg-primary" />
                  </View>
                ) : null}

                {layoutColumns(appts).map(({ item: a, col, cols }) => {
                  const top = y(Math.max(startMin, mins(a.startsAt)));
                  const h = Math.max(y(Math.min(endMin, mins(a.endsAt))) - top, 18);
                  const st = statusInfo[a.status];
                  const client = clientsById.get(a.clientId);
                  const lines = Math.max(1, Math.floor((h - 4) / 13));
                  return (
                    <Pressable
                      key={a.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${client?.name ?? 'Cliente'}, ${formatTime(a.startsAt)}, ${a.services.map((s) => s.name).join(' + ')}, ${st.label}`}
                      onPress={() => onPressAppointment(a)}
                      style={{
                        position: 'absolute',
                        top: top + 1,
                        height: h - 2,
                        left: `${(col / cols) * 100}%`,
                        width: `${100 / cols}%`,
                        paddingHorizontal: 1,
                      }}
                      className="active:opacity-70">
                      <View
                        style={{ flex: 1, backgroundColor: st.bg, borderLeftColor: st.color }}
                        className="overflow-hidden rounded-md border-l-[3px] px-[3px] py-0.5">
                        <Text numberOfLines={1} ellipsizeMode="clip" style={{ color: colors.ink }} className="text-[10px] font-semibold leading-[13px]">
                          {firstName(client?.name)}
                        </Text>
                        {lines > 1 ? (
                          <Text numberOfLines={1} ellipsizeMode="clip" className="text-[10px] leading-[13px] text-muted">
                            {formatTime(a.startsAt)}
                          </Text>
                        ) : null}
                        {lines > 2 ? (
                          <Text numberOfLines={lines - 2} className="text-[10px] leading-[13px] text-muted">
                            {a.services.map((s) => s.name).join(' + ')}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* Hora em que a grade termina */}
        <View pointerEvents="none" style={{ position: 'absolute', top: y(endMin), left: 0, right: 0 }} className="flex-row">
          <Text style={{ width: LABEL_WIDTH }} className="-mt-1.5 text-[10px] text-muted">
            {hh(endMin)}
          </Text>
          <View className="h-px flex-1 bg-line/70" />
        </View>
      </View>
    </View>
  );
}
