import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar, Button, Card, SectionLabel, StatusPill } from '@/components/ui';
import { useStore } from '@/data/store';
import { notify } from '@/lib/confirm';
import { formatDayTitle, formatDuration, formatTime } from '@/lib/dates';
import { formatBRL, formatPhone } from '@/lib/format';
import { buildVars, composeEmailHtml, emailProvider, fillTemplate, sendWhatsApp } from '@/services/messaging';
import { colors, paymentLabels, statusInfo } from '@/theme/colors';
import type { AppointmentStatus, PaymentMethod } from '@/types';

const STATUSES: AppointmentStatus[] = ['pendente', 'confirmado', 'concluido', 'cancelado'];
const METHODS: PaymentMethod[] = ['pix', 'credito', 'debito', 'dinheiro'];

export default function AgendamentoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { appointments, clients, templates, profile, transactions, setAppointmentStatus, completeAppointment } =
    useStore();
  const [askPayment, setAskPayment] = useState(false);

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

  function onStatus(s: AppointmentStatus) {
    if (s === 'concluido') {
      setAskPayment(true);
      return;
    }
    setAskPayment(false);
    setAppointmentStatus(appt!.id, s);
  }

  async function whatsapp(kind: 'lembrete' | 'confirmacao' | 'recibo') {
    const tpl = templates.find((t) => t.channel === 'whatsapp' && t.kind === kind)!;
    try {
      await sendWhatsApp(tpl, appt!, client!, profile);
    } catch (e) {
      notify('Não foi possível abrir o WhatsApp', e instanceof Error ? e.message : undefined);
    }
  }

  async function email() {
    if (!client!.email) {
      notify('Cliente sem e-mail', 'Cadastre um e-mail na ficha da cliente.');
      return;
    }
    const tpl = templates.find((t) => t.channel === 'email' && t.kind === 'confirmacao')!;
    const vars = buildVars(appt!, client!, profile);
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
        <View className="my-3 h-px bg-line" />
        {appt.services.map((s) => (
          <View key={s.serviceId} className="mb-1.5 flex-row justify-between">
            <Text className="text-[14px] text-ink">{s.name}</Text>
            <Text className="text-[14px] text-muted">{formatBRL(s.price)}</Text>
          </View>
        ))}
        <View className="mt-1.5 flex-row justify-between">
          <Text className="text-[15px] font-semibold text-ink">Total</Text>
          <Text className="text-[15px] font-semibold text-ink">{formatBRL(appt.totalPrice)}</Text>
        </View>
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
            {formatBRL(appt.totalPrice)} será lançado como receita no Financeiro.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {METHODS.map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  completeAppointment(appt.id, m);
                  setAskPayment(false);
                }}
                className="min-w-[46%] flex-1 items-center rounded-2xl bg-primary py-3 active:opacity-80">
                <Text className="text-[14px] font-semibold text-white">{paymentLabels[m]}</Text>
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

      {/* Mensagens */}
      <SectionLabel>Mensagens</SectionLabel>
      <View className="gap-2">
        {appt.status === 'concluido' ? (
          <Button title="Enviar recibo no WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={() => whatsapp('recibo')} />
        ) : (
          <Button title="Enviar lembrete no WhatsApp" icon="logo-whatsapp" variant="whatsapp" onPress={() => whatsapp('lembrete')} />
        )}
        {appt.status !== 'concluido' ? (
          <Button title="Enviar confirmação no WhatsApp" icon="chatbubble-outline" variant="secondary" onPress={() => whatsapp('confirmacao')} />
        ) : null}
        <Button title="Enviar por e-mail" icon="mail-outline" variant="secondary" onPress={email} />
      </View>
    </ScrollView>
  );
}
