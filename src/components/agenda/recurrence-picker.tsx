import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { RangeCalendar } from '@/components/range-calendar';
import { Chip, Segmented } from '@/components/ui';
import { addDays, formatDateShort } from '@/lib/dates';
import { onlyDigits } from '@/lib/format';
import { describeFrequency, MAX_OCCURRENCES, type RecurrenceFreq, type RecurrenceRule } from '@/lib/recurrence';
import { colors } from '@/theme/colors';

export const NO_REPEAT: RecurrenceRule = {
  freq: 'none',
  interval: 4,
  unit: 'weeks',
  end: { type: 'count', count: 6 },
};

const MAIN_OPTIONS: { freq: RecurrenceFreq; label: string }[] = [
  { freq: 'none', label: 'Não se repete' },
  { freq: 'weekly', label: 'Semanal' },
  { freq: 'biweekly', label: 'Quinzenal' },
  { freq: 'triweekly', label: 'A cada 3 semanas' },
  { freq: 'monthly_day', label: 'Mensal' },
  { freq: 'custom', label: 'Personalizado' },
];

const COUNTS = [4, 6, 8, 12];

/**
 * Seção "Repetir agendamento": fechada mostra só a regra atual;
 * aberta permite escolher frequência e quando termina.
 */
export function RecurrencePicker({
  start,
  value,
  onChange,
  locked = false,
  onLockedPress,
}: {
  /** Data/hora da primeira sessão (para textos como "toda 3ª sexta") */
  start: Date;
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  /** Recurso fora do plano: mostra o cadeado e abre o aviso de upgrade */
  locked?: boolean;
  onLockedPress?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [customCount, setCustomCount] = useState('');
  const repeats = value.freq !== 'none';
  const set = (patch: Partial<RecurrenceRule>) => onChange({ ...value, ...patch });
  const isMonthly = value.freq === 'monthly_day' || value.freq === 'monthly_weekday';

  if (locked) {
    return (
      <Pressable accessibilityRole="button"
        onPress={onLockedPress}
        className="flex-row items-center rounded-card border border-line bg-surface px-4 py-3 active:opacity-70">
        <Ionicons name="repeat" size={18} color={colors.muted} />
        <View className="ml-3 flex-1">
          <Text className="text-[15px] text-muted">Não se repete</Text>
          <Text className="text-xs text-muted">Agenda recorrente a partir do plano Básico</Text>
        </View>
        <Ionicons name="lock-closed" size={15} color={colors.primaryDark} />
      </Pressable>
    );
  }

  return (
    <View className="overflow-hidden rounded-card border border-line bg-surface">
      <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} className="flex-row items-center px-4 py-3 active:opacity-70">
        <Ionicons name="repeat" size={18} color={repeats ? colors.primaryDark : colors.muted} />
        <View className="ml-3 flex-1">
          <Text className={`text-[15px] ${repeats ? 'font-medium text-ink' : 'text-muted'}`}>
            {describeFrequency(start, value)}
          </Text>
          {repeats ? (
            <Text className="text-xs text-muted">
              {value.end.type === 'count'
                ? `${value.end.count} sessões`
                : value.end.type === 'until'
                  ? `Até ${formatDateShort(value.end.date)}`
                  : 'Sem data para acabar'}
            </Text>
          ) : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
      </Pressable>

      {open ? (
        <View className="border-t border-line px-4 pb-4 pt-3">
          <View className="flex-row flex-wrap">
            {MAIN_OPTIONS.map((o) => (
              <Chip
                key={o.freq}
                label={o.label}
                selected={o.freq === 'monthly_day' ? isMonthly : value.freq === o.freq}
                onPress={() => set({ freq: o.freq })}
              />
            ))}
          </View>

          {isMonthly ? (
            <View className="mb-2 mt-1">
              <Segmented
                value={value.freq}
                onChange={(freq) => set({ freq })}
                options={[
                  { value: 'monthly_day', label: `Todo dia ${start.getDate()}` },
                  {
                    value: 'monthly_weekday',
                    label: describeFrequency(start, { freq: 'monthly_weekday', interval: 1, unit: 'days' }).replace(
                      ' do mês',
                      '',
                    ),
                  },
                ]}
              />
            </View>
          ) : null}

          {value.freq === 'custom' ? (
            <View className="mb-2 mt-1 flex-row items-center">
              <Text className="mr-2 text-[14px] text-ink">A cada</Text>
              <TextInput
                value={String(value.interval)}
                onChangeText={(t) => set({ interval: Math.min(Number(onlyDigits(t).slice(0, 2)) || 1, 52) })}
                keyboardType="number-pad"
                className="w-14 rounded-xl border border-line bg-bg px-2 py-2 text-center text-[15px] text-ink"
              />
              <View className="ml-2 flex-1">
                <Segmented
                  value={value.unit}
                  onChange={(unit) => set({ unit })}
                  options={[
                    { value: 'days', label: 'dias' },
                    { value: 'weeks', label: 'semanas' },
                  ]}
                />
              </View>
            </View>
          ) : null}

          {repeats ? (
            <>
              <Text className="mb-1.5 mt-3 text-[13px] font-medium text-muted">Termina</Text>
              <Segmented
                value={value.end.type}
                onChange={(type) =>
                  set({
                    end:
                      type === 'count'
                        ? { type: 'count', count: 6 }
                        : type === 'until'
                          ? { type: 'until', date: addDays(start, 90) }
                          : { type: 'never' },
                  })
                }
                options={[
                  { value: 'count', label: 'Nº de sessões' },
                  { value: 'until', label: 'Até uma data' },
                  { value: 'never', label: 'Sem fim' },
                ]}
              />
              {value.end.type === 'never' ? (
                <Text className="mt-2 text-[13px] leading-5 text-muted">
                  O app cria 1 ano de sessões e, conforme o tempo passa, vai criando as próximas sozinho. Para
                  parar, cancele uma sessão e escolha &quot;Cancelar este e os próximos&quot;.
                </Text>
              ) : value.end.type === 'count' ? (
                <View className="mt-3 flex-row flex-wrap items-center">
                  {COUNTS.map((c) => (
                    <Chip
                      key={c}
                      label={`${c} sessões`}
                      selected={!customCount && value.end.type === 'count' && value.end.count === c}
                      onPress={() => {
                        setCustomCount('');
                        set({ end: { type: 'count', count: c } });
                      }}
                    />
                  ))}
                  <TextInput
                    value={customCount}
                    onChangeText={(t) => {
                      const v = onlyDigits(t).slice(0, 2);
                      setCustomCount(v);
                      const n = Number(v);
                      if (n >= 2) set({ end: { type: 'count', count: Math.min(n, MAX_OCCURRENCES) } });
                    }}
                    placeholder="Outro"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    className={`mb-2 w-20 rounded-full border px-4 py-2 text-center text-sm text-ink ${
                      customCount ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
                    }`}
                  />
                </View>
              ) : (
                <View className="mt-3">
                  <RangeCalendar
                    start={value.end.date}
                    end={null}
                    onChange={(s, e) => {
                      const d = e ?? s;
                      if (d) set({ end: { type: 'until', date: d } });
                    }}
                  />
                </View>
              )}
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
