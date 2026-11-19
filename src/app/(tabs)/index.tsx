import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { CalendarHeader, type CalendarMode } from '@/components/agenda/calendar-header';
import { DayTimeline } from '@/components/agenda/day-timeline';
import { AgendaSkeleton } from '@/components/skeleton';
import { EmptyState, Fab, Screen, ScreenTitle } from '@/components/ui';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useStore } from '@/data/store';
import { confirmAction } from '@/lib/confirm';
import { addDays, atMinutes, formatDayTitle, isSameDay, startOfDay } from '@/lib/dates';
import { describeHours, hoursForDay, isWithinHours, timeOffOn, weekRange, WEEKDAYS_LONG } from '@/lib/hours';
import { formatBRL } from '@/lib/format';
import { amountDue } from '@/lib/packages';
import { colors } from '@/theme/colors';
import type { ScheduleBlock } from '@/types';

function overlapsDay(b: ScheduleBlock, day: Date) {
  const s = startOfDay(day).getTime();
  const e = s + 86_400_000;
  return new Date(b.startsAt).getTime() < e && new Date(b.endsAt).getTime() > s;
}

export default function AgendaScreen() {
  const { appointments, blocks, clients, profile, businessHours, packages, removeBlock, loading, refresh } = useStore();
  const { refreshing, onRefresh } = usePullToRefresh(refresh);
  // ?date=YYYY-MM-DD (ex: ao tocar na notificação de agendamento online) abre a Agenda nesse dia
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const dayFromParam = (p?: string) => {
    const [y, m, d] = (p ?? '').split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : startOfDay(new Date());
  };
  const [pick, setPick] = useState(() => ({ param: dateParam, day: dayFromParam(dateParam) }));
  // Chegou uma data nova pela URL: ajusta o dia (atualização durante a renderização, sem efeito extra)
  if (pick.param !== dateParam) setPick({ param: dateParam, day: dayFromParam(dateParam) });
  const selected = pick.param !== dateParam ? dayFromParam(dateParam) : pick.day;
  const setSelected = (day: Date) => setPick({ param: dateParam, day });
  const [mode, setMode] = useState<CalendarMode>('semana');

  const clientsById = new Map(clients.map((c) => [c.id, c]));

  const counts = new Map<string, number>();
  for (const a of appointments) {
    if (a.status === 'cancelado') continue;
    const k = new Date(a.startsAt).toDateString();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const blockedDays = new Set<string>();
  for (const b of blocks) {
    if (!b.allDay) continue;
    for (let d = startOfDay(new Date(b.startsAt)); d < new Date(b.endsAt); d = new Date(d.getTime() + 86_400_000)) {
      blockedDays.add(d.toDateString());
    }
  }
  // Dias da semana fechados (ex: domingo) também aparecem riscados no calendário
  for (let i = -45; i <= 90; i++) {
    const d = addDays(startOfDay(new Date()), i);
    if (!hoursForDay(d, businessHours).isOpen) blockedDays.add(d.toDateString());
  }

  const dayAppts = appointments.filter((a) => isSameDay(new Date(a.startsAt), selected));
  const dayBlocks = blocks.filter((b) => overlapsDay(b, selected));
  const allDayBlock = dayBlocks.find((b) => b.allDay);
  const active = dayAppts.filter((a) => a.status !== 'cancelado');
  // O que o pacote já pagou na venda não entra no "previsto" do dia (só extras e deslocamento)
  const expected = active.reduce((t, a) => t + amountDue(a, packages), 0);
  const dayHours = hoursForDay(selected, businessHours);
  const dayOff = timeOffOn(selected, blocks);
  const closedDay = !dayHours.isOpen || !!dayOff;

  /** Toque num horário vazio: avisa se for fora do expediente, folga ou pausa. */
  function onPressSlot(min: number) {
    const go = (outside: boolean) =>
      router.push({
        pathname: '/agendamento/novo',
        params: { date: atMinutes(selected, min).toISOString(), ...(outside ? { fora: '1' } : {}) },
      });
    const why = dayOff
      ? `Este dia está marcado como "${dayOff.reason ?? 'Folga'}".`
      : !dayHours.isOpen
        ? `${WEEKDAYS_LONG[selected.getDay()]} está como dia fechado no seu expediente.`
        : !isWithinHours(dayHours, min, min + 30)
          ? `Esse horário está fora do expediente (${describeHours(dayHours)}).`
          : null;
    if (!why) return go(false);
    confirmAction('Fora do expediente', `${why} Quer agendar mesmo assim?`, () => go(true), 'Agendar assim mesmo');
  }

  function onPressBlock(b: ScheduleBlock) {
    confirmAction('Remover bloqueio?', `${b.reason ?? 'Bloqueio'} será liberado na agenda.`, () =>
      removeBlock(b.id), 'Remover',
    );
  }

  return (
    <Screen>
      <ScreenTitle
        subtitle={profile.businessName}
        title="Agenda"
        right={
          <Pressable
            onPress={() => {
              setSelected(startOfDay(new Date()));
            }}
            className="rounded-full border border-line bg-surface px-3.5 py-1.5">
            <Text className="text-[13px] font-semibold text-ink">Hoje</Text>
          </Pressable>
        }
      />

      {loading ? (
        <AgendaSkeleton />
      ) : (
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
        <CalendarHeader
          mode={mode}
          onModeChange={setMode}
          selected={selected}
          onSelect={(d) => setSelected(startOfDay(d))}
          counts={counts}
          blockedDays={blockedDays}
        />

        <View className="mx-5 mb-1 mt-5 flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-semibold text-ink">{formatDayTitle(selected)}</Text>
            <Text className="text-[13px] text-muted">
              {active.length} {active.length === 1 ? 'atendimento' : 'atendimentos'} · {formatBRL(expected)} previsto
            </Text>
          </View>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/bloqueio/novo', params: { date: selected.toISOString() } })
            }
            className="flex-row items-center rounded-full border border-line bg-surface px-3 py-1.5">
            <Ionicons name="lock-closed-outline" size={14} color={colors.ink} />
            <Text className="ml-1 text-[13px] font-medium text-ink">Bloquear</Text>
          </Pressable>
        </View>

        {allDayBlock ? (
          <Pressable
            onPress={() => onPressBlock(allDayBlock)}
            className="mx-4 mt-3 flex-row items-center rounded-card border border-dashed border-[#D9D1CF] bg-[#F3EFED] px-4 py-3">
            <Ionicons name="moon-outline" size={18} color={colors.muted} />
            <View className="ml-2 flex-1">
              <Text className="text-[14px] font-semibold text-ink">{allDayBlock.reason ?? 'Dia bloqueado'}</Text>
              <Text className="text-xs text-muted">Dia inteiro sem atendimentos · toque para liberar</Text>
            </View>
          </Pressable>
        ) : !dayHours.isOpen ? (
          <Pressable
            onPress={() => router.push('/ajustes/horarios')}
            className="mx-4 mt-3 flex-row items-center rounded-card border border-dashed border-[#D9D1CF] bg-[#F3EFED] px-4 py-3">
            <Ionicons name="storefront-outline" size={18} color={colors.muted} />
            <View className="ml-2 flex-1">
              <Text className="text-[14px] font-semibold text-ink">Estúdio fechado</Text>
              <Text className="text-xs text-muted">Dia fora do expediente semanal · toque para ajustar</Text>
            </View>
          </Pressable>
        ) : active.length === 0 ? (
          <EmptyState
            compact
            icon="calendar-clear-outline"
            text={isSameDay(selected, new Date()) ? 'Nenhum horário marcado para hoje' : 'Nenhum horário marcado neste dia'}
            subtitle="Toque num horário livre abaixo ou crie um agendamento."
            actionLabel="+ Novo agendamento"
            onAction={() => router.push({ pathname: '/agendamento/novo', params: { date: selected.toISOString() } })}
          />
        ) : null}

        <DayTimeline
          day={selected}
          hours={dayHours}
          closed={closedDay}
          fallbackRange={weekRange(businessHours)}
          appointments={dayAppts}
          blocks={dayBlocks}
          clientsById={clientsById}
          onPressAppointment={(a) => router.push({ pathname: '/agendamento/[id]', params: { id: a.id } })}
          onPressBlock={onPressBlock}
          onPressSlot={onPressSlot}
          travelBufferMinutes={profile.travelBufferMinutes}
        />
      </ScrollView>
      )}

      <Fab
        onPress={() =>
          router.push({ pathname: '/agendamento/novo', params: { date: selected.toISOString() } })
        }
      />
    </Screen>
  );
}
