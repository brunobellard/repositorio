import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Avatar, EmptyState, Screen, ScreenTitle, SearchBar } from '@/components/ui';
import { useStore } from '@/data/store';
import { formatDateShort } from '@/lib/dates';
import { formatPhone, normalize } from '@/lib/format';
import { colors } from '@/theme/colors';

export default function ClientesScreen() {
  const { clients, appointments } = useStore();
  const [query, setQuery] = useState('');

  const q = normalize(query.trim());
  const digits = query.replace(/\D/g, '');
  const list = clients
    .filter((c) => !q || normalize(c.name).includes(q) || (!!digits && !!c.whatsapp?.includes(digits)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const now = new Date().toISOString();
  function lastVisit(clientId: string) {
    const past = appointments
      .filter((a) => a.clientId === clientId && a.status === 'concluido' && a.startsAt < now)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return past[0]?.startsAt;
  }

  return (
    <Screen>
      <ScreenTitle title="Clientes" subtitle={`${clients.length} cadastradas`} />
      <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar por nome ou telefone" />
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        ListEmptyComponent={<EmptyState icon="people-outline" text="Nenhuma cliente encontrada" />}
        renderItem={({ item: c, index }) => {
          const last = lastVisit(c.id);
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/clientes/[id]', params: { id: c.id } })}
              className={`flex-row items-center bg-surface px-4 py-3 active:bg-bg ${
                index === 0 ? 'rounded-t-card' : 'border-t border-line'
              } ${index === list.length - 1 ? 'rounded-b-card' : ''}`}>
              <Avatar name={c.name} />
              <View className="ml-3 flex-1">
                <Text className="text-[15px] font-semibold text-ink">{c.name}</Text>
                <Text className="text-xs text-muted">
                  {formatPhone(c.whatsapp)}
                  {last ? ` · última visita ${formatDateShort(last)}` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
