import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { chunkWeeks, isSameDay, monthGrid, MONTHS, startOfDay, WEEKDAYS_SHORT } from '@/lib/dates';
import { colors } from '@/theme/colors';

/**
 * Calendário mensal para escolher um dia ou um período.
 * 1º toque = início; 2º toque (depois do início) = fim; tocar de novo recomeça.
 */
export function RangeCalendar({
  start,
  end,
  onChange,
  allowPast = false,
}: {
  /** true: permite escolher datas passadas (ex: período de relatório) */
  allowPast?: boolean;
  start: Date | null;
  end: Date | null;
  onChange: (start: Date | null, end: Date | null) => void;
}) {
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(() => new Date((start ?? today).getFullYear(), (start ?? today).getMonth(), 1));
  const days = monthGrid(month);

  function press(d: Date) {
    if (!start || end || d < start) onChange(d, null);
    else if (isSameDay(d, start)) onChange(d, null);
    else onChange(start, d);
  }

  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const inRange = (d: Date) => !!start && !!end && d > start && d < end;

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Pressable onPress={() => shift(-1)} hitSlop={10} className="p-1">
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
        </Pressable>
        <Text className="text-[15px] font-semibold text-ink">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Text>
        <Pressable onPress={() => shift(1)} hitSlop={10} className="p-1">
          <Ionicons name="chevron-forward" size={18} color={colors.ink} />
        </Pressable>
      </View>
      <View className="flex-row">
        {WEEKDAYS_SHORT.map((w) => (
          <Text key={w} className="flex-1 text-center text-[11px] text-muted">
            {w[0]}
          </Text>
        ))}
      </View>
      <View className="mt-1">
        {chunkWeeks(days).map((week) => (
        <View key={week[0].toDateString()} className="flex-row">
        {week.map((d) => {
          const other = d.getMonth() !== month.getMonth();
          const past = !allowPast && d < today;
          const edge = (start && isSameDay(d, start)) || (end && isSameDay(d, end));
          return (
            <Pressable
              key={d.toDateString()}
              disabled={past}
              onPress={() => press(d)}
              className={`h-10 flex-1 items-center justify-center ${inRange(d) ? 'bg-primary-soft' : ''}`}>
              <View className={`h-9 w-9 items-center justify-center rounded-full ${edge ? 'bg-primary' : ''}`}>
                <Text
                  className={`text-[14px] ${
                    edge ? 'font-semibold text-white' : past ? 'text-line' : other ? 'text-muted' : 'text-ink'
                  }`}>
                  {d.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
        </View>
        ))}
      </View>
    </View>
  );
}
