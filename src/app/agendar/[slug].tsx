// Página pública de agendamento online (sem login).
// Acesso ao banco só pelas funções public_studio, get_public_busy_slots e create_public_booking,
// que expõem apenas dados públicos do estúdio e intervalos ocupados.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { vars } from 'nativewind';
import { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import {
  addDays,
  formatDuration,
  hmToMinutes,
  isSameDay,
  chunkWeeks,
  monthGrid,
  MONTHS,
  startOfDay,
  WEEKDAYS_SHORT,
} from '@/lib/dates';
import { describeDays } from '@/lib/areas';
import { formatBRL, formatPhone, initials, maskPhone, onlyDigits } from '@/lib/format';
import { formatAddress, hoursForDay, isWithinHours, WEEKDAYS_LONG } from '@/lib/hours';
import { supabase } from '@/lib/supabase';
import { DEFAULT_TIMEZONE, minutesLabel, zonedInstant, zonedParts, zonedToday } from '@/lib/timezone';
import { DEFAULT_THEME_COLOR, deriveTheme, themeVars } from '@/theme/palette';
import { colors, statusInfo } from '@/theme/colors';
import type { BusinessHours, Profile } from '@/types';

/** Janela de agendamento (o banco aceita até 90 dias) */
const DAYS_AHEAD = 60;
/** Máximo de serviços num agendamento pelo link (o banco recusa mais que isso) */
const MAX_SERVICES = 6;
/** Antecedência mínima (o banco exige 30 min) */
const MIN_NOTICE_MIN = 60;

interface PublicService {
  id: string;
  name: string;
  category: string | null;
  price: number;
  duration_min: number;
}

interface PublicStudio {
  business_name: string;
  logo_url: string | null;
  phone: string | null;
  instagram: string | null;
  address_street: string | null;
  address_number: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  slot_minutes: number;
  /** Fuso do estúdio (ex: America/Sao_Paulo): os horários seguem o relógio do estúdio, não o de quem abre o link */
  timezone?: string;
  /** false quando o plano do estúdio não inclui agendamento online */
  booking_enabled?: boolean;
  /** Cor do tema do estúdio (HEX) */
  theme_color?: string;
  /** Ausentes antes da migração de atendimento a domicílio */
  service_mode?: 'fixed' | 'home_service' | 'hybrid';
  travel_buffer_minutes?: number;
  areas?: PublicArea[];
  services: PublicService[];
  hours: {
    day_of_week: number;
    is_open: boolean;
    open_time: string;
    close_time: string;
    break_start: string | null;
    break_end: string | null;
  }[];
}

interface PublicArea {
  id: string;
  name: string;
  travel_fee: number;
  allowed_days: number[];
}

interface Busy {
  start: number;
  end: number;
}

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Horários ocupados (agendamentos, folgas e bloqueios) dos próximos dias.
 * A função do banco devolve só início e fim — nenhum dado de outras clientes.
 */
async function fetchBusySlots(slug: string): Promise<Busy[] | null> {
  // Um dia de folga para cada lado: quem abre o link pode estar em outro fuso
  const from = addDays(startOfDay(new Date()), -1);
  const { data, error } = await supabase.rpc('get_public_busy_slots', {
    p_slug: slug,
    p_start_date: isoDate(from),
    p_end_date: isoDate(addDays(from, DAYS_AHEAD + 2)),
  });
  // Falhou (ex: sem internet): null, para a tela não mostrar todos os horários como livres
  if (error) return null;
  return ((data as { start_time: string; end_time: string }[]) ?? []).map((b) => ({
    start: new Date(b.start_time).getTime(),
    end: new Date(b.end_time).getTime(),
  }));
}

/**
 * Mensagem para a cliente. As regras do link (horário ocupado, limite de pedidos, WhatsApp
 * inválido...) já vêm do banco em português e são mostradas como estão; qualquer outro erro
 * (técnico, em inglês, sem internet) vira um texto simples.
 */
function bookingError(e: { code?: string; message?: string }): string {
  if (/network request failed|failed to fetch|fetch failed|networkerror|load failed/i.test(e.message ?? '')) {
    return 'Sem conexão com a internet. Confira sua conexão e tente de novo.';
  }
  // raise exception do banco sem código próprio = P0001 (mensagens escritas para a cliente)
  // Limite do plano do estúdio: código interno, não é texto para a cliente
  if (/PLAN_LIMIT/.test(e.message ?? '')) {
    return 'O estúdio não está recebendo agendamentos pelo link agora. Fale com o estúdio pelo WhatsApp.';
  }
  if (e.code === 'P0001' && e.message) return e.message;
  if (e.code === '23P01') return 'Esse horário acabou de ser ocupado. Escolha outro.';
  return 'Não foi possível agendar agora. Tente de novo ou fale com o estúdio pelo WhatsApp.';
}

interface Booked {
  id: string;
  starts_at: string;
  ends_at: string;
  status: 'pendente' | 'confirmado';
  total_price: number;
}

type Step = 'services' | 'local' | 'date' | 'details' | 'done';

// ---------------------------------------------------------------------
// Calendário (.ics) para "Adicionar ao meu calendário"
// ---------------------------------------------------------------------
const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function buildIcs(b: Booked, title: string, location: string) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Agenda Beleza//PT-BR',
    'BEGIN:VEVENT',
    `UID:${b.id}@agenda-beleza`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(b.starts_at)}`,
    `DTEND:${icsDate(b.ends_at)}`,
    `SUMMARY:${title.replace(/[,;]/g, ' ')}`,
    location ? `LOCATION:${location.replace(/[,;]/g, ' ')}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT3H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lembrete do seu horário',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

// ---------------------------------------------------------------------
// Peças visuais
// ---------------------------------------------------------------------
function StepHeader({ labels, current, onBack }: { labels: string[]; current: number; onBack?: () => void }) {
  const step = current + 1;
  return (
    <View className="mb-4 flex-row items-center">
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} hitSlop={10} className="mr-2 p-1 active:opacity-60">
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
      ) : null}
      <View className="flex-1 flex-row gap-1.5">
        {labels.map((l, i) => (
          <View key={l} className="flex-1">
            <View className={`h-1 rounded-full ${i < step ? 'bg-primary' : 'bg-line'}`} />
            <Text className={`mt-1 text-[11px] ${i + 1 === step ? 'font-semibold text-ink' : 'text-muted'}`}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AgendarOnline() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();

  const [studio, setStudio] = useState<PublicStudio | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<Busy[]>([]);
  // Não deu para saber os horários ocupados: nenhum horário aparece como livre até carregar
  const [busyFailed, setBusyFailed] = useState(false);
  const [busyLoading, setBusyLoading] = useState(false);
  const [step, setStep] = useState<Step>('services');
  // Atendimento a domicílio: local escolhido, bairro e endereço
  const [locationType, setLocationType] = useState<'fixed' | 'home_service'>('fixed');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);
  // Cor do estúdio (Ajustes > Aparência e cores), não a de quem está vendo a página
  const brand = deriveTheme(studio?.theme_color ?? DEFAULT_THEME_COLOR);
  const brandVars = vars(themeVars(brand));

  // Recarrega os horários ocupados (ex: depois de alguém ocupar o horário escolhido)
  async function loadBusy() {
    setBusyLoading(true);
    const slots = await fetchBusySlots(slug);
    setBusyLoading(false);
    setBusyFailed(!slots);
    if (slots) setBusy(slots);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase.rpc('public_studio', { p_slug: slug });
      if (cancelled) return;
      if (e || !data) {
        setNotFound(true);
        return;
      }
      setStudio(data as PublicStudio);
      const slots = await fetchBusySlots(slug);
      if (cancelled) return;
      setBusyFailed(!slots);
      if (slots) setBusy(slots);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Título da aba do navegador
  const pageTitle = studio ? `Agendar · ${studio.business_name}` : 'Agendar horário';

  if (notFound) {
    return (
      <View className="flex-1 items-center justify-center bg-bg px-8">
        <Stack.Screen options={{ title: 'Link não encontrado' }} />
        <Ionicons name="link-outline" size={36} color={colors.muted} />
        <Text className="mt-3 text-lg font-semibold text-ink">Link não encontrado</Text>
        <Text className="mt-1 text-center text-[14px] text-muted">
          Confira o endereço com o estúdio. O link pode ter sido alterado.
        </Text>
      </View>
    );
  }
  if (!studio) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (studio.booking_enabled === false) {
    const digits = onlyDigits(studio.phone ?? '');
    return (
      <View className="flex-1 items-center justify-center bg-bg px-8" style={brandVars}>
        <Stack.Screen options={{ title: studio.business_name }} />
        {studio.logo_url ? (
          <Image source={{ uri: studio.logo_url }} style={{ width: 72, height: 72, borderRadius: 20 }} contentFit="cover" />
        ) : (
          <View className="h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-primary-soft">
            <Text className="text-2xl font-bold text-primary-dark">{initials(studio.business_name)}</Text>
          </View>
        )}
        <Text className="mt-4 text-center text-lg font-semibold text-ink">{studio.business_name}</Text>
        <Text className="mt-1 text-center text-[14px] leading-5 text-muted">
          O agendamento online está indisponível no momento.
          {digits ? ' Fale com o estúdio pelo WhatsApp para marcar seu horário.' : ''}
        </Text>
        {digits ? (
          <View className="mt-5 w-full max-w-[320px]">
            <Button
              title="Chamar no WhatsApp"
              icon="logo-whatsapp"
              variant="whatsapp"
              onPress={() =>
                Linking.openURL(
                  `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}?text=${encodeURIComponent('Olá! Gostaria de agendar um horário.')}`,
                )
              }
            />
          </View>
        ) : null}
      </View>
    );
  }

  // -------------------------------------------------------------------
  // Regras de disponibilidade (as mesmas validadas pelo banco)
  // -------------------------------------------------------------------
  const hours: BusinessHours[] = studio.hours.map((h) => ({
    dayOfWeek: h.day_of_week,
    isOpen: h.is_open,
    openTime: h.open_time,
    closeTime: h.close_time,
    breakStart: h.break_start ?? undefined,
    breakEnd: h.break_end ?? undefined,
  }));
  const address = formatAddress({
    addressStreet: studio.address_street ?? undefined,
    addressNumber: studio.address_number ?? undefined,
    addressDistrict: studio.address_district ?? undefined,
    addressCity: studio.address_city ?? undefined,
    addressState: studio.address_state ?? undefined,
    addressZip: studio.address_zip ?? undefined,
  } as Profile);

  const mode = studio.service_mode ?? 'fixed';
  const areas = studio.areas ?? [];
  const needsLocal = mode !== 'fixed';
  const home = mode === 'home_service' || (mode === 'hybrid' && locationType === 'home_service');
  const area = home ? areas.find((a) => a.id === areaId) : undefined;
  const travelFee = area ? Number(area.travel_fee) : 0;
  const buffer = home ? (studio.travel_buffer_minutes ?? 0) : 0;
  const stepLabels = needsLocal ? ['Serviços', 'Local', 'Data e horário', 'Seus dados'] : ['Serviços', 'Data e horário', 'Seus dados'];
  const stepIndex = (st: Step) => Math.max(0, stepLabels.indexOf({ services: 'Serviços', local: 'Local', date: 'Data e horário', details: 'Seus dados', done: '' }[st]));
  const serviceAddress = [
    [street.trim(), number.trim()].filter(Boolean).join(', '),
    complement.trim(),
  ]
    .filter(Boolean)
    .join(' – ');
  const addressOk = !home || (street.trim().length >= 3 && number.trim().length >= 1);

  const selected = serviceIds.map((id) => studio.services.find((s) => s.id === id)!).filter(Boolean);
  const duration = selected.reduce((t, s) => t + s.duration_min, 0);
  const total = selected.reduce((t, s) => t + Number(s.price), 0) + travelFee;
  const slotStep = Math.max(15, studio.slot_minutes);
  const tz = studio.timezone || DEFAULT_TIMEZONE;
  const today = zonedToday(tz);
  const lastDay = addDays(today, DAYS_AHEAD);
  const earliest = new Date().getTime() + MIN_NOTICE_MIN * 60_000;

  function freeSlots(d: Date): number[] {
    const h = hoursForDay(d, hours);
    if (!h.isOpen || !duration || busyFailed) return [];
    // Domicílio: só os dias da semana em que o estúdio atende o bairro escolhido
    if (home && (!area || !area.allowed_days.includes(d.getDay()))) return [];
    // Folgas e bloqueios vêm como horários ocupados: um dia de folga fica sem horários livres
    const result: number[] = [];
    for (let m = hmToMinutes(h.openTime); m + duration <= hmToMinutes(h.closeTime); m += slotStep) {
      if (!isWithinHours(h, m, m + duration)) continue; // não atravessa a pausa
      const s = zonedInstant(d, m, tz).getTime();
      const e = s + duration * 60_000;
      if (s < earliest) continue;
      // Em domicílio, o deslocamento depois do atendimento também precisa estar livre
      const eBusy = e + buffer * 60_000;
      if (busy.some((b) => b.start < eBusy && b.end > s)) continue;
      result.push(m);
    }
    return result;
  }

  function dayState(d: Date): 'past' | 'closed' | 'full' | 'open' {
    if (d < today || d > lastDay) return 'past';
    if (busyFailed) return 'full';
    if (!hoursForDay(d, hours).isOpen) return 'closed';
    if (home && area && !area.allowed_days.includes(d.getDay())) return 'closed';
    return freeSlots(d).length ? 'open' : 'full';
  }

  const toggleService = (id: string) => {
    setServiceIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= MAX_SERVICES ? ids : [...ids, id],
    );
    setTime(null);
  };

  async function confirm() {
    if (!day || time === null || sending) return;
    setSending(true);
    setError(null);
    const { data, error: e } = await supabase.rpc('create_public_booking', {
      p_slug: slug,
      p_service_ids: serviceIds,
      p_starts_at: zonedInstant(day, time, tz).toISOString(),
      p_name: name.trim(),
      p_whatsapp: onlyDigits(phone),
      p_notes: notes.trim() || null,
      ...(needsLocal
        ? {
            p_location_type: home ? 'home_service' : 'fixed',
            p_area_id: home ? areaId : null,
            p_address: home ? serviceAddress : null,
          }
        : {}),
    });
    setSending(false);
    if (e) {
      setError(bookingError(e));
      // O horário pode ter sido ocupado: atualiza a disponibilidade
      if (/ocupad|indispon/i.test(e.message ?? '') || e.code === '23P01') loadBusy();
      return;
    }
    setBooked(data as Booked);
    setStep('done');
  }

  const services = studio.services;
  const categories = [...new Set(services.map((s) => s.category ?? 'Serviços'))];
  const nameOk = name.trim().length >= 3;
  const phoneOk = onlyDigits(phone).length >= 10;

  // -------------------------------------------------------------------
  // Tela
  // -------------------------------------------------------------------
  const header = (
    <View className="mb-5 items-center">
      {studio.logo_url ? (
        <Image source={{ uri: studio.logo_url }} style={{ width: 72, height: 72, borderRadius: 20 }} contentFit="cover" />
      ) : (
        <View className="h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-primary-soft">
          <Text className="text-2xl font-bold text-primary-dark">{initials(studio.business_name)}</Text>
        </View>
      )}
      <Text className="mt-3 text-center text-[22px] font-bold text-ink">{studio.business_name}</Text>
      {address ? <Text className="mt-0.5 text-center text-[13px] text-muted">{address}</Text> : null}
      {studio.instagram ? (
        <Text
          className="mt-0.5 text-[13px] font-medium text-primary-dark"
          onPress={() => Linking.openURL(`https://instagram.com/${studio.instagram}`)}>
          @{studio.instagram}
        </Text>
      ) : null}
    </View>
  );

  let body: ReactNode;
  let footer: ReactNode = null;

  if (step === 'services') {
    body = (
      <>
        <StepHeader labels={stepLabels} current={0} />
        <Text className="mb-3 text-[17px] font-semibold text-ink">Escolha o(s) serviço(s)</Text>
        {categories.map((cat) => (
          <View key={cat} className="mb-4">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{cat}</Text>
            <View className="overflow-hidden rounded-card border border-line bg-surface">
              {services
                .filter((s) => (s.category ?? 'Serviços') === cat)
                .map((s, i) => {
                  const on = serviceIds.includes(s.id);
                  return (
                    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!(on) }}
                      key={s.id}
                      onPress={() => toggleService(s.id)}
                      className={`flex-row items-center px-4 py-3.5 active:bg-bg ${i ? 'border-t border-line' : ''} ${
                        on ? 'bg-primary-soft' : ''
                      }`}>
                      <View className="flex-1">
                        <Text className="text-[15px] font-medium text-ink">{s.name}</Text>
                        <Text className="text-xs text-muted">{formatDuration(s.duration_min)}</Text>
                      </View>
                      <Text className="mr-3 text-[14px] font-semibold text-ink">{formatBRL(Number(s.price))}</Text>
                      <Ionicons
                        name={on ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={on ? brand.primary : colors.line}
                      />
                    </Pressable>
                  );
                })}
            </View>
          </View>
        ))}
        {serviceIds.length >= MAX_SERVICES ? (
          <Text className="mb-3 text-center text-[13px] text-muted">
            Dá para escolher até {MAX_SERVICES} serviços por agendamento. Para mais, fale com o estúdio.
          </Text>
        ) : null}
        {!services.length ? (
          <Text className="text-center text-[14px] text-muted">Nenhum serviço disponível para agendamento online.</Text>
        ) : null}
      </>
    );
    footer = (
      <>
        <View className="mb-2 flex-row justify-between">
          <Text className="text-[13px] text-muted">
            {selected.length ? `${selected.length} serviço(s) · ${formatDuration(duration)}` : 'Nenhum serviço escolhido'}
          </Text>
          <Text className="text-[15px] font-semibold text-ink">{formatBRL(total)}</Text>
        </View>
        <Button
          title={needsLocal ? 'Continuar' : 'Escolher data e horário'}
          onPress={() => setStep(needsLocal ? 'local' : 'date')}
          disabled={!selected.length}
        />
      </>
    );
  } else if (step === 'local') {
    const digits = onlyDigits(studio.phone ?? '');
    const askWhatsapp = () =>
      Linking.openURL(
        `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}?text=${encodeURIComponent(
          `Olá! Gostaria de agendar ${selected.map((x) => x.name).join(' + ')} a domicílio, mas meu bairro não está na lista do link. Vocês atendem no meu bairro?`,
        )}`,
      );
    const pickLocation = (v: 'fixed' | 'home_service') => {
      setLocationType(v);
      setDay(null);
      setTime(null);
    };
    body = (
      <>
        <StepHeader labels={stepLabels} current={1} onBack={() => setStep('services')} />
        {mode === 'hybrid' ? (
          <>
            <Text className="mb-3 text-[17px] font-semibold text-ink">Onde vai ser o atendimento?</Text>
            {(
              [
                { v: 'fixed', icon: 'storefront-outline', title: 'No estúdio', detail: address || 'No endereço do estúdio' },
                { v: 'home_service', icon: 'home-outline', title: 'Em domicílio', detail: 'A profissional vai até você' },
              ] as const
            ).map((o) => {
              const on = locationType === o.v;
              return (
                <Pressable accessibilityRole="button" accessibilityState={{ selected: !!(on) }}
                  key={o.v}
                  onPress={() => pickLocation(o.v)}
                  className={`mb-2 flex-row items-center rounded-card border px-4 py-3.5 active:opacity-80 ${
                    on ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
                  }`}>
                  <Ionicons name={o.icon} size={20} color={on ? brand.primaryDark : colors.muted} />
                  <View className="ml-3 flex-1">
                    <Text className="text-[15px] font-medium text-ink">{o.title}</Text>
                    <Text className="text-xs text-muted">{o.detail}</Text>
                  </View>
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? brand.primary : colors.line} />
                </Pressable>
              );
            })}
          </>
        ) : null}

        {home ? (
          <>
            <Text className={`mb-1 text-[17px] font-semibold text-ink ${mode === 'hybrid' ? 'mt-5' : ''}`}>
              Qual é o seu bairro?
            </Text>
            <Text className="mb-3 text-[13px] text-muted">Mostramos só os dias em que atendemos o seu bairro.</Text>
            {areas.length ? (
              <View className="overflow-hidden rounded-card border border-line bg-surface">
                {areas.map((a, i) => {
                  const on = areaId === a.id;
                  return (
                    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!(on) }}
                      key={a.id}
                      onPress={() => {
                        setAreaId(a.id);
                        setDay(null);
                        setTime(null);
                      }}
                      className={`flex-row items-center px-4 py-3.5 active:bg-bg ${i ? 'border-t border-line' : ''} ${
                        on ? 'bg-primary-soft' : ''
                      }`}>
                      <View className="flex-1">
                        <Text className="text-[15px] font-medium text-ink">{a.name}</Text>
                        <Text className="text-xs text-muted">Atende: {describeDays(a.allowed_days)}</Text>
                      </View>
                      <Text className="mr-3 text-[13px] font-medium text-muted">
                        {Number(a.travel_fee) ? `+ ${formatBRL(Number(a.travel_fee))}` : 'Sem taxa'}
                      </Text>
                      <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? brand.primary : colors.line} />
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text className="text-[14px] text-muted">Os bairros atendidos ainda não foram cadastrados.</Text>
            )}
            {digits ? (
              <Pressable accessibilityRole="button" onPress={askWhatsapp} className="mt-3 items-center py-2 active:opacity-60">
                <Text className="text-[13px] text-muted underline">Meu bairro não está na lista</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </>
    );
    footer = (
      <>
        {travelFee ? (
          <View className="mb-2 flex-row justify-between">
            <Text className="text-[13px] text-muted">Taxa de deslocamento</Text>
            <Text className="text-[13px] font-medium text-ink">{formatBRL(travelFee)}</Text>
          </View>
        ) : null}
        <Button title="Escolher data e horário" onPress={() => setStep('date')} disabled={home && !area} />
      </>
    );
  } else if (step === 'date') {
    const grid = monthGrid(month);
    const slots = day ? freeSlots(day) : [];
    const canPrev = month > new Date(today.getFullYear(), today.getMonth(), 1);
    const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= lastDay;
    body = (
      <>
        <StepHeader
          labels={stepLabels}
          current={stepIndex('date')}
          onBack={() => setStep(needsLocal ? 'local' : 'services')}
        />
        {busyFailed ? (
          <View className="mb-3 rounded-2xl bg-[#F8E9EA] px-4 py-3">
            <Text className="text-[13px] text-[#B2474F]">
              Não foi possível carregar os horários livres. Confira sua internet e tente de novo.
            </Text>
            <Pressable accessibilityRole="button" onPress={loadBusy} disabled={busyLoading} hitSlop={8} className="mt-2 self-start">
              <Text className="text-[13px] font-semibold text-[#B2474F]">
                {busyLoading ? 'Carregando…' : 'Tentar de novo'}
              </Text>
            </Pressable>
          </View>
        ) : null}
        <View className="rounded-card border border-line bg-surface p-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior"
              disabled={!canPrev}
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              hitSlop={10}
              className={`p-1 ${canPrev ? '' : 'opacity-20'}`}>
              <Ionicons name="chevron-back" size={18} color={colors.ink} />
            </Pressable>
            <Text className="text-[15px] font-semibold text-ink">
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês"
              disabled={!canNext}
              onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              hitSlop={10}
              className={`p-1 ${canNext ? '' : 'opacity-20'}`}>
              <Ionicons name="chevron-forward" size={18} color={colors.ink} />
            </Pressable>
          </View>
          <View className="flex-row">
            {WEEKDAYS_SHORT.map((w) => (
              <Text key={w} className="flex-1 text-center text-[11px] text-muted">
                {w}
              </Text>
            ))}
          </View>
          <View className="mt-1">
            {chunkWeeks(grid).map((week) => (
            <View key={week[0].toDateString()} className="flex-row">
            {week.map((d) => {
              const other = d.getMonth() !== month.getMonth();
              const state = other ? 'past' : dayState(d);
              const sel = day && isSameDay(d, day);
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} accessibilityState={{ selected: !!sel, disabled: state !== 'open' }}
                  key={d.toDateString()}
                  disabled={state !== 'open'}
                  onPress={() => {
                    setDay(d);
                    setTime(null);
                  }}
                  className="h-11 flex-1 items-center justify-center">
                  <View
                    className={`h-9 w-9 items-center justify-center rounded-full ${
                      sel ? 'bg-primary' : state === 'open' ? 'bg-primary-soft' : ''
                    }`}>
                    <Text
                      className={`text-[14px] ${
                        sel
                          ? 'font-semibold text-on-primary'
                          : state === 'open'
                            ? 'font-medium text-primary-dark'
                            : 'text-line'
                      } ${state === 'closed' && !other ? 'line-through' : ''}`}>
                      {other ? '' : d.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            </View>
            ))}
          </View>
          <Text className="mt-2 text-center text-[11px] text-muted">
            Dias em destaque têm horários livres para {formatDuration(duration)}
            {area ? ` em ${area.name}` : ''}.
          </Text>
        </View>

        {day ? (
          <>
            <Text className="mb-2 mt-5 text-[15px] font-semibold text-ink">
              {WEEKDAYS_LONG[day.getDay()]}, {day.getDate()} de {MONTHS[day.getMonth()].toLowerCase()}
            </Text>
            {slots.length ? (
              <View className="flex-row flex-wrap">
                {slots.map((m) => {
                  const sel = time === m;
                  return (
                    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!(sel) }}
                      key={m}
                      onPress={() => setTime(m)}
                      className={`mb-2 mr-2 w-[74px] items-center rounded-xl border py-2.5 ${
                        sel ? 'border-primary bg-primary' : 'border-line bg-surface'
                      }`}>
                      <Text className={`text-[14px] font-medium ${sel ? 'text-on-primary' : 'text-ink'}`}>
                        {minutesLabel(m)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text className="text-[14px] text-muted">Sem horários livres neste dia.</Text>
            )}
          </>
        ) : null}
      </>
    );
    footer = (
      <>
        {day && time !== null ? (
          <Text className="mb-2 text-[13px] text-muted">
            {day.getDate()}/{String(day.getMonth() + 1).padStart(2, '0')} das {minutesLabel(time)} às{' '}
            {minutesLabel(time + duration)}
          </Text>
        ) : null}
        <Button title="Continuar" onPress={() => setStep('details')} disabled={!day || time === null} />
      </>
    );
  } else if (step === 'details') {
    body = (
      <>
        <StepHeader labels={stepLabels} current={stepIndex('details')} onBack={() => setStep('date')} />
        <View className="mb-4 rounded-card border border-line bg-surface p-4">
          <Text className="text-[15px] font-semibold text-ink">{selected.map((s) => s.name).join(' + ')}</Text>
          <Text className="mt-0.5 text-[13px] text-muted">
            {day && time !== null
              ? `${WEEKDAYS_LONG[day.getDay()]}, ${day.getDate()}/${String(day.getMonth() + 1).padStart(2, '0')} às ${minutesLabel(time)}`
              : ''}{' '}
            · {formatDuration(duration)} · {formatBRL(total)}
          </Text>
          {area ? (
            <Text className="mt-0.5 text-[12px] text-muted">
              Em domicílio · {area.name}
              {travelFee ? ` · inclui ${formatBRL(travelFee)} de deslocamento` : ''}
            </Text>
          ) : null}
        </View>
        <Text className="mb-1.5 text-[13px] font-medium text-muted">Nome completo</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Seu nome"
          placeholderTextColor={colors.muted}
          autoComplete="name"
          className="mb-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink"
        />
        <Text className="mb-1.5 text-[13px] font-medium text-muted">WhatsApp</Text>
        <TextInput
          value={phone}
          onChangeText={(t) => setPhone(maskPhone(t))}
          placeholder="(11) 90000-0000"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          autoComplete="tel"
          className="mb-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink"
        />
        {home ? (
          <>
            <Text className="mb-1.5 text-[13px] font-medium text-muted">Endereço do atendimento</Text>
            <View className="mb-3 flex-row gap-2">
              <TextInput
                value={street}
                onChangeText={setStreet}
                placeholder="Rua / avenida"
                placeholderTextColor={colors.muted}
                autoComplete="street-address"
                className="flex-1 rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink"
              />
              <TextInput
                value={number}
                onChangeText={setNumber}
                placeholder="Nº"
                placeholderTextColor={colors.muted}
                className="w-20 rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink"
              />
            </View>
            <TextInput
              value={complement}
              onChangeText={setComplement}
              placeholder="Complemento / ponto de referência (opcional)"
              placeholderTextColor={colors.muted}
              className="mb-1 rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink"
            />
            <Text className="mb-3 text-[12px] text-muted">Bairro: {area?.name}</Text>
          </>
        ) : null}
        <Text className="mb-1.5 text-[13px] font-medium text-muted">Observação (opcional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Ex: quero fazer francesinha"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={500}
          className="min-h-[80px] rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink"
          style={{ textAlignVertical: 'top' }}
        />
        {error ? (
          <View className="mt-3 rounded-2xl bg-[#F8E9EA] px-4 py-3">
            <Text className="text-[13px] text-[#B2474F]">{error}</Text>
          </View>
        ) : null}
        <Text className="mt-3 text-[11px] leading-4 text-muted">
          {home
            ? 'Seu nome, WhatsApp e endereço são usados só pelo estúdio para confirmar e realizar o atendimento.'
            : 'Seu nome e WhatsApp são usados só pelo estúdio para confirmar o atendimento.'}
        </Text>
      </>
    );
    footer = (
      <Button
        title={sending ? 'Agendando…' : 'Confirmar agendamento'}
        onPress={confirm}
        disabled={!nameOk || !phoneOk || !addressOk || sending}
      />
    );
  } else if (booked) {
    // Data e hora no relógio do estúdio
    const { day: start, minutes: startMin } = zonedParts(new Date(booked.starts_at), tz);
    const when = `${WEEKDAYS_LONG[start.getDay()]}, ${start.getDate()}/${String(start.getMonth() + 1).padStart(2, '0')} às ${minutesLabel(startMin)}`;
    const serviceNames = selected.map((s) => s.name).join(' + ');
    const confirmed = booked.status === 'confirmado';
    const place = home && area ? `${serviceAddress} – ${area.name}` : address;

    const addToCalendar = () => {
      const ics = buildIcs(booked, `${serviceNames} · ${studio.business_name}`, place);
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
        a.download = 'agendamento.ics';
        a.click();
      }
    };
    const googleCalendar = () => {
      const url =
        'https://calendar.google.com/calendar/render?action=TEMPLATE' +
        `&text=${encodeURIComponent(`${serviceNames} · ${studio.business_name}`)}` +
        `&dates=${icsDate(booked.starts_at)}/${icsDate(booked.ends_at)}` +
        `&location=${encodeURIComponent(place)}`;
      Linking.openURL(url);
    };
    const whatsappStudio = () => {
      const text = `Olá! Acabei de agendar ${serviceNames} para ${when.toLowerCase()} pelo link online. Meu nome é ${name.trim()}.`;
      const digits = onlyDigits(studio.phone ?? '');
      Linking.openURL(`https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}?text=${encodeURIComponent(text)}`);
    };

    body = (
      <View className="items-center pt-2">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-status-confirmado-bg">
          <Ionicons name="checkmark" size={34} color={statusInfo.confirmado.color} />
        </View>
        <Text className="mt-4 text-center text-[22px] font-bold text-ink">
          {confirmed ? 'Horário confirmado!' : 'Pedido de horário enviado!'}
        </Text>
        <Text className="mt-1 text-center text-[14px] leading-5 text-muted">
          {confirmed
            ? 'Te esperamos no dia e horário abaixo.'
            : 'O estúdio vai confirmar seu horário em breve pelo WhatsApp.'}
        </Text>
        <View className="mt-5 w-full rounded-card border border-line bg-surface p-4">
          <Text className="text-[15px] font-semibold text-ink">{serviceNames}</Text>
          <Text className="mt-1 text-[14px] text-ink">{when}</Text>
          <Text className="text-[13px] text-muted">
            {formatDuration(duration)} · {formatBRL(Number(booked.total_price))}
          </Text>
          {place ? (
            <Text className="mt-2 text-[12px] text-muted">
              {home ? '🏠 Em domicílio: ' : '📍 '}
              {place}
            </Text>
          ) : null}
        </View>
      </View>
    );
    footer = (
      <View className="gap-2">
        <Button title="Adicionar ao meu calendário" icon="calendar-outline" variant="secondary" onPress={addToCalendar} />
        <Text className="-mt-1 text-center text-[12px] text-primary-dark" onPress={googleCalendar}>
          ou adicionar no Google Agenda
        </Text>
        {studio.phone ? (
          <Button
            title="Confirmar via WhatsApp com o estúdio"
            icon="logo-whatsapp"
            variant="whatsapp"
            onPress={whatsappStudio}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg" style={brandVars}>
      <Stack.Screen options={{ title: pageTitle }} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 28, paddingBottom: 200, paddingHorizontal: 20 }}>
        {/* Coluna central no computador; ocupa a tela toda no celular */}
        <View className="w-full self-center" style={{ maxWidth: 520 }}>
          {header}
          {body}
          {step === 'done' && studio.phone ? (
            <Text className="mt-6 text-center text-[12px] text-muted">
              Dúvidas? WhatsApp do estúdio: {formatPhone(studio.phone)}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      {footer ? (
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-line bg-surface px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 14) }}>
          <View className="w-full self-center" style={{ maxWidth: 520 }}>
            {footer}
          </View>
        </View>
      ) : null}
    </View>
  );
}

