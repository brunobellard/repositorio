import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, SectionLabel, StatusPill } from '@/components/ui';
import { useStore } from '@/data/store';
import { formatDateShort, formatTime } from '@/lib/dates';
import { formatBRL, formatPhone } from '@/lib/format';
import { colors } from '@/theme/colors';

function Info({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string }) {
  return (
    <View className="flex-row items-center py-2">
      <Ionicons name={icon} size={17} color={colors.muted} />
      <Text className="ml-3 w-28 text-[13px] text-muted">{label}</Text>
      <Text className="flex-1 text-[14px] text-ink">{value || '—'}</Text>
    </View>
  );
}

export default function FichaCliente() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clients, appointments } = useStore();
  const client = clients.find((c) => c.id === id);
  if (!client) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Cliente não encontrada.</Text>
      </View>
    );
  }

  const history = appointments
    .filter((a) => a.clientId === client.id)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const done = history.filter((a) => a.status === 'concluido');
  const spent = done.reduce((t, a) => t + a.totalPrice, 0);

  const birth = client.birthDate
    ? client.birthDate.split('-').reverse().join('/')
    : undefined;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <View className="items-center">
        <Avatar name={client.name} size={72} />
        <Text className="mt-3 text-xl font-bold text-ink">{client.name}</Text>
        <Text className="text-[13px] text-muted">{formatPhone(client.whatsapp)}</Text>
      </View>

      <View className="mt-5 flex-row gap-3">
        <Card className="flex-1">
          <Text className="text-xs text-muted">Atendimentos</Text>
          <Text className="text-xl font-bold text-ink">{done.length}</Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-xs text-muted">Total gasto</Text>
          <Text className="text-xl font-bold text-ink">{formatBRL(spent)}</Text>
        </Card>
      </View>

      <View className="mt-3 flex-row gap-2">
        <View className="flex-1">
          <Button
            title="WhatsApp"
            icon="logo-whatsapp"
            variant="whatsapp"
            disabled={!client.whatsapp}
            onPress={() => Linking.openURL(`https://wa.me/55${client.whatsapp}`)}
          />
        </View>
        <View className="flex-1">
          <Button
            title="Agendar"
            icon="add"
            onPress={() => router.push({ pathname: '/agendamento/novo', params: { clientId: client.id } })}
          />
        </View>
      </View>

      <SectionLabel>Dados</SectionLabel>
      <Card>
        <Info icon="logo-whatsapp" label="WhatsApp" value={formatPhone(client.whatsapp)} />
        <Info icon="mail-outline" label="E-mail" value={client.email} />
        <Info icon="gift-outline" label="Nascimento" value={birth} />
      </Card>

      <SectionLabel>Anotações técnicas</SectionLabel>
      <Card>
        <Text className="text-[14px] leading-5 text-ink">
          {client.technicalNotes || 'Nenhuma anotação ainda.'}
        </Text>
      </Card>

      <SectionLabel>Histórico</SectionLabel>
      {history.length ? (
        <Card className="py-1">
          {history.map((a, i) => (
            <Pressable
              key={a.id}
              onPress={() => router.push({ pathname: '/agendamento/[id]', params: { id: a.id } })}
              className={`flex-row items-center py-3 ${i ? 'border-t border-line' : ''}`}>
              <View className="w-14">
                <Text className="text-[14px] font-semibold text-ink">{formatDateShort(a.startsAt)}</Text>
                <Text className="text-xs text-muted">{formatTime(a.startsAt)}</Text>
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} className="text-[14px] text-ink">
                  {a.services.map((s) => s.name).join(' + ')}
                </Text>
                <View className="mt-1">
                  <StatusPill status={a.status} />
                </View>
              </View>
              <Text className="text-[14px] font-medium text-ink">{formatBRL(a.totalPrice)}</Text>
            </Pressable>
          ))}
        </Card>
      ) : (
        <EmptyState icon="time-outline" text="Sem atendimentos ainda" />
      )}
    </ScrollView>
  );
}
