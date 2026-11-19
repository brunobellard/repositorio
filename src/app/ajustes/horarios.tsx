import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { HeaderKeyboardView } from '@/components/keyboard-view';
import { RangeCalendar } from '@/components/range-calendar';
import { Button, Card, Chip, EmptyState, SectionLabel, Toggle } from '@/components/ui';
import { useStore } from '@/data/store';
import { confirmAction, notify } from '@/lib/confirm';
import { addDays, formatDateShort, hmToMinutes, startOfDay } from '@/lib/dates';
import { maskTime } from '@/lib/format';
import { isValidTime, WEEK_ORDER, WEEKDAYS_LONG } from '@/lib/hours';
import { colors } from '@/theme/colors';
import type { BusinessHours } from '@/types';

interface DayDraft {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
}

const toDraft = (h: BusinessHours): DayDraft => ({
  dayOfWeek: h.dayOfWeek,
  isOpen: h.isOpen,
  openTime: h.openTime,
  closeTime: h.closeTime,
  hasBreak: !!(h.breakStart && h.breakEnd),
  breakStart: h.breakStart ?? '12:00',
  breakEnd: h.breakEnd ?? '13:00',
});

/** Problema no horário do dia, ou null se estiver tudo certo. */
function validate(d: DayDraft): string | null {
  if (!d.isOpen) return null;
  if (!isValidTime(d.openTime) || !isValidTime(d.closeTime)) return 'Use o formato 09:00';
  const open = hmToMinutes(d.openTime);
  const close = hmToMinutes(d.closeTime);
  if (close <= open) return 'O fechamento precisa ser depois da abertura';
  if (d.hasBreak) {
    if (!isValidTime(d.breakStart) || !isValidTime(d.breakEnd)) return 'Pausa: use o formato 12:00';
    const bs = hmToMinutes(d.breakStart);
    const be = hmToMinutes(d.breakEnd);
    if (be <= bs) return 'O fim da pausa precisa ser depois do início';
    if (bs < open || be > close) return 'A pausa precisa estar dentro do expediente';
  }
  return null;
}

function TimeBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const invalid = value.length === 5 && !isValidTime(value);
  return (
    <View className="flex-1">
      <Text className="mb-1 text-[11px] text-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(maskTime(t))}
        keyboardType="number-pad"
        maxLength={5}
        placeholder="00:00"
        placeholderTextColor={colors.muted}
        className={`rounded-xl border px-3 py-2 text-center text-[15px] font-medium text-ink ${
          invalid ? 'border-[#B2474F]' : 'border-line bg-bg'
        }`}
      />
    </View>
  );
}

const REASONS = ['Folga', 'Feriado Nacional', 'Férias', 'Consulta médica', 'Curso'];

export default function HorariosScreen() {
  const { businessHours, saveBusinessHours, hoursAvailable, blocks, addBlock, removeBlock } = useStore();
  const [drafts, setDrafts] = useState<DayDraft[]>(() => businessHours.map(toDraft));
  const [saving, setSaving] = useState(false);

  // Nova folga
  const [adding, setAdding] = useState(false);
  const [range, setRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [reason, setReason] = useState('Folga');
  const [savingOff, setSavingOff] = useState(false);

  const original = businessHours.map(toDraft);
  const dirty = JSON.stringify(drafts) !== JSON.stringify(original);
  const errors = new Map(drafts.map((d) => [d.dayOfWeek, validate(d)]));
  const hasErrors = [...errors.values()].some(Boolean);

  const update = (dow: number, patch: Partial<DayDraft>) =>
    setDrafts((list) => list.map((d) => (d.dayOfWeek === dow ? { ...d, ...patch } : d)));

  function copyMonday() {
    const mon = drafts.find((d) => d.dayOfWeek === 1)!;
    setDrafts((list) =>
      list.map((d) => (d.dayOfWeek >= 2 && d.dayOfWeek <= 5 ? { ...mon, dayOfWeek: d.dayOfWeek } : d)),
    );
  }

  async function save() {
    if (hasErrors || saving) return;
    setSaving(true);
    const ok = await saveBusinessHours(
      drafts.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        isOpen: d.isOpen,
        openTime: d.openTime,
        closeTime: d.closeTime,
        breakStart: d.hasBreak ? d.breakStart : undefined,
        breakEnd: d.hasBreak ? d.breakEnd : undefined,
      })),
    );
    setSaving(false);
    if (ok) notify('Horários salvos', 'A agenda já segue o novo expediente.');
  }

  async function saveTimeOff() {
    if (!range.start || savingOff) return;
    setSavingOff(true);
    const start = startOfDay(range.start);
    const end = addDays(startOfDay(range.end ?? range.start), 1);
    const ok = await addBlock({
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      allDay: true,
      reason: reason.trim() || 'Folga',
    });
    setSavingOff(false);
    if (ok) {
      setAdding(false);
      setRange({ start: null, end: null });
      setReason('Folga');
    }
  }

  const today = startOfDay(new Date()).getTime();
  const timeOffs = blocks
    .filter((b) => b.allDay && new Date(b.endsAt).getTime() > today)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  function describeOff(startsAt: string, endsAt: string) {
    const s = new Date(startsAt);
    const last = addDays(new Date(endsAt), -1);
    const days = Math.round((new Date(endsAt).getTime() - s.getTime()) / 86_400_000);
    return days <= 1 ? formatDateShort(s) : `${formatDateShort(s)} a ${formatDateShort(last)} · ${days} dias`;
  }

  return (
    <HeaderKeyboardView>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {!hoursAvailable ? (
          <View className="mb-3 rounded-2xl bg-[#FBF3E4] p-3">
            <Text className="text-[13px] leading-5 text-[#8A6420]">
              Falta aplicar a atualização do banco (migração de Ajustes) no Supabase. Até lá, a agenda usa o
              expediente padrão e não será possível salvar.
            </Text>
          </View>
        ) : null}

        {/* A. Expediente semanal */}
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted">Expediente semanal</Text>
          <Pressable onPress={copyMonday} className="flex-row items-center py-1 active:opacity-60">
            <Ionicons name="copy-outline" size={14} color={colors.primaryDark} />
            <Text className="ml-1 text-[13px] font-medium text-primary-dark">Copiar segunda p/ ter–sex</Text>
          </Pressable>
        </View>

        <View className="mt-2 overflow-hidden rounded-card border border-line bg-surface">
          {WEEK_ORDER.map((dow, i) => {
            const d = drafts.find((x) => x.dayOfWeek === dow)!;
            const error = errors.get(dow);
            return (
              <View key={dow} className={`px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
                <View className="flex-row items-center">
                  <Text className="flex-1 text-[15px] font-medium text-ink">{WEEKDAYS_LONG[dow]}</Text>
                  <Text className={`mr-2 text-[13px] ${d.isOpen ? 'text-ink' : 'text-muted'}`}>
                    {d.isOpen ? 'Aberto' : 'Fechado'}
                  </Text>
                  <Toggle value={d.isOpen} onChange={(isOpen) => update(dow, { isOpen })} />
                </View>
                {d.isOpen ? (
                  <View className="mt-2">
                    <View className="flex-row gap-2">
                      <TimeBox label="Abertura" value={d.openTime} onChange={(openTime) => update(dow, { openTime })} />
                      <TimeBox
                        label="Fechamento"
                        value={d.closeTime}
                        onChange={(closeTime) => update(dow, { closeTime })}
                      />
                    </View>
                    {d.hasBreak ? (
                      <View className="mt-2 flex-row items-end gap-2">
                        <TimeBox
                          label="Pausa · início"
                          value={d.breakStart}
                          onChange={(breakStart) => update(dow, { breakStart })}
                        />
                        <TimeBox label="Pausa · fim" value={d.breakEnd} onChange={(breakEnd) => update(dow, { breakEnd })} />
                        <Pressable onPress={() => update(dow, { hasBreak: false })} hitSlop={8} className="pb-2.5">
                          <Ionicons name="close-circle" size={20} color={colors.muted} />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable onPress={() => update(dow, { hasBreak: true })} className="mt-2 self-start py-1">
                        <Text className="text-[13px] font-medium text-primary-dark">+ Intervalo de almoço/pausa</Text>
                      </Pressable>
                    )}
                    {error ? <Text className="mt-1.5 text-[12px] text-[#B2474F]">{error}</Text> : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {dirty ? (
          <View className="mt-3">
            <Button
              title={saving ? 'Salvando…' : 'Salvar expediente'}
              onPress={save}
              disabled={hasErrors || saving || !hoursAvailable}
            />
          </View>
        ) : null}

        {/* B. Folgas e feriados */}
        <SectionLabel>Folgas e feriados</SectionLabel>
        {adding ? (
          <Card>
            <RangeCalendar start={range.start} end={range.end} onChange={(start, end) => setRange({ start, end })} />
            <Text className="mt-2 text-center text-[13px] text-muted">
              {range.start
                ? range.end
                  ? `${formatDateShort(range.start)} a ${formatDateShort(range.end)}`
                  : `${formatDateShort(range.start)} · toque em outra data para um período`
                : 'Toque na data (ou no início e no fim de um período)'}
            </Text>
            <Text className="mb-1.5 mt-4 text-[13px] font-medium text-muted">Motivo (opcional)</Text>
            <View className="flex-row flex-wrap">
              {REASONS.map((r) => (
                <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
              ))}
            </View>
            <TextInput
              value={REASONS.includes(reason) ? '' : reason}
              onChangeText={setReason}
              placeholder="Ou escreva outro motivo"
              placeholderTextColor={colors.muted}
              className="mb-3 rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] text-ink"
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button title="Cancelar" variant="secondary" onPress={() => setAdding(false)} />
              </View>
              <View className="flex-1">
                <Button
                  title={savingOff ? 'Salvando…' : 'Adicionar'}
                  onPress={saveTimeOff}
                  disabled={!range.start || savingOff}
                />
              </View>
            </View>
          </Card>
        ) : (
          <Button title="Adicionar folga/feriado" icon="add" variant="secondary" onPress={() => setAdding(true)} />
        )}

        {timeOffs.length ? (
          <View className="mt-3 overflow-hidden rounded-card border border-line bg-surface">
            {timeOffs.map((b, i) => (
              <View key={b.id} className={`flex-row items-center px-4 py-3 ${i ? 'border-t border-line' : ''}`}>
                <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-soft">
                  <Ionicons name="moon-outline" size={15} color={colors.primaryDark} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[15px] font-medium text-ink">{b.reason ?? 'Folga'}</Text>
                  <Text className="text-xs text-muted">{describeOff(b.startsAt, b.endsAt)}</Text>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    confirmAction('Remover folga?', `${b.reason ?? 'Folga'} será liberada na agenda.`, () =>
                      removeBlock(b.id), 'Remover',
                    )
                  }>
                  <Ionicons name="trash-outline" size={18} color={colors.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : !adding ? (
          <EmptyState icon="calendar-outline" text="Nenhuma folga programada" />
        ) : null}
      </ScrollView>
    </HeaderKeyboardView>
  );
}
