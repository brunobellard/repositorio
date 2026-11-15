import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NO_REPEAT, RecurrencePicker } from '@/components/agenda/recurrence-picker';
import { SeriesScopeSheet, Sheet, SheetOption } from '@/components/sheet';
import { Avatar, Button, Chip, Field, SectionLabel } from '@/components/ui';
import { useStore } from '@/data/store';
import { closeModal, notify } from '@/lib/confirm';
import {
  generateOccurrences,
  hasOpenSiblings,
  type RecurrenceRule,
  type SeriesScope,
  seriesTargets,
  slotConflict,
  summarize,
  toRRule,
} from '@/lib/recurrence';
import { availableCredits, usablePackages } from '@/lib/packages';
import {
  addDays,
  atMinutes,
  formatDateShort,
  formatDuration,
  formatTime,
  hmToMinutes,
  isSameDay,
  minutesOfDay,
  startOfDay,
  WEEKDAYS_SHORT,
} from '@/lib/dates';
import { formatBRL, formatPhone, normalize } from '@/lib/format';
import { hoursForDay, isWithinHours, timeOffOn, WEEKDAYS_LONG } from '@/lib/hours';
import { colors } from '@/theme/colors';

export default function NovoAgendamento() {
  const params = useLocalSearchParams<{ date?: string; clientId?: string; fora?: string; editId?: string }>();
  const insets = useSafeAreaInsets();
  const {
    clients,
    services: allServices,
    appointments,
    blocks,
    profile,
    businessHours,
    addAppointment,
    addClient,
    updateAppointments,
    packages,
    online,
  } = useStore();

  // Modo edição: a mesma tela, já preenchida com o agendamento existente
  const editing = appointments.find((a) => a.id === params.editId);
  const editStart = editing ? new Date(editing.startsAt) : null;
  const editServiceIds = editing?.services.map((s) => s.serviceId) ?? [];
  // Na edição, serviços desativados que já estavam no agendamento continuam aparecendo
  const services = allServices.filter((s) => s.active || editServiceIds.includes(s.id));

  const initial = editStart ?? (params.date ? new Date(params.date) : new Date());
  const initialHasTime = !!editStart || (!!params.date && minutesOfDay(initial) !== 0);
  const initialOutside =
    !!editStart &&
    !isWithinHours(
      hoursForDay(editStart, businessHours),
      minutesOfDay(editStart),
      minutesOfDay(new Date(editing!.endsAt)),
    );

  // Veio de um toque fora do expediente já confirmado na agenda
  const [override, setOverride] = useState(params.fora === '1' || initialOutside);
  const [clientId, setClientId] = useState<string | undefined>(editing?.clientId ?? params.clientId);
  const [query, setQuery] = useState('');
  const [newClient, setNewClient] = useState<{ name: string; whatsapp: string } | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>(editServiceIds);
  const [day, setDay] = useState(startOfDay(initial));
  const [time, setTime] = useState<number | null>(initialHasTime ? minutesOfDay(initial) : null);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [rule, setRule] = useState<RecurrenceRule>(NO_REPEAT);
  const [conflicts, setConflicts] = useState<{ date: Date; reason: string }[] | null>(null);
  const [askScope, setAskScope] = useState(false);
  const [packageId, setPackageId] = useState<string | null>(null);
  const dayStrip = useRef<ComponentRef<typeof ScrollView>>(null);
  const dayStripPositioned = useRef(false);

  const client = clients.find((c) => c.id === clientId);
  const selectedServices = serviceIds.map((id) => services.find((s) => s.id === id)!).filter(Boolean);
  const duration = selectedServices.reduce((t, s) => t + s.durationMin, 0);
  const total = selectedServices.reduce((t, s) => t + s.price, 0);

  const q = normalize(query);
  const qDigits = query.replace(/\D/g, '');
  const matches = clients
    .filter((c) => !q || normalize(c.name).includes(q) || (qDigits && c.whatsapp?.includes(qDigits)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, q ? 20 : 8);

  const categories = [...new Set(services.map((s) => s.category))];

  // Horários livres no dia escolhido, seguindo o expediente (Ajustes > Horário de funcionamento)
  const slot = profile.slotMinutes;
  const dayHours = hoursForDay(day, businessHours);
  const dayOff = timeOffOn(day, blocks);
  const closedReason = dayOff
    ? `${formatDateShort(day)} está marcado como "${dayOff.reason ?? 'Folga'}".`
    : !dayHours.isOpen
      ? `O estúdio não abre ${WEEKDAYS_LONG[day.getDay()].toLowerCase()}.`
      : null;
  // "Fora do expediente": mostra o dia todo, só respeitando outros agendamentos
  const ignoreHours = override;
  const [workStart, workEnd] = ignoreHours
    ? [7 * 60, 22 * 60]
    : dayHours.isOpen
      ? [hmToMinutes(dayHours.openTime), hmToMinutes(dayHours.closeTime)]
      : [0, 0];
  const busy = [
    ...appointments
      .filter((a) => a.status !== 'cancelado' && a.id !== editing?.id && isSameDay(new Date(a.startsAt), day))
      .map((a) => [minutesOfDay(new Date(a.startsAt)), minutesOfDay(new Date(a.endsAt))]),
    ...blocks
      .filter((b) => {
        const s = day.getTime();
        return new Date(b.startsAt).getTime() < s + 86_400_000 && new Date(b.endsAt).getTime() > s;
      })
      .filter((b) => !(ignoreHours && b.allDay))
      .map((b) => (b.allDay ? [0, 24 * 60] : [minutesOfDay(new Date(b.startsAt)), minutesOfDay(new Date(b.endsAt))])),
  ];
  const need = Math.max(duration, slot);
  const now = new Date();
  const slots: { min: number; free: boolean }[] = [];
  for (let m = workStart; m + slot <= workEnd; m += slot) {
    const past = isSameDay(day, now) && m < minutesOfDay(now);
    const conflict = busy.some(([s, e]) => m < e && m + need > s);
    // O atendimento inteiro precisa caber no expediente (sem atravessar a pausa)
    const fits = ignoreHours ? m + need <= workEnd : isWithinHours(dayHours, m, m + need);
    slots.push({ min: m, free: !past && !conflict && fits });
  }
  const endTime = time !== null && duration ? formatTime(atMinutes(day, time + duration)) : null;
  // Horário vindo do toque na agenda ainda é válido?
  const timeValid = time !== null && slots.some((s) => s.min === time && s.free);

  // Faixa de datas: de hoje até pelo menos 3 semanas (ou até a data da sessão editada)
  const today = startOfDay(new Date());
  const daysAhead = Math.max(21, Math.round((day.getTime() - today.getTime()) / 86_400_000) + 8);
  const days = Array.from({ length: daysAhead }, (_, i) => addDays(today, i));

  // Datas da série (a primeira é o horário escolhido)
  const firstStart = time !== null ? atMinutes(day, time) : null;
  const occurrences = firstStart && !editing ? generateOccurrences(firstStart, rule) : [];

  function toggleService(id: string) {
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function saveNewClient() {
    if (!newClient?.name.trim() || saving) return;
    setSaving(true);
    const c = await addClient({
      name: newClient.name.trim(),
      whatsapp: newClient.whatsapp.replace(/\D/g, '') || undefined,
    });
    setSaving(false);
    if (!c) return;
    setClientId(c.id);
    setNewClient(null);
    setQuery('');
  }

  // Pacotes pré-pagos da cliente que cobrem um dos serviços escolhidos (só ao criar)
  const usable = editing ? [] : usablePackages(clientId, serviceIds, packages, appointments);
  const chosenPackage = usable.find((p) => p.id === packageId);
  const sessionsNeeded = Math.max(1, occurrences.length);
  const packageShort = chosenPackage ? availableCredits(chosenPackage, appointments) < sessionsNeeded : false;

  const canSave = !!client && selectedServices.length > 0 && timeValid && !packageShort && !saving;

  /** Cria as sessões informadas (todas ou só as livres, depois do aviso de conflito). */
  async function create(dates: Date[]) {
    setConflicts(null);
    setSaving(true);
    const created = await addAppointment({
      clientId: client!.id,
      startsAt: dates[0].toISOString(),
      serviceIds,
      notes: notes.trim() || undefined,
      occurrences: dates.map((d) => d.toISOString()),
      clientPackageId: chosenPackage?.id,
      recurrenceRule: dates.length > 1 && firstStart ? toRRule(firstStart, rule) : null,
    });
    setSaving(false);
    if (!created) return;
    if (created > 1) notify('Série criada', `${created} agendamentos foram adicionados à agenda.`);
    else if (online) notify('Agendamento salvo'); // offline, o próprio store já avisa que ficou no aparelho
    closeModal();
  }

  /** Edição: aplica a mudança na sessão (ou nas sessões) escolhida(s). */
  async function applyEdit(scope: SeriesScope) {
    setAskScope(false);
    if (!editing || !firstStart) return;
    setSaving(true);
    const servicesChanged = serviceIds.join() !== editServiceIds.join();
    const ok = await updateAppointments(
      editing.id,
      seriesTargets(editing, appointments, scope),
      {
        shiftMs: firstStart.getTime() - editStart!.getTime(),
        serviceIds: servicesChanged ? serviceIds : undefined,
        notes: notes.trim() !== (editing.notes ?? '') ? notes.trim() : undefined,
      },
      scope,
    );
    setSaving(false);
    if (ok) closeModal();
  }

  async function save() {
    if (!canSave || !firstStart) return;
    if (editing) {
      const changedTimeOrServices =
        firstStart.getTime() !== editStart!.getTime() || serviceIds.join() !== editServiceIds.join();
      // Em série, pergunta se vale só para esta sessão ou para as próximas também
      if (changedTimeOrServices && hasOpenSiblings(editing, appointments)) setAskScope(true);
      else await applyEdit('one');
      return;
    }
    // Confere todas as datas futuras da série antes de criar
    const ctx = { appointments, blocks, businessHours, ignoreHours: override };
    const found = occurrences
      .slice(1)
      .map((date) => ({ date, reason: slotConflict(date, duration, ctx) }))
      .filter((c): c is { date: Date; reason: string } => !!c.reason);
    if (found.length) setConflicts(found);
    else await create(occurrences);
  }

  return (
    <View className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        {/* 1. Cliente */}
        <SectionLabel>Cliente</SectionLabel>
        {client ? (
          <Pressable
            onPress={() => setClientId(undefined)}
            disabled={!!editing}
            className="flex-row items-center rounded-card border border-primary bg-primary-soft p-3">
            <Avatar name={client.name} />
            <View className="ml-3 flex-1">
              <Text className="text-[15px] font-semibold text-ink">{client.name}</Text>
              <Text className="text-xs text-muted">{formatPhone(client.whatsapp)}</Text>
            </View>
            {!editing ? <Text className="text-[13px] font-medium text-primary-dark">Trocar</Text> : null}
          </Pressable>
        ) : newClient ? (
          <View className="rounded-card border border-line bg-surface p-4">
            <Field
              label="Nome"
              value={newClient.name}
              onChangeText={(name) => setNewClient({ ...newClient, name })}
              placeholder="Nome da cliente"
              autoFocus
            />
            <Field
              label="WhatsApp"
              value={newClient.whatsapp}
              onChangeText={(whatsapp) => setNewClient({ ...newClient, whatsapp })}
              placeholder="(11) 90000-0000"
              keyboardType="phone-pad"
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button title="Cancelar" variant="secondary" onPress={() => setNewClient(null)} />
              </View>
              <View className="flex-1">
                <Button title="Salvar" onPress={saveNewClient} disabled={!newClient.name.trim()} />
              </View>
            </View>
          </View>
        ) : (
          <View>
            <View className="mb-2 flex-row items-center rounded-2xl border border-line bg-surface px-3">
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar por nome ou telefone"
                placeholderTextColor={colors.muted}
                className="flex-1 px-2 py-3 text-[15px] text-ink"
              />
            </View>
            <View className="overflow-hidden rounded-card border border-line bg-surface">
              {matches.map((c, i) => (
                <Pressable
                  key={c.id}
                  onPress={() => setClientId(c.id)}
                  className={`flex-row items-center px-3 py-2.5 active:bg-bg ${i ? 'border-t border-line' : ''}`}>
                  <Avatar name={c.name} size={32} />
                  <Text className="ml-3 flex-1 text-[15px] text-ink">{c.name}</Text>
                  <Text className="text-xs text-muted">{formatPhone(c.whatsapp)}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setNewClient({ name: query, whatsapp: '' })}
                className="flex-row items-center border-t border-line px-3 py-3 active:bg-bg">
                <Ionicons name="person-add-outline" size={18} color={colors.primaryDark} />
                <Text className="ml-2 text-[15px] font-medium text-primary-dark">Nova cliente</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* 2. Serviços */}
        <SectionLabel>Serviços</SectionLabel>
        {categories.map((cat) => (
          <View key={cat} className="mb-1">
            <Text className="mb-1.5 text-[13px] font-medium text-ink">{cat}</Text>
            <View className="flex-row flex-wrap">
              {services
                .filter((s) => s.category === cat)
                .map((s) => (
                  <Chip
                    key={s.id}
                    label={s.name}
                    sublabel={`${formatBRL(s.price)} · ${formatDuration(s.durationMin)}`}
                    selected={serviceIds.includes(s.id)}
                    onPress={() => toggleService(s.id)}
                  />
                ))}
            </View>
          </View>
        ))}

        {/* 3. Data */}
        <SectionLabel>Data</SectionLabel>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5 px-5"
          ref={dayStrip}
          // Já abre mostrando o dia escolhido (cada dia ocupa 64px: 56 + margem 8)
          onContentSizeChange={() => {
            if (dayStripPositioned.current) return;
            dayStripPositioned.current = true;
            const i = days.findIndex((d) => isSameDay(d, day));
            if (i > 3) dayStrip.current?.scrollTo({ x: (i - 2) * 64, animated: false });
          }}>
          {days.map((d) => {
            const sel = isSameDay(d, day);
            return (
              <Pressable
                key={d.toDateString()}
                onPress={() => {
                  setDay(d);
                  setTime(null);
                }}
                className={`mr-2 w-14 items-center rounded-2xl border py-2 ${
                  sel ? 'border-primary bg-primary' : 'border-line bg-surface'
                }`}>
                <Text className={`text-[11px] ${sel ? 'text-white' : 'text-muted'}`}>{WEEKDAYS_SHORT[d.getDay()]}</Text>
                <Text className={`text-lg font-semibold ${sel ? 'text-white' : 'text-ink'}`}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
          <View className="w-8" />
        </ScrollView>

        {/* 4. Horário */}
        <SectionLabel>
          Horário {duration ? `· duração ${formatDuration(duration)}` : ''}
        </SectionLabel>
        {closedReason || override ? (
          <View className="mb-3 flex-row items-start rounded-2xl bg-[#FBF3E4] p-3">
            <Ionicons name="alert-circle-outline" size={18} color="#8A6420" />
            <View className="ml-2 flex-1">
              <Text className="text-[13px] leading-5 text-[#8A6420]">
                {override
                  ? 'Mostrando horários fora do expediente.'
                  : `${closedReason} Para atender mesmo assim, libere os horários.`}
              </Text>
              <Pressable onPress={() => { setOverride(!override); setTime(null); }} className="mt-1 self-start py-1">
                <Text className="text-[13px] font-semibold text-[#8A6420] underline">
                  {override ? 'Voltar ao expediente normal' : 'Agendar fora do expediente'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {slots.some((s) => s.free) ? (
          <View className="flex-row flex-wrap">
            {slots.map((s) => {
              const sel = time === s.min && s.free;
              return (
                <Pressable
                  key={s.min}
                  disabled={!s.free}
                  onPress={() => setTime(s.min)}
                  className={`mb-2 mr-2 w-[72px] items-center rounded-xl border py-2 ${
                    sel ? 'border-primary bg-primary' : s.free ? 'border-line bg-surface' : 'border-transparent bg-transparent'
                  }`}>
                  <Text
                    className={`text-[14px] font-medium ${
                      sel ? 'text-white' : s.free ? 'text-ink' : 'text-line line-through'
                    }`}>
                    {formatTime(atMinutes(day, s.min))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : closedReason && !override ? null : (
          <Text className="text-sm text-muted">Nenhum horário livre neste dia.</Text>
        )}
        {timeValid && endTime ? (
          <Text className="mt-1 text-[13px] text-muted">
            Das {formatTime(atMinutes(day, time!))} às {endTime} (término calculado pela duração dos serviços)
          </Text>
        ) : null}

        {/* Crédito de pacote pré-pago */}
        {usable.map((p) => {
          const on = packageId === p.id;
          const left = p.totalSessions - p.usedSessions;
          const credits = availableCredits(p, appointments);
          return (
            <Pressable
              key={p.id}
              onPress={() => setPackageId(on ? null : p.id)}
              className={`mt-4 flex-row items-center rounded-card border px-4 py-3 ${
                on ? 'border-primary bg-primary-soft' : 'border-dashed border-primary/50 bg-surface'
              }`}>
              <Ionicons
                name={on ? 'checkmark-circle' : 'ticket-outline'}
                size={20}
                color={colors.primaryDark}
              />
              <View className="ml-3 flex-1">
                <Text className="text-[14px] font-semibold text-primary-dark">Usar crédito do pacote</Text>
                <Text className="text-xs text-muted">
                  {p.name} · Restam {left} de {p.totalSessions} sessões
                  {credits < left ? ` (${left - credits} já agendada${left - credits > 1 ? 's' : ''})` : ''}
                </Text>
                {on && packageShort ? (
                  <Text className="mt-1 text-xs text-[#B2474F]">
                    O pacote cobre só {credits} {credits === 1 ? 'sessão' : 'sessões'}; reduza a repetição para{' '}
                    {credits}.
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}

        {/* 5. Repetir (só ao criar) */}
        {!editing ? (
          <>
            <SectionLabel>Repetir agendamento</SectionLabel>
            <RecurrencePicker start={firstStart ?? atMinutes(day, 9 * 60)} value={rule} onChange={setRule} />
            {rule.freq !== 'none' ? (
              <Text className="mt-2 text-[13px] leading-5 text-muted">
                {firstStart ? summarize(occurrences, rule) : 'Escolha o horário para ver as datas da série.'}
              </Text>
            ) : null}
          </>
        ) : editing.recurrenceGroupId ? (
          <View className="mt-4 flex-row items-center rounded-2xl bg-primary-soft px-3 py-2.5">
            <Ionicons name="repeat" size={16} color={colors.primaryDark} />
            <Text className="ml-2 flex-1 text-[13px] text-primary-dark">
              Faz parte de uma série. Ao salvar, você escolhe se a mudança vale só para esta sessão ou para as
              próximas.
            </Text>
          </View>
        ) : null}

        {/* 6. Observações */}
        <SectionLabel>Observações</SectionLabel>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Ex: trazer referência da nail art"
          placeholderTextColor={colors.muted}
          multiline
          className="min-h-[80px] rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink"
          style={{ textAlignVertical: 'top' }}
        />
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="mb-2 flex-row justify-between">
          <Text className="text-[13px] text-muted">
            {selectedServices.length} {selectedServices.length === 1 ? 'serviço' : 'serviços'}
            {duration ? ` · ${formatDuration(duration)}` : ''}
          </Text>
          <Text className="text-[15px] font-semibold text-ink">
            {chosenPackage ? 'Pago com pacote' : formatBRL(total)}
          </Text>
        </View>
        <Button
          title={
            saving
              ? 'Salvando…'
              : editing
                ? 'Salvar alterações'
                : occurrences.length > 1
                  ? `Agendar ${occurrences.length} sessões`
                  : 'Agendar'
          }
          onPress={save}
          disabled={!canSave}
        />
      </View>

      {editing ? <Stack.Screen options={{ title: 'Editar agendamento' }} /> : null}

      {/* Datas da série com conflito */}
      <Sheet
        visible={!!conflicts}
        onClose={() => setConflicts(null)}
        title={`${conflicts?.length ?? 0} ${conflicts?.length === 1 ? 'data tem' : 'datas têm'} conflito`}
        subtitle="Estas sessões da série caem em folga, fora do expediente ou em horário ocupado:">
        <ScrollView style={{ maxHeight: 220 }} className="mb-3 rounded-2xl bg-bg px-4 py-2">
          {conflicts?.map((c) => (
            <View key={c.date.toISOString()} className="flex-row justify-between py-1.5">
              <Text className="text-[14px] text-ink">
                {WEEKDAYS_SHORT[c.date.getDay()]}, {formatDateShort(c.date)} · {formatTime(c.date)}
              </Text>
              <Text className="text-[13px] text-muted">{c.reason}</Text>
            </View>
          ))}
        </ScrollView>
        {conflicts && occurrences.length - conflicts.length > 0 ? (
          <SheetOption
            icon="play-skip-forward-outline"
            label="Pular datas com conflito e agendar as livres"
            detail={`${occurrences.length - conflicts.length} de ${occurrences.length} sessões serão criadas`}
            onPress={() => {
              const bad = new Set(conflicts.map((c) => c.date.getTime()));
              create(occurrences.filter((d) => !bad.has(d.getTime())));
            }}
          />
        ) : null}
        <SheetOption icon="arrow-back-outline" label="Voltar e ajustar horário" onPress={() => setConflicts(null)} />
      </Sheet>

      {editing ? (
        <SeriesScopeSheet
          visible={askScope}
          action="editar"
          counts={{
            one: 1,
            following: seriesTargets(editing, appointments, 'following').length,
            all: seriesTargets(editing, appointments, 'all').length,
          }}
          onChoose={applyEdit}
          onClose={() => setAskScope(false)}
        />
      ) : null}
    </View>
  );
}
