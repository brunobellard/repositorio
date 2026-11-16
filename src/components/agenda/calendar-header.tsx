import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { Segmented } from '@/components/ui';
import {
  addDays,
  isSameDay,
  MONTHS,
  chunkWeeks,
  monthGrid,
  startOfDay,
  weekDays,
  WEEKDAYS_SHORT,
} from '@/lib/dates';
import { colors } from '@/theme/colors';

export type CalendarMode = 'semana' | 'mes';

interface Props {
  mode: CalendarMode;
  onModeChange: (m: CalendarMode) => void;
  selected: Date;
  onSelect: (d: Date) => void;
  /** quantidade de agendamentos ativos por dia, chave = toDateString() */
  counts: Map<string, number>;
  /** dias inteiros bloqueados, chave = toDateString() */
  blockedDays: Set<string>;
}

export function CalendarHeader({ mode, onModeChange, selected, onSelect, counts, blockedDays }: Props) {
  const today = startOfDay(new Date());
  const days = mode === 'semana' ? weekDays(selected) : monthGrid(selected);

  function shift(dir: 1 | -1) {
    if (mode === 'semana') onSelect(addDays(selected, 7 * dir));
    else {
      const d = new Date(selected.getFullYear(), selected.getMonth() + dir, 1);
      onSelect(d);
    }
  }

  return (
    <View className="mx-4 rounded-card border border-line bg-surface px-3 pb-3 pt-3">
      <View className="mb-3 flex-row items-center">
        <Pressable onPress={() => shift(-1)} hitSlop={10} className="p-1">
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
        <Text numberOfLines={1} className="ml-1 flex-1 text-[15px] font-semibold text-ink">
          {MONTHS[selected.getMonth()].slice(0, 3)} {selected.getFullYear()}
        </Text>
        <Pressable onPress={() => shift(1)} hitSlop={10} className="mr-2 p-1">
          <Ionicons name="chevron-forward" size={20} color={colors.ink} />
        </Pressable>
        <View className="w-40">
          <Segmented
            value={mode}
            onChange={onModeChange}
            options={[
              { value: 'semana', label: 'Semana' },
              { value: 'mes', label: 'Mês' },
            ]}
          />
        </View>
      </View>

      <View className="flex-row">
        {WEEKDAYS_SHORT.map((w) => (
          <Text key={w} className="flex-1 text-center text-[11px] font-medium text-muted">
            {w}
          </Text>
        ))}
      </View>

      <View className="mt-1">
        {chunkWeeks(days).map((week) => (
        <View key={week[0].toDateString()} className="flex-row">
        {week.map((d) => {
          const key = d.toDateString();
          const isSel = isSameDay(d, selected);
          const isToday = isSameDay(d, today);
          const outside = mode === 'mes' && d.getMonth() !== selected.getMonth();
          const count = counts.get(key) ?? 0;
          const blocked = blockedDays.has(key);
          return (
            <Pressable
              key={key}
              onPress={() => onSelect(d)}
              className="flex-1 items-center py-1">
              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  isSel ? 'bg-primary' : isToday ? 'bg-primary-soft' : ''
                }`}>
                <Text
                  className={`text-[15px] ${
                    isSel
                      ? 'font-bold text-on-primary'
                      : outside
                        ? 'text-line'
                        : blocked
                          ? 'text-muted line-through'
                          : isToday
                            ? 'font-bold text-primary-dark'
                            : 'text-ink'
                  }`}>
                  {d.getDate()}
                </Text>
              </View>
              <View className="mt-0.5 h-1.5 flex-row">
                {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                  <View
                    key={i}
                    className="mx-[1px] h-1 w-1 rounded-full"
                    style={{ backgroundColor: outside ? colors.line : colors.primary }}
                  />
                ))}
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
