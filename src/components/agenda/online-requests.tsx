// UX-07: pedidos feitos pelo link público que ainda esperam a profissional (faixa na Agenda + lista).
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { useStore } from '@/data/store';
import { notify } from '@/lib/confirm';
import { formatDayTitle, formatTime } from '@/lib/dates';
import { colors } from '@/theme/colors';
import type { Appointment } from '@/types';

/** Pedidos online pendentes que ainda não acabaram, do mais próximo ao mais distante. */
export function pendingOnlineRequests(appointments: Appointment[]): Appointment[] {
  const now = new Date().getTime();
  return appointments
    .filter((a) => a.source === 'online' && a.status === 'pendente' && new Date(a.endsAt).getTime() > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Faixa "N pedidos pelo link aguardando você"; tocar abre a lista com Confirmar / Recusar. */
export function OnlineRequestsBanner() {
  const { appointments, clients, setAppointmentStatus } = useStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const pending = pendingOnlineRequests(appointments);
  if (!pending.length && !open) return null;

  const nameOf = (a: Appointment) => clients.find((c) => c.id === a.clientId)?.name ?? 'Cliente';

  async function answer(a: Appointment, status: 'confirmado' | 'cancelado') {
    if (busy) return;
    setBusy(a.id);
    const ok = await setAppointmentStatus(a.id, status);
    setBusy(null);
    if (!ok) return;
    notify(status === 'confirmado' ? 'Agendamento confirmado' : 'Pedido recusado', nameOf(a).split(' ')[0]);
    if (pending.length <= 1) setOpen(false);
  }

  const n = pending.length;
  return (
    <>
      {n ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${n} ${n === 1 ? 'pedido' : 'pedidos'} pelo link aguardando você. Toque para ver.`}
          onPress={() => setOpen(true)}
          className="mx-4 mt-3 flex-row items-center rounded-card border border-primary bg-primary-soft px-4 py-3 active:opacity-70">
          <Ionicons name="globe-outline" size={18} color={colors.primaryDark} />
          <Text className="ml-2 flex-1 text-[14px] font-semibold text-primary-dark">
            {n} {n === 1 ? 'pedido pelo link aguardando você' : 'pedidos pelo link aguardando você'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
        </Pressable>
      ) : null}

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Pedidos pelo link"
        subtitle="Confirme para avisar a cliente pelo WhatsApp depois, ou recuse se não puder atender.">
        <ScrollView style={{ maxHeight: 420 }}>
          {pending.map((a) => {
            const start = new Date(a.startsAt);
            return (
              <View key={a.id} className="mb-2 rounded-2xl border border-line bg-bg p-3">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir pedido de ${nameOf(a)}`}
                  onPress={() => {
                    setOpen(false);
                    router.push({ pathname: '/agendamento/[id]', params: { id: a.id } });
                  }}>
                  <Text className="text-[15px] font-semibold text-ink">{nameOf(a)}</Text>
                  <Text className="text-[13px] text-muted">
                    {formatDayTitle(start)} às {formatTime(start)} · {a.services.map((s) => s.name).join(' + ')}
                  </Text>
                </Pressable>
                <View className="mt-2 flex-row gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Confirmar pedido de ${nameOf(a)}`}
                    disabled={!!busy}
                    onPress={() => answer(a, 'confirmado')}
                    className={`flex-1 items-center rounded-xl bg-primary py-2.5 active:opacity-80 ${busy && busy !== a.id ? 'opacity-40' : ''}`}>
                    <Text className="text-[14px] font-semibold text-on-primary">Confirmar</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Recusar pedido de ${nameOf(a)}`}
                    disabled={!!busy}
                    onPress={() => answer(a, 'cancelado')}
                    className="flex-1 items-center rounded-xl border border-line bg-surface py-2.5 active:opacity-70">
                    <Text className="text-[14px] font-medium text-[#B2474F]">Recusar</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={() => setOpen(false)} className="mt-1 items-center py-3">
          <Text className="text-[15px] font-medium text-muted">Fechar</Text>
        </Pressable>
      </Sheet>
    </>
  );
}
