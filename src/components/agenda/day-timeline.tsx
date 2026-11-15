import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { StatusPill } from '@/components/ui';
import { formatTime, hmToMinutes, isSameDay, minutesOfDay } from '@/lib/dates';
import { formatBRL } from '@/lib/format';
import { colors, statusInfo } from '@/theme/colors';
import type { Appointment, Client, ScheduleBlock } from '@/types';

const HOUR_HEIGHT = 76;
const LABEL_WIDTH = 52;

interface Props {
  day: Date;
  workStart: string;
  workEnd: string;
  appointments: Appointment[];
  blocks: ScheduleBlock[];
  clientsById: Map<string, Client>;
  onPressAppointment: (a: Appointment) => void;
  onPressBlock: (b: ScheduleBlock) => void;
  onPressSlot: (minutes: number) => void;
}

/** Distribui itens sobrepostos lado a lado. */
function layoutColumns<T extends { startsAt: string; endsAt: string }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const result: { item: T; col: number; cols: number }[] = [];
  let group: { item: T; col: number }[] = [];
  let groupEnd = '';

  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    group.forEach((g) => result.push({ ...g, cols }));
    group = [];
  };

  for (const item of sorted) {
    if (group.length && item.startsAt >= groupEnd) flush();
    const used = new Set(group.filter((g) => g.item.endsAt > item.startsAt).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ item, col });
    if (group.length === 1 || item.endsAt > groupEnd) groupEnd = item.endsAt;
  }
  flush();
  return result;
}

export function DayTimeline({
  day,
  workStart,
  workEnd,
  appointments,
  blocks,
  clientsById,
  onPressAppointment,
  onPressBlock,
  onPressSlot,
}: Props) {
  // Expande o expediente se houver agendamento fora dele
  let startMin = hmToMinutes(workStart);
  let endMin = hmToMinutes(workEnd);
  for (const a of appointments) {
    startMin = Math.min(startMin, Math.floor(minutesOfDay(new Date(a.startsAt)) / 60) * 60);
    endMin = Math.max(endMin, Math.ceil(minutesOfDay(new Date(a.endsAt)) / 60) * 60);
  }
  const hours: number[] = [];
  for (let m = startMin; m < endMin; m += 60) hours.push(m);
  const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
  const y = (min: number) => ((min - startMin) / 60) * HOUR_HEIGHT;

  const now = new Date();
  const showNow = isSameDay(now, day) && minutesOfDay(now) >= startMin && minutesOfDay(now) <= endMin;

  const timedBlocks = blocks.filter((b) => !b.allDay);
  const laidOut = layoutColumns(appointments);

  return (
    <View style={{ height: height + 16 }} className="mx-4 mt-2">
      {/* Linhas das horas (tocar cria agendamento naquele horário) */}
      {hours.map((m) => (
        <View key={m} style={{ position: 'absolute', top: y(m), left: 0, right: 0, height: HOUR_HEIGHT }}>
          <View className="flex-row">
            <Text style={{ width: LABEL_WIDTH }} className="-mt-2 text-xs text-muted">
              {String(m / 60).padStart(2, '0')}:00
            </Text>
            <View className="h-px flex-1 bg-line" />
          </View>
          <View style={{ position: 'absolute', left: LABEL_WIDTH, right: 0, top: 0, bottom: 0 }} className="flex-col">
            <Pressable className="flex-1" onPress={() => onPressSlot(m)} />
            <Pressable className="flex-1" onPress={() => onPressSlot(m + 30)} />
          </View>
        </View>
      ))}

      {/* Bloqueios */}
      {timedBlocks.map((b) => {
        const top = y(minutesOfDay(new Date(b.startsAt)));
        const h = y(minutesOfDay(new Date(b.endsAt))) - top;
        return (
          <Pressable
            key={b.id}
            onPress={() => onPressBlock(b)}
            style={{ position: 'absolute', top, height: h, left: LABEL_WIDTH, right: 0 }}
            className="flex-row items-center rounded-xl border border-dashed border-[#D9D1CF] bg-[#F3EFED] px-3">
            <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
            <Text className="ml-1.5 text-[13px] font-medium text-muted">
              {b.reason ?? 'Bloqueado'} · {formatTime(b.startsAt)}–{formatTime(b.endsAt)}
            </Text>
          </Pressable>
        );
      })}

      {/* Agendamentos */}
      {laidOut.map(({ item: a, col, cols }) => {
        const top = y(minutesOfDay(new Date(a.startsAt)));
        const h = Math.max(y(minutesOfDay(new Date(a.endsAt))) - top, 34);
        const client = clientsById.get(a.clientId);
        const st = statusInfo[a.status];
        const compact = h < 60;
        const cancelled = a.status === 'cancelado';
        return (
          <View
            key={a.id}
            style={{
              position: 'absolute',
              top: top + 1,
              height: h - 2,
              left: LABEL_WIDTH,
              right: 0,
            }}
            pointerEvents="box-none">
            <View style={{ flexDirection: 'row', height: '100%' }} pointerEvents="box-none">
              <View style={{ flex: col }} pointerEvents="none" />
              <Pressable
                onPress={() => onPressAppointment(a)}
                style={{ flex: 1, backgroundColor: cancelled ? '#FBFAFA' : colors.surface, opacity: cancelled ? 0.7 : 1 }}
                className="mx-0.5 flex-row overflow-hidden rounded-xl border border-line active:opacity-70">
                <View style={{ width: 4, backgroundColor: st.color }} />
                <View className="flex-1 px-2.5 py-1.5">
                  <View className="flex-row items-center justify-between">
                    <Text
                      numberOfLines={1}
                      className={`flex-1 text-[14px] font-semibold text-ink ${cancelled ? 'line-through' : ''}`}>
                      {client?.name ?? 'Cliente'}
                    </Text>
                    {!compact && cols === 1 ? (
                      <Text className="ml-2 text-xs font-medium text-muted">{formatBRL(a.totalPrice)}</Text>
                    ) : null}
                  </View>
                  <Text numberOfLines={1} className="text-xs text-muted">
                    {formatTime(a.startsAt)} · {a.services.map((s) => s.name).join(' + ')}
                  </Text>
                  {!compact ? (
                    <View className="mt-1.5">
                      <StatusPill status={a.status} />
                    </View>
                  ) : null}
                </View>
              </Pressable>
              <View style={{ flex: cols - col - 1 }} pointerEvents="none" />
            </View>
          </View>
        );
      })}

      {/* Linha do horário atual */}
      {showNow ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: y(minutesOfDay(now)), left: LABEL_WIDTH - 5, right: 0 }}
          className="flex-row items-center">
          <View className="h-2.5 w-2.5 rounded-full bg-primary" />
          <View className="h-[1.5px] flex-1 bg-primary" />
        </View>
      ) : null}
    </View>
  );
}
