import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NO_REPEAT, RecurrencePicker } from '@/components/agenda/recurrence-picker';
import { SeriesScopeSheet, Sheet, SheetOption } from '@/components/sheet';
import { AddressFields, findArea } from '@/components/address-fields';
import { RangeCalendar } from '@/components/range-calendar';
import { track } from '@/lib/analytics';
import { Avatar, Button, Chip, Field, SectionLabel, Segmented } from '@/components/ui';
import { useStore } from '@/data/store';
import { closeModal, confirmAction, notify } from '@/lib/confirm';
import {
  busyEndMs,
  generateOccurrences,
  hasOpenSiblings,
  type RecurrenceRule,
  type SeriesScope,
  seriesTargets,
  slotConflict,
  summarize,
  toRRule,
} from '@/lib/recurrence';
import { availableCredits, coversPackage, usablePackages } from '@/lib/packages';
import { openUpgrade, requireFeature } from '@/lib/upgrade';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import {
  addDays,
  atMinutes,
  formatDateShort,
  formatDayTitle,
  formatDuration,
  formatTime,
  hmToMinutes,
  isSameDay,
  minutesOfDay,
  startOfDay,
  WEEKDAYS_SHORT,
} from '@/lib/dates';
import { formatBRL, formatPhone, isValidPhone, maskPhone, normalize } from '@/lib/format';
import { hoursForDay, isWithinOpenHours, overlapsBreak, timeOffOn, WEEKDAYS_LONG } from '@/lib/hours';
import { colors } from '@/theme/colors';
import type { LocationType } from '@/types';

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
    extendIntoSeries,
    packages,
    online,
    serviceAreas,
    updateClientAddress,
  } = useStore();
  const access = usePlanAccess();

  // Modo edição: a mesma tela, já preenchida com o agendamento existente
  const editing = appointments.find((a) => a.id === params.editId);
  const editStart = editing ? new Date(editing.startsAt) : null;
  const editServiceIds = editing?.services.map((s) => s.serviceId) ?? [];
  // Na edição, serviços desativados que já estavam no agendamento continuam aparecendo
  const services = allServices.filter((s) => s.active || editServiceIds.includes(s.id));

  const initial = editStart ?? (params.date ? new Date(params.date) : new Date());
  const initialHasTime = !!editStart || (!!params.date && minutesOfDay(initial) !== 0);
  // Na pausa (almoço) não conta como fora do expediente: a pausa só pede confirmação
  const initialOutside =
    !!editStart &&
    !isWithinOpenHours(
      hoursForDay(editStart, businessHours),
      minutesOfDay(editStart),
      minutesOfDay(new Date(editing!.endsAt)),
    );

  // Veio de um toque fora do expediente já confirmado na agenda
  const [override, setOverride] = useState(params.fora === '1' || initialOutside);
  function toggleOverride() {
    setOverride(!override);
    setTime(null);
  }
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
  const [pickDate, setPickDate] = useState(false);
  // Atendimento a domicílio (modelos "A domicílio" e "Híbrido")
  const canHome = access.serviceMode !== 'fixed';
  const [locationType, setLocationType] = useState<LocationType>(
    editing?.locationType ?? (access.serviceMode === 'home_service' ? 'home_service' : 'fixed'),
  );
  // Endereço digitado nesta tela; sem edição, vale o da ficha da cliente escolhida
  const [addressDraft, setAddressDraft] = useState<{ clientId?: string; address: string; neighborhood: string } | null>(
    null,
  );
  // Trava imediata contra toque duplo no salvar (o estado `saving` só muda no próximo desenho da tela,
  // e um segundo toque antes disso movia o horário duas vezes ou criava o agendamento em dobro)
  const submitting = useRef(false);
  // Medição do formulário (sem dados da cliente): de onde veio, quanto tempo levou, o que faltou
  const formOrigin = editing ? 'edit' : params.clientId ? 'client_file' : initialHasTime ? 'slot' : params.date ? 'agenda' : 'other';
  const tracking = useRef({ origin: formOrigin, openedAt: 0, saved: false, inlineClient: false, client: false, service: false, time: false });
  const dayStrip = useRef<ComponentRef<typeof ScrollView>>(null);
  const navigation = useNavigation();

  useEffect(() => {
    const t = tracking.current;
    t.openedAt = Date.now();
    track('appointment_form_opened', { origin: t.origin });
    return () => {
      if (t.saved) return;
      track('appointment_form_abandoned', {
        origin: t.origin,
        duration_ms: Date.now() - t.openedAt,
        has_client: t.client,
        has_service: t.service,
        has_time: t.time,
      });
    };
  }, []);
  // O que já foi preenchido (lido só ao sair da tela)
  useEffect(() => {
    tracking.current.client = !!clientId;
    tracking.current.service = serviceIds.length > 0;
    tracking.current.time = time !== null;
  });

  /** Fecha e, se veio da Agenda, abre a Agenda no dia do agendamento salvo (UX-17). */
  function closeToDay(d: Date | null) {
    const state = navigation.getState();
    const prev = state ? state.routes[state.index - 1] : undefined;
    if (d && prev?.name === '(tabs)') {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      router.dismissTo({ pathname: '/', params: { date: key } });
      return;
    }
    closeModal();
  }
  // Rolar até a seção que falta preencher (UX-03): posição de cada título de seção
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const sectionY = useRef<Record<string, number>>({});
  const dayStripPositioned = useRef(false);
  // Dia escolhido pelo calendário: a faixa cresce até ele, e só então dá para rolar (UX-05)
  const dayStripTarget = useRef<number | null>(null);

  const client = clients.find((c) => c.id === clientId);
  const selectedServices = serviceIds.map((id) => services.find((s) => s.id === id)!).filter(Boolean);
  const duration = selectedServices.reduce((t, s) => t + s.durationMin, 0);
  const home = canHome && !editing && locationType === 'home_service';
  const draftValid = addressDraft && addressDraft.clientId === clientId;
  const address = draftValid ? addressDraft.address : (client?.address ?? '');
  const neighborhood = draftValid ? addressDraft.neighborhood : (client?.neighborhood ?? '');
  const setAddress = (patch: Partial<{ address: string; neighborhood: string }>) =>
    setAddressDraft({ clientId, address, neighborhood, ...patch });
  const area = home ? findArea(serviceAreas, neighborhood) : undefined;
  const travelFee = home ? (area?.travelFee ?? 0) : 0;
  const addressOk = !home || address.trim().length >= 5;
  const buffer = profile.travelBufferMinutes;
  // Reserva o deslocamento depois deste atendimento: ao criar a domicílio, ou ao editar um que já é a domicílio
  const needsTravel = editing ? editing.locationType === 'home_service' : home;
  const total = selectedServices.reduce((t, s) => t + s.price, 0) + travelFee;

  const q = normalize(query);
  const qDigits = query.replace(/\D/g, '');
  const matches = clients
    .filter((c) => !c.removed)
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
  const need = Math.max(duration, slot);
  const now = new Date();
  /** Horários de um dia, livres ou não. ignoreHours = "fora do expediente" (dia todo). */
  function slotsFor(d: Date, ignoreHours: boolean): { min: number; free: boolean; inBreak: boolean }[] {
    const dh = hoursForDay(d, businessHours);
    // "Fora do expediente": mostra o dia todo (00:00 até o último horário antes da meia-noite),
    // só respeitando outros agendamentos; o atendimento pode terminar no dia seguinte (BUG-015)
    const [workStart, workEnd] = ignoreHours
      ? [0, 24 * 60]
      : dh.isOpen
        ? [hmToMinutes(dh.openTime), hmToMinutes(dh.closeTime)]
        : [0, 0];
    // Minutos contados a partir da meia-noite do dia escolhido (podem ser negativos ou passar de 24h):
    // um atendimento ou bloqueio que atravessa a meia-noite ocupa o fim de um dia e o começo do outro
    const dayStartMs = d.getTime();
    const nextDayMs = addDays(d, 1).getTime();
    const toDayMin = (ms: number) => (ms - dayStartMs) / 60_000;
    const busy = [
      ...appointments
        .filter((a) => a.status !== 'cancelado' && a.id !== editing?.id)
        // Atendimento em domicílio ocupa também o deslocamento depois dele (o gravado quando foi marcado)
        .map((a) => [toDayMin(new Date(a.startsAt).getTime()), toDayMin(busyEndMs(a, buffer))])
        // Inclui o começo do dia seguinte: um atendimento que atravessa a meia-noite não pode encostar nele
        .filter(([s, e]) => s < 48 * 60 && e > 0),
      ...blocks
        .filter((b) => b.allDay
          ? new Date(b.startsAt).getTime() < nextDayMs && new Date(b.endsAt).getTime() > dayStartMs
          : new Date(b.startsAt).getTime() < nextDayMs + 86_400_000 && new Date(b.endsAt).getTime() > dayStartMs)
        .filter((b) => !(ignoreHours && b.allDay))
        .map((b) =>
          b.allDay ? [0, 24 * 60] : [toDayMin(new Date(b.startsAt).getTime()), toDayMin(new Date(b.endsAt).getTime())],
        ),
    ];
    // Na edição, o horário original continua disponível mesmo se já começou (ex: trocar serviços durante o atendimento)
    const originalMin = editStart && isSameDay(d, editStart) ? minutesOfDay(editStart) : null;
    const gridMins: number[] = [];
    for (let m = workStart; m + slot <= workEnd; m += slot) gridMins.push(m);
    if (originalMin !== null && !gridMins.includes(originalMin)) gridMins.push(originalMin);
    gridMins.sort((a, b) => a - b);
    const list: { min: number; free: boolean; inBreak: boolean }[] = [];
    for (const m of gridMins) {
      const past = isSameDay(d, now) && m < minutesOfDay(now) && m !== originalMin;
      // Indo à casa da cliente, o deslocamento depois também precisa estar livre
      const conflict = busy.some(([s, e]) => m < e && m + need + (needsTravel ? buffer : 0) > s);
      // O atendimento inteiro precisa caber entre a abertura e o fechamento.
      // A pausa (almoço) não trava: o horário fica livre e pede confirmação ao escolher.
      const fits = ignoreHours || isWithinOpenHours(dh, m, m + need);
      const inBreak = !ignoreHours && overlapsBreak(dh, m, m + need);
      list.push({ min: m, free: !past && !conflict && fits, inBreak });
    }
    return list;
  }
  const slots = slotsFor(day, override);
  // Dia sem vaga: procura o próximo horário livre nos próximos 30 dias, no expediente (UX-06)
  const nextFree = (() => {
    if (override || !duration || slots.some((x) => x.free)) return null;
    for (let i = 1; i <= 30; i++) {
      const d = addDays(day, i);
      // A sugestão automática evita a pausa
      const free = slotsFor(d, false).find((x) => x.free && !x.inBreak);
      if (free) return { day: d, min: free.min };
    }
    return null;
  })();
  const endTime =
    time !== null && duration
      ? `${formatTime(atMinutes(day, time + duration))}${time + duration > 24 * 60 ? ' do dia seguinte' : ''}`
      : null;
  /** Escolhe um horário; se cair na pausa (almoço), pergunta antes. */
  function pickTime(s: { min: number; inBreak: boolean }) {
    if (!s.inBreak) return setTime(s.min);
    confirmAction(
      'Horário na sua pausa',
      `Esse atendimento cai na sua pausa (${dayHours.breakStart}–${dayHours.breakEnd}). Quer agendar mesmo assim?`,
      () => setTime(s.min),
      'Agendar assim mesmo',
    );
  }
  // Horário vindo do toque na agenda ainda é válido?
  const timeValid = time !== null && slots.some((s) => s.min === time && s.free);

  // Faixa de datas: de hoje até pelo menos 3 semanas (ou até a data da sessão editada)
  const today = startOfDay(new Date());
  const daysAhead = Math.max(21, Math.round((day.getTime() - today.getTime()) / 86_400_000) + 8);
  const days = Array.from({ length: daysAhead }, (_, i) => addDays(today, i));

  /** Escolhe um dia (calendário ou "próximo livre") e mostra-o na faixa de datas. */
  function goToDay(d: Date, min: number | null = null) {
    const target = startOfDay(d);
    setDay(target);
    setTime(min);
    setPickDate(false);
    const i = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    const x = Math.max(0, (i - 2) * 64);
    // Se a faixa crescer, onContentSizeChange rola depois; se não, este rolar já basta
    dayStripTarget.current = x;
    setTimeout(() => dayStrip.current?.scrollTo({ x, animated: true }), 50);
  }

  // Datas da série (a primeira é o horário escolhido)
  const firstStart = time !== null ? atMinutes(day, time) : null;
  // Na edição, um agendamento avulso (fora de série, ainda não concluído) também pode passar a repetir
  const canRepeatEdit = !!editing && !editing.recurrenceGroupId && editing.status !== 'concluido' && editing.status !== 'cancelado';
  const occurrences = firstStart && (!editing || canRepeatEdit) ? generateOccurrences(firstStart, rule) : [];

  function toggleService(id: string) {
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  // Nova cliente criada aqui segue as regras do cadastro completo (UX-13): nome com 2+ letras, WhatsApp com DDD
  const newClientNameOk = (newClient?.name.trim().length ?? 0) >= 2;
  const newClientPhoneOk = !newClient?.whatsapp || isValidPhone(newClient.whatsapp);

  async function saveNewClient() {
    if (!newClient || saving) return;
    if (!newClientNameOk || !newClientPhoneOk) {
      notify(
        'Confira os dados da cliente',
        !newClientNameOk ? 'Digite o nome da cliente (pelo menos 2 letras).' : 'O WhatsApp precisa ter DDD + número.',
        'info',
      );
      return;
    }
    if (!requireFeature(access.canAddClient(), 'unlimitedClients')) return;
    setSaving(true);
    const c = await addClient({
      name: newClient.name.trim(),
      whatsapp: newClient.whatsapp.replace(/\D/g, '') || undefined,
    });
    setSaving(false);
    if (!c) return;
    tracking.current.inlineClient = true;
    setClientId(c.id);
    setNewClient(null);
    setQuery('');
  }

  // Pacotes pré-pagos da cliente que cobrem um dos serviços escolhidos (só ao criar)
  const usable = editing ? [] : usablePackages(clientId, serviceIds, packages, appointments);
  const chosenPackage = usable.find((p) => p.id === packageId);
  const sessionsNeeded = Math.max(1, occurrences.length);
  const packageShort = chosenPackage ? availableCredits(chosenPackage, appointments) < sessionsNeeded : false;

  const canSave = !!client && selectedServices.length > 0 && timeValid && !packageShort && addressOk && !saving;
  // O que ainda falta, na ordem da tela (UX-03): o botão fica tocável e mostra/rola até a primeira pendência
  const missing: { key: string; label: string; hint: string }[] = [
    ...(!client ? [{ key: 'cliente', label: 'cliente', hint: 'Escolha ou cadastre a cliente.' }] : []),
    ...(!addressOk ? [{ key: 'local', label: 'endereço', hint: 'Informe o endereço do atendimento.' }] : []),
    ...(!selectedServices.length ? [{ key: 'servicos', label: 'serviço', hint: 'Escolha pelo menos um serviço.' }] : []),
    ...(selectedServices.length && !timeValid ? [{ key: 'horario', label: 'horário', hint: 'Escolha um horário livre.' }] : []),
    ...(packageShort ? [{ key: 'servicos', label: 'sessões no pacote', hint: 'O pacote não tem sessões livres para todas as datas.' }] : []),
  ];

  function onPressSave() {
    if (saving) return;
    const first = missing[0];
    if (first) {
      track('appointment_save_blocked', { origin: tracking.current.origin, missing: missing.map((m) => m.key).join('-') });
      notify(`Falta: ${missing.map((m) => m.label).join(', ')}`, first.hint, 'info');
      const y = sectionY.current[first.key];
      if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
      return;
    }
    save();
  }
  // Bairro atendido em outros dias da semana: só avisa (a profissional decide)
  const areaDayWarning =
    home && area && !area.allowedDays.includes(day.getDay())
      ? `Você não costuma atender ${area.name} ${WEEKDAYS_LONG[day.getDay()].toLowerCase()}.`
      : null;

  /** Cria as sessões informadas (todas ou só as livres, depois do aviso de conflito). */
  async function create(dates: Date[]) {
    setConflicts(null);
    // Edição que passou a repetir: salva a mudança e cria as próximas datas
    if (editing) return applyEdit('one', dates.slice(1));
    if (!dates.length || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    let created = 0;
    try {
      created = await addAppointment({
        clientId: client!.id,
        startsAt: dates[0].toISOString(),
        serviceIds,
        notes: notes.trim() || undefined,
        occurrences: dates.map((d) => d.toISOString()),
        clientPackageId: chosenPackage?.id,
        recurrenceRule: dates.length > 1 && firstStart ? toRRule(firstStart, rule) : null,
        ...(home
          ? {
              locationType: 'home_service' as const,
              serviceAddress: [address.trim(), neighborhood.trim()].filter(Boolean).join(' – '),
              travelFee,
            }
          : {}),
      });
    } finally {
      setSaving(false);
      // Deu certo: a tela fecha; continua travado para um toque atrasado não criar de novo
      if (!created) submitting.current = false;
    }
    if (!created) return;
    tracking.current.saved = true;
    track('appointment_saved', {
      origin: tracking.current.origin,
      duration_ms: Date.now() - tracking.current.openedAt,
      days_ahead: Math.round((startOfDay(dates[0]).getTime() - startOfDay(new Date()).getTime()) / 86_400_000),
      n_services: serviceIds.length,
      series_count: dates.length,
      used_package: !!chosenPackage,
      outside_hours: override,
      home,
      created_client_inline: tracking.current.inlineClient,
      online,
    });
    // Guarda o endereço na ficha da cliente quando mudou
    if (home && client && (address.trim() !== (client.address ?? '') || neighborhood.trim() !== (client.neighborhood ?? ''))) {
      await updateClientAddress(client.id, address, neighborhood);
    }
    if (created > 1) notify('Série criada', `${created} agendamentos foram adicionados à agenda.`);
    else if (online) notify('Agendamento salvo'); // offline, o próprio store já avisa que ficou no aparelho
    closeToDay(firstStart);
  }

  /**
   * Edição: aplica a mudança na sessão (ou nas sessões) escolhida(s).
   * nextDates: agendamento avulso que passou a repetir — datas das próximas sessões a criar.
   */
  async function applyEdit(scope: SeriesScope, nextDates: Date[] = []) {
    setAskScope(false);
    if (!editing || !firstStart) return;
    const servicesChanged = serviceIds.join() !== editServiceIds.join();
    const targets = seriesTargets(editing, appointments, scope);
    const shiftMs = firstStart.getTime() - editStart!.getTime();
    if (scope !== 'one') {
      const ctx = {
        appointments,
        blocks,
        businessHours,
        ignoreIds: targets,
        ignoreHours: override,
        travelBufferMin: buffer,
        home: needsTravel,
      };
      // Sessões que já passaram não são conferidas (só as que ainda vão acontecer)
      const found = appointments
        .filter((a) => a.id !== editing.id && targets.includes(a.id) && new Date(a.startsAt) >= new Date())
        .map((a) => {
          const start = new Date(new Date(a.startsAt).getTime() + shiftMs);
          const minutes = servicesChanged
            ? duration
            : (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000;
          return { start, reason: slotConflict(start, minutes, ctx) };
        })
        .filter((c): c is { start: Date; reason: string } => !!c.reason)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      if (found.length) {
        const list = found
          .slice(0, 6)
          .map((c) => `• ${formatDateShort(c.start)} às ${formatTime(c.start)}: ${c.reason}`)
          .join('\n');
        const more = found.length > 6 ? `\n…e mais ${found.length - 6}` : '';
        notify(
          found.length === 1 ? '1 sessão ficaria em conflito' : `${found.length} sessões ficariam em conflito`,
          `${list}${more}\n\nNada foi alterado. Escolha outro horário ou altere só esta sessão.`,
        );
        return;
      }
    }
    const notesChanged = notes.trim() !== (editing.notes ?? '');
    const changed = !!shiftMs || servicesChanged || notesChanged;
    // Nada mudou: só fecha
    if (!changed && !nextDates.length) {
      closeModal();
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    let ok = false;
    let added = 0;
    try {
      ok = !changed
        ? true
        : await updateAppointments(
            editing.id,
            targets,
            {
              shiftMs,
              serviceIds: servicesChanged ? serviceIds : undefined,
              notes: notesChanged ? notes.trim() : undefined,
            },
            scope,
          );
      if (ok && nextDates.length) {
        added = await extendIntoSeries(
          editing.id,
          nextDates.map((d) => d.toISOString()),
          toRRule(firstStart, rule) ?? '',
        );
        // A mudança foi salva, mas a série não: a tela fica aberta para tentar de novo
        if (!added) ok = false;
      }
    } finally {
      setSaving(false);
      // Deu certo: a tela fecha; continua travado para um toque atrasado não mover de novo
      if (!ok) submitting.current = false;
    }
    if (ok) {
      tracking.current.saved = true;
      track('appointment_edited', {
        duration_ms: Date.now() - tracking.current.openedAt,
        scope,
        moved: !!shiftMs,
        services_changed: servicesChanged,
        series_count: added ? added + 1 : 0,
      });
      if (added) notify('Série criada', `${added + 1} agendamentos na série (este e mais ${added}).`);
      closeToDay(firstStart);
    }
  }

  async function save() {
    if (!canSave || !firstStart || submitting.current) return;
    // Plano caiu para o Free com mais serviços ativos do que o limite: escolher quais ficam
    const servicesChanged = !editing || serviceIds.join() !== editServiceIds.join();
    if (servicesChanged && access.servicesOverLimit > 0) {
      const max = access.limits.activeServices;
      const extra = access.servicesOverLimit;
      confirmAction(
        'Serviços acima do limite do plano',
        `O plano ${access.plan.name} permite ${max} serviços ativos. Desative ${extra === 1 ? '1 serviço' : `${extra} serviços`} em Ajustes › Serviços para voltar a agendar (dá para reativar quando quiser), ou assine o plano Básico.`,
        () => router.push('/ajustes/servicos'),
        'Ver serviços',
      );
      return;
    }
    if (editing) {
      const changedTimeOrServices =
        firstStart.getTime() !== editStart!.getTime() || serviceIds.join() !== editServiceIds.join();
      // Em série, pergunta se vale só para esta sessão ou para as próximas também
      const proceed = () => {
        if (canRepeatEdit && occurrences.length > 1) return repeatEdited();
        if (changedTimeOrServices && hasOpenSiblings(editing, appointments)) setAskScope(true);
        else applyEdit('one');
      };
      /** Avulso que passou a repetir: confere limites e conflitos das próximas datas antes de salvar. */
      const repeatEdited = () => {
        const extra = occurrences.length - 1;
        if (!requireFeature(access.hasRecurrence, 'recurrence')) return;
        if (
          !requireFeature(
            access.canAddAppointmentThisMonth(access.appointmentsInMonth(day), extra),
            'unlimitedAppointments',
          )
        )
          return;
        const ctx = {
          appointments,
          blocks,
          businessHours,
          ignoreIds: [editing.id],
          ignoreHours: override,
          travelBufferMin: buffer,
          home: needsTravel,
        };
        const found = occurrences
          .slice(1)
          .map((date) => ({ date, reason: slotConflict(date, duration, ctx) }))
          .filter((c): c is { date: Date; reason: string } => !!c.reason);
        if (found.length) setConflicts(found);
        else applyEdit('one', occurrences.slice(1));
      };
      // Tirou o serviço do pacote: a sessão deixa de usar o pacote e passa a ser cobrada
      const editPkg = packages.find((p) => p.id === editing.clientPackageId);
      if (editPkg && !coversPackage(editPkg, serviceIds)) {
        confirmAction(
          'Tirar do pacote?',
          `Sem todos os serviços do pacote "${editPkg.name}", esta sessão deixa de usar o pacote: o crédito volta para o saldo e o valor dos serviços será cobrado ao concluir.`,
          proceed,
          'Tirar do pacote',
        );
        return;
      }
      proceed();
      return;
    }
    // Limites do plano (o banco confere de novo ao gravar)
    if (occurrences.length > 1 && !requireFeature(access.hasRecurrence, 'recurrence')) return;
    if (
      !requireFeature(
        access.canAddAppointmentThisMonth(access.appointmentsInMonth(day), occurrences.length),
        'unlimitedAppointments',
      )
    )
      return;
    // Confere todas as datas futuras da série antes de criar
    const ctx = { appointments, blocks, businessHours, ignoreHours: override, travelBufferMin: buffer, home };
    const found = occurrences
      .slice(1)
      .map((date) => ({ date, reason: slotConflict(date, duration, ctx) }))
      .filter((c): c is { date: Date; reason: string } => !!c.reason);
    if (found.length) setConflicts(found);
    else await create(occurrences);
  }

  return (
    <View className="flex-1 bg-bg">
      <ScrollView ref={scroller} contentContainerStyle={{ padding: 20, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        {/* 1. Cliente */}
        <SectionLabel onLayout={(e) => { sectionY.current.cliente = e.nativeEvent.layout.y; }}>Cliente</SectionLabel>
        {client ? (
          <Pressable accessibilityRole="button"
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
              label={newClientPhoneOk ? 'WhatsApp' : 'WhatsApp — confira o número (DDD + número)'}
              value={newClient.whatsapp}
              onChangeText={(whatsapp) => setNewClient({ ...newClient, whatsapp: maskPhone(whatsapp) })}
              placeholder="(11) 90000-0000"
              keyboardType="phone-pad"
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button title="Cancelar" variant="secondary" onPress={() => setNewClient(null)} />
              </View>
              <View className="flex-1">
                <Button title="Salvar" onPress={saveNewClient} loading={saving} />
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
                <Pressable accessibilityRole="button"
                  key={c.id}
                  onPress={() => setClientId(c.id)}
                  className={`flex-row items-center px-3 py-2.5 active:bg-bg ${i ? 'border-t border-line' : ''}`}>
                  <Avatar name={c.name} size={32} />
                  <Text className="ml-3 flex-1 text-[15px] text-ink">{c.name}</Text>
                  <Text className="text-xs text-muted">{formatPhone(c.whatsapp)}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button"
                onPress={() => setNewClient({ name: query, whatsapp: '' })}
                className="flex-row items-center border-t border-line px-3 py-3 active:bg-bg">
                <Ionicons name="person-add-outline" size={18} color={colors.primaryDark} />
                <Text className="ml-2 text-[15px] font-medium text-primary-dark">Nova cliente</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Local do atendimento */}
        {canHome && !editing ? (
          <>
            <SectionLabel onLayout={(e) => { sectionY.current.local = e.nativeEvent.layout.y; }}>Local do atendimento</SectionLabel>
            {access.serviceMode === 'hybrid' ? (
              <View className="mb-3">
                <Segmented
                  value={locationType}
                  onChange={(v) => {
                    setLocationType(v);
                    setTime(null);
                  }}
                  options={[
                    { value: 'fixed', label: 'No estúdio' },
                    { value: 'home_service', label: 'A domicílio' },
                  ]}
                />
              </View>
            ) : null}
            {home ? (
              <>
                <AddressFields
                  address={address}
                  neighborhood={neighborhood}
                  onChangeAddress={(v) => setAddress({ address: v })}
                  onChangeNeighborhood={(v) => setAddress({ neighborhood: v })}
                  areas={serviceAreas}
                />
                <View className="mb-1 flex-row items-center rounded-2xl bg-primary-soft px-3 py-2.5">
                  <Ionicons name="car-outline" size={16} color={colors.primaryDark} />
                  <Text className="ml-2 flex-1 text-[13px] text-primary-dark">
                    {area
                      ? `Taxa de deslocamento ${formatBRL(travelFee)} · reserva ${buffer} min depois`
                      : neighborhood.trim()
                        ? `Bairro fora da lista: sem taxa · reserva ${buffer} min depois`
                        : 'Escolha o bairro para calcular a taxa de deslocamento'}
                  </Text>
                </View>
                {client && !client.address ? (
                  <Text className="mb-1 text-[12px] text-muted">O endereço será salvo na ficha da cliente.</Text>
                ) : null}
              </>
            ) : null}
          </>
        ) : editing?.locationType === 'home_service' ? (
          <View className="mt-4 flex-row items-start rounded-2xl bg-primary-soft px-3 py-2.5">
            <Ionicons name="home-outline" size={16} color={colors.primaryDark} style={{ marginTop: 2 }} />
            <Text className="ml-2 flex-1 text-[13px] text-primary-dark">
              A domicílio: {editing.serviceAddress || 'endereço não informado'}
              {editing.travelFee ? ` · taxa ${formatBRL(editing.travelFee)}` : ''}
            </Text>
          </View>
        ) : null}

        {/* 2. Serviços */}
        <SectionLabel onLayout={(e) => { sectionY.current.servicos = e.nativeEvent.layout.y; }}>Serviços</SectionLabel>
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
        {/* "Outra data" fora da faixa: ao fechar o calendário, o navegador devolvia o foco ao botão
            (último item da faixa) e rolava até o fim, escondendo o dia escolhido (UX-05) */}
        <View className="flex-row items-end justify-between">
          <SectionLabel>Data</SectionLabel>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escolher outra data no calendário"
            onPress={() => setPickDate(true)}
            hitSlop={8}
            className="mb-2 flex-row items-center py-1 active:opacity-60">
            <Ionicons name="calendar-outline" size={15} color={colors.primaryDark} />
            <Text className="ml-1 text-[13px] font-medium text-primary-dark">Outra data</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5 px-5"
          ref={dayStrip}
          // Já abre mostrando o dia escolhido (cada dia ocupa 64px: 56 + margem 8)
          onContentSizeChange={() => {
            if (dayStripTarget.current !== null) {
              const x = dayStripTarget.current;
              dayStripTarget.current = null;
              setTimeout(() => dayStrip.current?.scrollTo({ x, animated: true }), 0);
              return;
            }
            if (dayStripPositioned.current) return;
            dayStripPositioned.current = true;
            const i = days.findIndex((d) => isSameDay(d, day));
            if (i > 3) dayStrip.current?.scrollTo({ x: (i - 2) * 64, animated: false });
          }}>
          {days.map((d) => {
            const sel = isSameDay(d, day);
            return (
              <Pressable accessibilityRole="button" accessibilityLabel={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} accessibilityState={{ selected: !!sel }}
                key={d.toDateString()}
                onPress={() => {
                  setDay(d);
                  setTime(null);
                }}
                className={`mr-2 w-14 items-center rounded-2xl border py-2 ${
                  sel ? 'border-primary bg-primary' : 'border-line bg-surface'
                }`}>
                <Text className={`text-[11px] ${sel ? 'text-on-primary' : 'text-muted'}`}>{WEEKDAYS_SHORT[d.getDay()]}</Text>
                <Text className={`text-lg font-semibold ${sel ? 'text-on-primary' : 'text-ink'}`}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
          <View className="w-8" />
        </ScrollView>

        {/* 4. Horário */}
        <SectionLabel onLayout={(e) => { sectionY.current.horario = e.nativeEvent.layout.y; }}>
          Horário {duration ? `· duração ${formatDuration(duration)}` : ''}
        </SectionLabel>
        {closedReason || override ? (
          <View className="mb-3 flex-row items-start rounded-2xl bg-[#FBF3E4] p-3">
            <Ionicons name="alert-circle-outline" size={18} color="#8A6420" />
            <View className="ml-2 flex-1">
              <Text className="text-[13px] leading-5 text-[#8A6420]">
                {override
                  ? 'Mostrando o dia todo, fora do expediente. O atendimento pode terminar depois da meia-noite.'
                  : `${closedReason} Para atender mesmo assim, libere os horários.`}
              </Text>
              <Pressable accessibilityRole="button" onPress={toggleOverride} className="mt-1 self-start py-1">
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
                <Pressable accessibilityRole="button" accessibilityState={{ selected: !!sel, disabled: !s.free }}
                  accessibilityLabel={`${formatTime(atMinutes(day, s.min))}${s.free ? (s.inBreak ? ', na pausa' : '') : ', ocupado'}`}
                  key={s.min}
                  disabled={!s.free}
                  onPress={() => pickTime(s)}
                  className={`mb-2 mr-2 w-[72px] items-center rounded-xl border py-2 ${
                    sel
                      ? 'border-primary bg-primary'
                      : s.free
                        ? s.inBreak
                          ? 'border-dashed border-[#D9B871] bg-[#FBF3E4]'
                          : 'border-line bg-surface'
                        : 'border-transparent bg-transparent'
                  }`}>
                  <Text
                    className={`text-[14px] font-medium ${
                      sel ? 'text-on-primary' : s.free ? (s.inBreak ? 'text-[#8A6420]' : 'text-ink') : 'text-muted line-through'
                    }`}>
                    {formatTime(atMinutes(day, s.min))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View>
            {/* Dia fechado ou de folga: o aviso acima já explica; aqui só a sugestão (UX-06) */}
            {closedReason && !override ? null : <Text className="text-sm text-muted">Nenhum horário livre neste dia.</Text>}
            {nextFree ? (
              <View className="mt-2 flex-row items-center rounded-2xl border border-line bg-surface px-4 py-3">
                <Text className="flex-1 text-[14px] text-ink">
                  Próximo livre: <Text className="font-semibold">{formatDayTitle(nextFree.day)} às {formatTime(atMinutes(nextFree.day, nextFree.min))}</Text>
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Usar ${formatDayTitle(nextFree.day)} às ${formatTime(atMinutes(nextFree.day, nextFree.min))}`}
                  onPress={() => goToDay(nextFree.day, nextFree.min)}
                  className="ml-3 rounded-full bg-primary px-4 py-1.5 active:opacity-80">
                  <Text className="text-[13px] font-semibold text-on-primary">Usar</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
        {/* Dia aberto: também dá para liberar horários antes de abrir ou depois de fechar */}
        {!closedReason && !override ? (
          <Pressable accessibilityRole="button" onPress={toggleOverride} className="mb-2 self-start py-1">
            <Text className="text-[13px] font-medium text-primary-dark underline">Agendar fora do expediente</Text>
          </Pressable>
        ) : null}
        {timeValid && endTime ? (
          <Text className="mt-1 text-[13px] text-muted">
            Das {formatTime(atMinutes(day, time!))} às {endTime} (término calculado pela duração dos serviços)
            {needsTravel ? ` + ${buffer} min de deslocamento` : ''}
          </Text>
        ) : null}
        {areaDayWarning ? (
          <Text className="mt-1 text-[13px] text-[#8A6420]">{areaDayWarning}</Text>
        ) : null}

        {/* Crédito de pacote pré-pago */}
        {usable.map((p) => {
          const on = packageId === p.id;
          const left = p.totalSessions - p.usedSessions;
          const credits = availableCredits(p, appointments);
          return (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: !!(on) }}
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

        {/* 5. Repetir (ao criar, ou ao editar um agendamento avulso) */}
        {!editing || canRepeatEdit ? (
          <>
            <SectionLabel>Repetir agendamento</SectionLabel>
            {editing && rule.freq !== 'none' ? (
              <Text className="mb-2 text-[13px] leading-5 text-muted">
                Este agendamento vira a 1ª sessão da série; as próximas são criadas a partir dele.
              </Text>
            ) : null}
            <RecurrencePicker
              start={firstStart ?? atMinutes(day, 9 * 60)}
              value={rule}
              onChange={setRule}
              locked={!access.hasRecurrence}
              onLockedPress={() => openUpgrade('recurrence')}
            />
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
          accessibilityLabel="Observações (opcional)"
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
          {missing.length ? (
            <Text className="flex-1 text-[13px] font-medium text-[#8A6420]">Falta: {missing.map((m) => m.label).join(', ')}</Text>
          ) : (
          <Text className="text-[13px] text-muted">
            {selectedServices.length} {selectedServices.length === 1 ? 'serviço' : 'serviços'}
            {duration ? ` · ${formatDuration(duration)}` : ''}
            {travelFee ? ` · inclui ${formatBRL(travelFee)} de deslocamento` : ''}
          </Text>
          )}
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
          onPress={onPressSave}
          loading={saving}
        />
      </View>

      {editing ? <Stack.Screen options={{ title: 'Editar agendamento' }} /> : null}

      <Sheet visible={pickDate} onClose={() => setPickDate(false)} title="Escolher data">
        {/* O calendário trabalha com período: tocar depois do início chega como "fim" (s, e); vale o último toque */}
        <RangeCalendar
          start={day}
          end={null}
          onChange={(s, e) => {
            const picked = e ?? s;
            if (picked) goToDay(picked);
          }}
        />
      </Sheet>

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
