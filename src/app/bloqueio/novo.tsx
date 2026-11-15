import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Chip, Field, SectionLabel, Segmented } from '@/components/ui';
import { useStore } from '@/data/store';
import { closeModal } from '@/lib/confirm';
import { addDays, atMinutes, formatDayTitle, hmToMinutes, isSameDay, startOfDay, WEEKDAYS_SHORT } from '@/lib/dates';

const REASONS = ['Almoço', 'Folga', 'Curso', 'Compromisso pessoal'];
const DURATIONS = [30, 60, 90, 120, 180, 240];

export default function NovoBloqueio() {
  const params = useLocalSearchParams<{ date?: string }>();
  const { profile, addBlock } = useStore();

  const [kind, setKind] = useState<'horario' | 'dia'>('horario');
  const [day, setDay] = useState(startOfDay(params.date ? new Date(params.date) : new Date()));
  const [start, setStart] = useState(12 * 60);
  const [duration, setDuration] = useState(60);
  const [reason, setReason] = useState('Almoço');

  const days = Array.from({ length: 30 }, (_, i) => addDays(startOfDay(new Date()), i));
  const startOptions: number[] = [];
  for (let m = hmToMinutes(profile.workStart); m < hmToMinutes(profile.workEnd); m += 30) startOptions.push(m);

  async function save() {
    let ok: boolean;
    if (kind === 'dia') {
      ok = await addBlock({ startsAt: day.toISOString(), endsAt: addDays(day, 1).toISOString(), allDay: true, reason });
    } else {
      ok = await addBlock({
        startsAt: atMinutes(day, start).toISOString(),
        endsAt: atMinutes(day, start + duration).toISOString(),
        allDay: false,
        reason,
      });
    }
    if (ok) closeModal();
  }

  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <Segmented
        value={kind}
        onChange={(k) => {
          setKind(k);
          setReason(k === 'dia' ? 'Folga' : 'Almoço');
        }}
        options={[
          { value: 'horario', label: 'Horário' },
          { value: 'dia', label: 'Dia inteiro' },
        ]}
      />

      <SectionLabel>Data · {formatDayTitle(day)}</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {days.map((d) => {
          const sel = isSameDay(d, day);
          return (
            <Pressable
              key={d.toDateString()}
              onPress={() => setDay(d)}
              className={`mr-2 w-14 items-center rounded-2xl border py-2 ${sel ? 'border-primary bg-primary' : 'border-line bg-surface'}`}>
              <Text className={`text-[11px] ${sel ? 'text-white' : 'text-muted'}`}>{WEEKDAYS_SHORT[d.getDay()]}</Text>
              <Text className={`text-lg font-semibold ${sel ? 'text-white' : 'text-ink'}`}>{d.getDate()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {kind === 'horario' ? (
        <>
          <SectionLabel>Início</SectionLabel>
          <View className="flex-row flex-wrap">
            {startOptions.map((m) => (
              <Chip key={m} label={hm(m)} selected={start === m} onPress={() => setStart(m)} />
            ))}
          </View>
          <SectionLabel>Duração · até {hm(start + duration)}</SectionLabel>
          <View className="flex-row flex-wrap">
            {DURATIONS.map((d) => (
              <Chip key={d} label={d < 60 ? `${d}min` : `${d / 60}h`} selected={duration === d} onPress={() => setDuration(d)} />
            ))}
          </View>
        </>
      ) : null}

      <SectionLabel>Motivo</SectionLabel>
      <View className="flex-row flex-wrap">
        {REASONS.map((r) => (
          <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
        ))}
      </View>
      <Field label="Ou escreva" value={reason} onChangeText={setReason} placeholder="Motivo do bloqueio" />

      <View className="mt-4">
        <Button title="Bloquear" icon="lock-closed-outline" onPress={save} disabled={!reason.trim()} />
      </View>
    </ScrollView>
  );
}
