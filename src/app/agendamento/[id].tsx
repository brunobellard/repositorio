import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { SeriesScopeSheet } from '@/components/sheet';
import { Avatar, Button, Card, SectionLabel, StatusPill } from '@/components/ui';
import {
  describeRRule,
  hasOpenSiblings,
  type SeriesScope,
  seriesTargets,
  sessionPosition,
} from '@/lib/recurrence';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { requireFeature } from '@/lib/upgrade';
import { confirmAction, notify } from '@/lib/confirm';
import { amountDue, packageCovered } from '@/lib/packages';
import { formatDayTitle, formatDuration, formatTime } from '@/lib/dates';
import { formatBRL, formatPhone } from '@/lib/format';
import { buildVars, composeEmailHtml, emailProvider, fillTemplate, sendWhatsApp } from '@/services/messaging';
import { colors, paymentLabels, statusInfo } from '@/theme/colors';
import type { AppointmentStatus, PaymentMethod } from '@/types';

const STATUSES: AppointmentStatus[] = ['pendente', 'confirmado', 'concluido', 'cancelado'];
const METHODS: PaymentMethod[] = ['pix', 'credito', 'debito', 'dinheiro'];

export default function AgendamentoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    appointments,
    clients,
    templates,
    profile,
    transactions,
    setAppointmentStatus,
    completeAppointment,
    cancelAppointments,
    packages,
  } = useStore();
  const access = usePlanAccess();
  const [askPayment, setAskPayment] = useState(false);
  const [askCancelScope, setAskCancelScope] = useState(false);
  // Forma de pagamento sendo processada ('pacote' para sessão de pacote): trava toques repetidos
  const [completing, setCompleting] = useState<PaymentMethod | 'pacote' | null>(null);

  const appt = appointments.find((a) => a.id === id);
  const client = clients.find((c) => c.id === appt?.clientId);
  if (!appt || !client) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Agendamento não encontrado.</Text>
      </View>
    );
  }

  const start = new Date(appt.startsAt);
  const duration = appt.services.reduce((t, s) => t + s.durationMin, 0);
  const income = transactions.find((t) => t.appointmentId === appt.id);
  const pkg = packages.find((p) => p.id === appt.clientPackageId);
  // O pacote paga uma sessão do serviço dele; outros serviços e o deslocamento são cobrados à parte
  const covered = packageCovered(appt, packages);
  const due = amountDue(appt, packages);

  /** Conclui uma vez só (trava toques repetidos) e vibra de leve ao terminar. */
  async function finish(method?: PaymentMethod) {
    if (completing) return;
    setCompleting(method ?? 'pacote');
    const ok = await completeAppointment(appt!.id, method);
    setCompleting(null);
    if (!ok) return;
    setAskPayment(false);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  function onStatus(s: AppointmentStatus) {
    if (completing) return;
    if (s === 'concluido') {
      if (appt!.status === 'concluido') return;
      // Pacote cobre tudo: conclui direto e dá baixa no crédito. Sobrou valor: pergunta a forma de pagamento
      if (appt!.clientPackageId && due === 0) {
        finish();
        return;
      }
      setAskPayment(true);
      return;
    }
    setAskPayment(false);
    if (s === appt!.status) return;
    // Desfazer uma conclusão apaga a receita do Financeiro (e devolve o crédito do pacote): confirma antes
    if (appt!.status === 'concluido') {
      const undo = [
        income ? `a receita de ${formatBRL(income.amount)} sai do Financeiro` : '',
        pkg ? 'a sessão volta para o saldo do pacote' : '',
      ].filter(Boolean);
      confirmAction(
        'Desfazer a conclusão?',
        undo.length
          ? `O atendimento deixa de estar concluído e ${undo.join(' e ')}.`
          : 'O atendimento deixa de estar concluído.',
        () => changeStatus(s),
        'Desfazer',
      );
      return;
    }
    changeStatus(s);
  }

  function changeStatus(s: Exclude<AppointmentStatus, 'concluido'>) {
    // Cancelar uma sessão de série: pergunta se cancela também as próximas
    if (s === 'cancelado' && appt!.status !== 'cancelado' && hasOpenSiblings(appt!, appointments)) {
      setAskCancelScope(true);
      return;
    }
    setAppointmentStatus(appt!.id, s);
  }

  async function cancelSeries(scope: SeriesScope) {
    setAskCancelScope(false);
    if (scope === 'one') return setAppointmentStatus(appt!.id, 'cancelado');
    const ids = seriesTargets(appt!, appointments, scope);
    const ok = await cancelAppointments(ids);
    if (ok) notify('Sessões canceladas', `${ids.length} ${ids.length === 1 ? 'sessão cancelada' : 'sessões canceladas'}.`);
  }

  const editable = appt.status !== 'concluido' && appt.status !== 'cancelado';
  const repeatLabel = describeRRule(appt.recurrenceRule, start);
  const position = sessionPosition(appt, appointments);

  async function whatsapp(kind: 'lembrete' | 'confirmacao' | 'recibo') {
    const tpl = templates.find((t) => t.channel === 'whatsapp' && t.kind === kind)!;
    try {
      await sendWhatsApp(tpl, appt!, client!, profile, packages);
    } catch (e) {
      notify('Não foi possível abrir o WhatsApp', e instanceof Error ? e.message : undefined);
    }
  }

  async function email() {
    if (!requireFeature(access.hasAutoEmail, 'autoEmail')) return;
    if (!client!.email) {
      notify('Cliente sem e-mail', 'Cadastre um e-mail na ficha da cliente.');
      return;
    }
    const tpl = templates.find((t) => t.channel === 'email' && t.kind === 'confirmacao')!;
    const vars = buildVars(appt!, client!, profile, packages);
    await emailProvider.send(
      client!.email,
      fillTemplate(tpl.subject ?? '', vars),
      composeEmailHtml(profile, fillTemplate(tpl.body, vars)),
    );
    notify('E-mail simulado', 'O envio real será ativado ao conectar o Resend.');
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      {/* Cliente */}
      <Pressable
        onPress={() => router.push({ pathname: '/clientes/[id]', params: { id: client.id } })}
        className="flex-row items-center">
        <Avatar name={client.name} size={52} />
        <View className="ml-3 flex-1">
          <Text className="text-xl font-bold text-ink">{client.name}</Text>
          <Text className="text-[13px] text-muted">{formatPhone(client.whatsapp)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      {/* Resumo */}
      <Card className="mt-5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[15px] font-semibold text-ink">{formatDayTitle(start)}</Text>
            <Text className="text-[13px] text-muted">
              {formatTime(start)} – {formatTime(appt.endsAt)} · {formatDuration(duration)}
            </Text>
          </View>
          <StatusPill status={appt.status} size="md" />
        </View>
        {appt.source === 'online' ? (
          <View className="mt-3 flex-row items-center rounded-xl bg-bg px-3 py-2">
            <Ionicons name="globe-outline" size={15} color={colors.primaryDark} />
            <Text className="ml-2 flex-1 text-[13px] text-ink">
              Agendado pela cliente no link online
              {appt.status === 'pendente' ? ' · confirme abaixo' : ''}
            </Text>
          </View>
        ) : null}
        {pkg ? (
          <View className="mt-3 flex-row items-center rounded-xl bg-status-confirmado-bg px-3 py-2">
            <Ionicons name="ticket-outline" size={15} color={statusInfo.confirmado.color} />
            <Text className="ml-2 flex-1 text-[13px] text-status-confirmado">
              Pago com pacote · {pkg.name} · {pkg.usedSessions} de {pkg.totalSessions} usadas
            </Text>
          </View>
        ) : null}
        {appt.recurrenceGroupId ? (
          <View className="mt-3 flex-row items-center rounded-xl bg-primary-soft px-3 py-2">
            <Ionicons name="repeat" size={15} color={colors.primaryDark} />
            <Text className="ml-2 flex-1 text-[13px] text-primary-dark">
              {[repeatLabel ?? 'Agendamento recorrente', position].filter(Boolean).join(' · ')}
              {appt.isRecurrenceException ? ' · alterada nesta sessão' : ''}
            </Text>
          </View>
        ) : null}
        <View className="my-3 h-px bg-line" />
        {appt.services.map((s) => (
          <View key={s.serviceId} className="mb-1.5 flex-row justify-between">
            <Text className="text-[14px] text-ink">{s.name}</Text>
            <Text className="text-[14px] text-muted">{formatBRL(s.price)}</Text>
          </View>
        ))}
        {covered > 0 ? (
          <View className="mb-1.5 flex-row justify-between">
            <Text className="text-[14px] text-primary-dark">Crédito do pacote</Text>
            <Text className="text-[14px] text-primary-dark">− {formatBRL(covered)}</Text>
          </View>
        ) : null}
        {appt.travelFee ? (
          <View className="mb-1.5 flex-row justify-between">
            <Text className="text-[14px] text-ink">Taxa de deslocamento</Text>
            <Text className="text-[14px] text-muted">{formatBRL(appt.travelFee)}</Text>
          </View>
        ) : null}
        <View className="mt-1.5 flex-row justify-between">
          <Text className="text-[15px] font-semibold text-ink">{appt.clientPackageId ? 'A receber' : 'Total'}</Text>
          <Text className="text-[15px] font-semibold text-ink">{formatBRL(due)}</Text>
        </View>
        {appt.locationType === 'home_service' ? (
          <Pressable
            onPress={() =>
              appt.serviceAddress &&
              Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(appt.serviceAddress)}`)
            }
            className="mt-3 flex-row items-start rounded-xl bg-primary-soft p-3 active:opacity-70">
            <Ionicons name="home-outline" size={16} color={colors.primaryDark} style={{ marginTop: 1 }} />
            <View className="ml-2 flex-1">
              <Text className="text-[13px] font-semibold text-primary-dark">Atendimento a domicílio</Text>
              <Text className="text-[13px] text-primary-dark">{appt.serviceAddress || 'Endereço não informado'}</Text>
              {appt.serviceAddress ? (
                <Text className="mt-0.5 text-[12px] font-medium text-primary-dark underline">Abrir no mapa</Text>
              ) : null}
            </View>
          </Pressable>
        ) : null}
        {appt.notes ? (
          <View className="mt-3 rounded-xl bg-bg p-3">
            <Text className="text-[13px] text-muted">{appt.notes}</Text>
          </View>
        ) : null}
        {client.technicalNotes ? (
          <View className="mt-3 flex-row rounded-xl bg-primary-soft p-3">
            <Ionicons name="sparkles-outline" size={15} color={colors.primaryDark} />
            <Text className="ml-2 flex-1 text-[13px] text-primary-dark">{client.technicalNotes}</Text>
          </View>
        ) : null}
      </Card>

      {editable ? (
        <View className="mt-3">
          <Button
            title="Editar horário ou serviços"
            icon="create-outline"
            variant="secondary"
            onPress={() => router.push({ pathname: '/agendamento/novo', params: { editId: appt.id } })}
          />
        </View>
      ) : null}

      {/* Status */}
      <SectionLabel>Status</SectionLabel>
      <View className="flex-row flex-wrap gap-2">
        {STATUSES.map((s) => {
          const info = statusInfo[s];
          const active = askPayment ? s === 'concluido' : appt.status === s;
          return (
            <Pressable
              key={s}
              onPress={() => onStatus(s)}
              style={{
                backgroundColor: active ? info.bg : colors.surface,
                borderColor: active ? info.color : colors.line,
              }}
              className="min-w-[46%] flex-1 flex-row items-center rounded-2xl border px-3 py-3">
              <View className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: info.color }} />
              <Text className="text-[14px] font-semibold" style={{ color: active ? info.color : colors.ink }}>
                {info.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {askPayment && appt.status !== 'concluido' ? (
        <Card className="mt-3">
          <Text className="text-[14px] font-semibold text-ink">Forma de pagamento</Text>
          <Text className="mb-3 text-xs text-muted">
            {formatBRL(due)} será lançado como receita no Financeiro
            {pkg ? ' (o restante já foi pago no pacote)' : ''}.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {METHODS.map((m) => (
              <Pressable
                key={m}
                disabled={!!completing}
                onPress={() => finish(m)}
                className={`min-w-[46%] flex-1 flex-row items-center justify-center rounded-2xl bg-primary py-3 active:opacity-80 ${
                  completing && completing !== m ? 'opacity-40' : ''
                }`}>
                {completing === m ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} style={{ marginRight: 6 }} />
                ) : null}
                <Text className="text-[14px] font-semibold text-on-primary">{paymentLabels[m]}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      {appt.status === 'concluido' && income ? (
        <View className="mt-3 flex-row items-center rounded-2xl bg-status-concluido-bg px-4 py-3">
          <Ionicons name="checkmark-circle" size={18} color={statusInfo.concluido.color} />
          <Text className="ml-2 flex-1 text-[13px] text-status-concluido">
            Receita lançada: {formatBRL(income.amount)}
            {income.paymentMethod ? ` · ${paymentLabels[income.paymentMethod]}` : ''}
          </Text>
        </View>
      ) : null}

      {/* Atendimento concluído: comprovante em destaque */}
      {appt.status === 'concluido' ? (
        <View className="mt-3">
          <Button
            title="Enviar comprovante"
            icon="receipt-outline"
            onPress={() => router.push({ pathname: '/agendamento/recibo', params: { id: appt.id } })}
          />
        </View>
      ) : null}

      {/* Mensagens */}
      <SectionLabel>Mensagens</SectionLabel>
      <View className="gap-2">
        {appt.status === 'concluido' ? (
          <Button title="Agradecimento no WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={() => whatsapp('recibo')} />
        ) : (
          <Button title="Enviar lembrete no WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={() => whatsapp('lembrete')} />
        )}
        {appt.status !== 'concluido' ? (
          <Button title="Enviar confirmação no WhatsApp" icon="chatbubble-outline" variant="secondary" onPress={() => whatsapp('confirmacao')} />
        ) : null}
        <Button title="Enviar por e-mail" icon="mail-outline" variant="secondary" onPress={email} />
      </View>

      <SeriesScopeSheet
        visible={askCancelScope}
        action="cancelar"
        counts={{
          one: 1,
          following: seriesTargets(appt, appointments, 'following').length,
          all: seriesTargets(appt, appointments, 'all').length,
        }}
        onChoose={cancelSeries}
        onClose={() => setAskCancelScope(false)}
      />
    </ScrollView>
  );
}
