// Página pública (sem login) para a cliente confirmar ou cancelar o horário.
// O link vai na mensagem de confirmação/lembrete do WhatsApp: /confirmar/<código do agendamento>.
// Acesso ao banco só pelas funções public_appointment e respond_public_appointment.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { vars } from 'nativewind';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { MONTHS } from '@/lib/dates';
import { initials, onlyDigits } from '@/lib/format';
import { formatAddress, WEEKDAYS_LONG } from '@/lib/hours';
import { supabase } from '@/lib/supabase';
import { DEFAULT_TIMEZONE, minutesLabel, zonedParts } from '@/lib/timezone';
import { colors } from '@/theme/colors';
import { DEFAULT_THEME_COLOR, deriveTheme, themeVars } from '@/theme/palette';
import type { AppointmentStatus, Profile } from '@/types';

interface PublicAppointment {
  business_name: string;
  logo_url: string | null;
  phone: string | null;
  theme_color: string | null;
  timezone: string | null;
  address_street: string | null;
  address_number: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  client_first_name: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  location_type: 'fixed' | 'home_service';
  service_address: string | null;
  services: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Respostas do banco que não são confirmado/cancelado */
const REFUSED: Record<string, string> = {
  passou: 'Este horário já passou. Para remarcar, fale com o estúdio.',
  concluido: 'Este atendimento já foi concluído.',
  nao_encontrado: 'Não encontramos este agendamento. Confira o link com o estúdio.',
};

export default function ConfirmarHorario() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [appt, setAppt] = useState<PublicAppointment | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<'confirmar' | 'cancelar' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Hora em que a página abriu (o banco confere de novo ao responder)
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token || !UUID.test(token)) {
        setNotFound(true);
        return;
      }
      const { data, error } = await supabase.rpc('public_appointment', { p_token: token });
      if (cancelled) return;
      if (error || !data) setNotFound(true);
      else setAppt(data as PublicAppointment);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (notFound) {
    return (
      <View className="flex-1 items-center justify-center bg-bg px-8">
        <Stack.Screen options={{ title: 'Link não encontrado' }} />
        <Ionicons name="link-outline" size={36} color={colors.muted} />
        <Text className="mt-3 text-lg font-semibold text-ink">Link não encontrado</Text>
        <Text className="mt-1 text-center text-[14px] text-muted">
          Confira o endereço com o estúdio. O agendamento pode ter sido removido.
        </Text>
      </View>
    );
  }
  if (!appt) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  const a = appt;

  // Cor do estúdio, não a de quem está vendo a página
  const brandVars = vars(themeVars(deriveTheme(a.theme_color ?? DEFAULT_THEME_COLOR)));
  const tz = a.timezone || DEFAULT_TIMEZONE;
  const start = zonedParts(new Date(a.starts_at), tz);
  const end = zonedParts(new Date(a.ends_at), tz);
  const dateLabel = `${WEEKDAYS_LONG[start.day.getDay()]}, ${start.day.getDate()} de ${MONTHS[start.day.getMonth()].toLowerCase()}`;
  const timeLabel = `${minutesLabel(start.minutes)} às ${minutesLabel(end.minutes)}`;
  const place =
    a.location_type === 'home_service'
      ? `No seu endereço${a.service_address ? `: ${a.service_address}` : ''}`
      : formatAddress({
          addressStreet: a.address_street ?? undefined,
          addressNumber: a.address_number ?? undefined,
          addressDistrict: a.address_district ?? undefined,
          addressCity: a.address_city ?? undefined,
          addressState: a.address_state ?? undefined,
        } as Profile);
  const past = new Date(a.starts_at).getTime() <= now;
  const open = !past && (a.status === 'pendente' || a.status === 'confirmado');
  const phone = onlyDigits(a.phone ?? '');

  async function respond(action: 'confirmar' | 'cancelar') {
    setBusy(action);
    setMessage(null);
    const { data, error } = await supabase.rpc('respond_public_appointment', { p_token: token, p_action: action });
    setBusy(null);
    if (error) {
      setMessage('Não foi possível responder agora. Confira a internet e tente de novo.');
      return;
    }
    const result = String(data);
    if (result === 'confirmado' || result === 'cancelado') {
      setAppt({ ...a, status: result });
      return;
    }
    setMessage(REFUSED[result] ?? 'Não foi possível responder. Fale com o estúdio.');
  }

  function askCancel() {
    confirmAction(
      'Cancelar o horário?',
      `${dateLabel}, ${minutesLabel(start.minutes)}. O estúdio será avisado na agenda.`,
      () => respond('cancelar'),
      'Cancelar horário',
    );
  }

  return (
    <View className="flex-1 items-center bg-bg px-6 pt-12" style={brandVars}>
      <Stack.Screen options={{ title: `Seu horário · ${a.business_name}` }} />
      <View className="w-full max-w-[420px] items-center">
        {a.logo_url ? (
          <Image source={{ uri: a.logo_url }} style={{ width: 64, height: 64, borderRadius: 18 }} contentFit="cover" />
        ) : (
          <View className="h-16 w-16 items-center justify-center rounded-[18px] bg-primary-soft">
            <Text className="text-xl font-bold text-primary-dark">{initials(a.business_name)}</Text>
          </View>
        )}
        <Text className="mt-3 text-center text-lg font-semibold text-ink">{a.business_name}</Text>
        <Text className="mt-1 text-center text-[15px] text-muted">Olá, {a.client_first_name}! Este é o seu horário:</Text>

        <View className="mt-5 w-full rounded-card border border-line bg-surface p-4">
          <Row icon="calendar-outline" text={dateLabel} />
          <Row icon="time-outline" text={timeLabel} />
          <Row icon="sparkles-outline" text={a.services.join(' + ')} />
          {place ? <Row icon="location-outline" text={place} /> : null}
        </View>

        {/* Situação */}
        {a.status === 'confirmado' ? (
          <Banner icon="checkmark-circle" tone="ok" text="Horário confirmado. Até lá!" />
        ) : a.status === 'cancelado' ? (
          <Banner icon="close-circle" tone="muted" text="Este horário foi cancelado." />
        ) : a.status === 'concluido' ? (
          <Banner icon="checkmark-done-circle" tone="muted" text="Atendimento concluído. Obrigada pela visita!" />
        ) : past ? (
          <Banner icon="time" tone="muted" text="Este horário já passou." />
        ) : null}
        {message ? <Text className="mt-3 text-center text-[14px] text-[#B4443A]">{message}</Text> : null}

        {open ? (
          <View className="mt-5 w-full gap-3">
            {a.status === 'pendente' ? (
              <Button
                title={busy === 'confirmar' ? 'Confirmando…' : 'Confirmar presença'}
                icon="checkmark-circle-outline"
                loading={busy === 'confirmar'}
                disabled={!!busy}
                onPress={() => respond('confirmar')}
              />
            ) : null}
            <Button
              title={busy === 'cancelar' ? 'Cancelando…' : 'Não vou poder ir · cancelar'}
              icon="close-circle-outline"
              variant="secondary"
              loading={busy === 'cancelar'}
              disabled={!!busy}
              onPress={askCancel}
            />
          </View>
        ) : null}

        {phone ? (
          <View className="mt-3 w-full">
            <Button
              title="Falar com o estúdio"
              icon="logo-whatsapp"
              variant="whatsapp"
              onPress={() =>
                Linking.openURL(
                  `https://wa.me/${phone.length <= 11 ? `55${phone}` : phone}?text=${encodeURIComponent(`Olá! Sobre meu horário de ${dateLabel.toLowerCase()} às ${minutesLabel(start.minutes)}.`)}`,
                )
              }
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-start py-1.5">
      <Ionicons name={icon} size={18} color={colors.muted} style={{ marginTop: 1 }} />
      <Text className="ml-3 flex-1 text-[15px] leading-5 text-ink">{text}</Text>
    </View>
  );
}

function Banner({ icon, text, tone }: { icon: keyof typeof Ionicons.glyphMap; text: string; tone: 'ok' | 'muted' }) {
  const color = tone === 'ok' ? '#2E7D4F' : colors.muted;
  return (
    <View className={`mt-4 w-full flex-row items-center rounded-2xl px-4 py-3 ${tone === 'ok' ? 'bg-[#E7F4EC]' : 'bg-surface'}`}>
      <Ionicons name={icon} size={20} color={color} />
      <Text className="ml-2 flex-1 text-[15px] font-medium" style={{ color }}>
        {text}
      </Text>
    </View>
  );
}
