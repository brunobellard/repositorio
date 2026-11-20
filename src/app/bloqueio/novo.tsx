import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Chip, Field, SectionLabel, Segmented } from '@/components/ui';
import { useStore } from '@/data/store';
import { closeModal, confirmAction, notify } from '@/lib/confirm';
import { addDays, atMinutes, formatDayTitle, hmToMinutes, isSameDay, startOfDay, WEEKDAYS_SHORT } from '@/lib/dates';
import { appointmentsBetween, describeAppointments, hoursForDay, weekRange } from '@/lib/hours';

const REASONS = ['Almoço', 'Folga', 'Curso', 'Compromisso pessoal'];
const DURATIONS = [30, 60, 90, 120, 180, 240];

export default function NovoBloqueio() {
  const params = useLocalSearchParams<{ date?: string }>();
  const { addBlock, appointments, clients, businessHours } = useStore();

  const [kind, setKind] = useState<'horario' | 'dia'>('horario');
  const [day, setDay] = useState(startOfDay(params.date ? new Date(params.date) : new Date()));
  const [start, setStart] = useState(12 * 60);
  const [duration, setDuration] = useState(60);
  const [reason, setReason] = useState('Almoço');

  const days = Array.from({ length: 30 }, (_, i) => addDays(startOfDay(new Date()), i));
  // Horários de início seguem o expediente do dia escolhido (dia fechado: a faixa da semana)
  const dayHours = hoursForDay(day, businessHours);
  const [from, to] = dayHours.isOpen
    ? [hmToMinutes(dayHours.openTime), hmToMinutes(dayHours.closeTime)]
    : weekRange(businessHours);
  const startOptions: number[] = [];
  for (let m = Math.floor(from / 30) * 30; m < to; m += 30) startOptions.push(m);
  // Início escolhido fora da faixa do novo dia: usa o primeiro horário disponível
  const startMin = startOptions.includes(start) ? start : (startOptions[0] ?? start);

  const [saving, setSaving] = useState(false);

  const period =
    kind === 'dia'
      ? { start: day, end: addDays(day, 1) }
      : { start: atMinutes(day, startMin), end: atMinutes(day, startMin + duration) };

  /** Avisa se já há atendimentos marcados no período (o bloqueio não cancela nenhum). */
  function save() {
    if (saving) return;
    const affected = appointmentsBetween(appointments, period.start, period.end);
    if (!affected.length) return doSave();
    confirmAction(
      affected.length === 1 ? 'Há 1 atendimento nesse período' : `Há ${affected.length} atendimentos nesse período`,
      `${describeAppointments(affected, clients)}\n\nO bloqueio não cancela esses atendimentos: eles continuam na agenda. Remarque ou cancele se precisar.`,
      doSave,
      'Bloquear mesmo assim',
    );
  }

  async function doSave() {
    if (saving) return;
    setSaving(true); // trava no primeiro toque: evita bloqueio duplicado
    let ok: boolean;
    if (kind === 'dia') {
      ok = await addBlock({ startsAt: day.toISOString(), endsAt: addDays(day, 1).toISOString(), allDay: true, reason });
    } else {
      ok = await addBlock({
        startsAt: period.start.toISOString(),
        endsAt: period.end.toISOString(),
        allDay: false,
        reason,
      });
    }
    if (ok) {
      notify('Horário bloqueado');
      closeModal();
    } else setSaving(false);
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
            <Pressable accessibilityRole="button" accessibilityLabel={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} accessibilityState={{ selected: !!sel }}
              key={d.toDateString()}
              onPress={() => setDay(d)}
              className={`mr-2 w-14 items-center rounded-2xl border py-2 ${sel ? 'border-primary bg-primary' : 'border-line bg-surface'}`}>
              <Text className={`text-[11px] ${sel ? 'text-on-primary' : 'text-muted'}`}>{WEEKDAYS_SHORT[d.getDay()]}</Text>
              <Text className={`text-lg font-semibold ${sel ? 'text-on-primary' : 'text-ink'}`}>{d.getDate()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {kind === 'horario' ? (
        <>
          <SectionLabel>Início</SectionLabel>
          <View className="flex-row flex-wrap">
            {startOptions.map((m) => (
              <Chip key={m} label={hm(m)} selected={startMin === m} onPress={() => setStart(m)} />
            ))}
          </View>
          <SectionLabel>Duração · até {hm(startMin + duration)}</SectionLabel>
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
        <Button
          title={saving ? 'Salvando…' : 'Bloquear'}
          icon="lock-closed-outline"
          loading={saving}
          onPress={save}
          disabled={!reason.trim()}
        />
      </View>
    </ScrollView>
  );
}
