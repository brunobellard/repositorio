import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { ExportClientsSheet } from '@/components/export-sheets';
import { ClientsSkeleton } from '@/components/skeleton';
import { Avatar, EmptyState, Fab, Screen, ScreenTitle, SearchBar } from '@/components/ui';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { requireFeature } from '@/lib/upgrade';
import { notify } from '@/lib/confirm';
import { formatDateShort, MONTHS } from '@/lib/dates';
import { formatPhone, normalize } from '@/lib/format';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { birthdaysThisMonth, clientsToRecall, fillClientMessage, templateFor } from '@/lib/recall';
import { whatsappProvider } from '@/services/messaging';
import { colors } from '@/theme/colors';
import type { Client } from '@/types';

type Filter = 'todas' | 'retorno' | 'aniversario';

function FilterChip({ label, count, active, onPress }: { label: string; count?: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!(active) }}
      onPress={onPress}
      className={`mr-2 flex-row items-center rounded-full border px-3.5 py-1.5 ${
        active ? 'border-primary bg-primary' : 'border-line bg-surface'
      }`}>
      <Text className={`text-[13px] font-semibold ${active ? 'text-on-primary' : 'text-ink'}`}>{label}</Text>
      {count !== undefined ? (
        <View className={`ml-1.5 min-w-[18px] items-center rounded-full px-1 ${active ? 'bg-white/25' : 'bg-primary-soft'}`}>
          <Text className={`text-[11px] font-bold ${active ? 'text-on-primary' : 'text-primary-dark'}`}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Botão discreto de WhatsApp dentro do card */
function WhatsAppButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Enviar mensagem no WhatsApp"
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      className={`h-9 w-9 items-center justify-center rounded-full bg-[#E7F5EC] active:opacity-60 ${
        disabled ? 'opacity-30' : ''
      }`}>
      <Ionicons name="logo-whatsapp" size={18} color="#1C7A4B" />
    </Pressable>
  );
}

export default function ClientesScreen() {
  const { clients: allClients, appointments, clientHistory, profile, templates, loading, refresh } = useStore();
  // Clientes removidas (só histórico) não aparecem na lista, na contagem nem no retorno
  const clients = allClients.filter((c) => !c.removed);
  const access = usePlanAccess();
  const { refreshing, onRefresh } = usePullToRefresh(refresh);
  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('todas');
  const [exporting, setExporting] = useState(false);

  const exportButton = (
    <Pressable accessibilityRole="button"
      onPress={() => requireFeature(access.hasExport, 'export') && setExporting(true)}
      accessibilityLabel="Exportar base de clientes"
      className="flex-row items-center rounded-full border border-line bg-surface px-3 py-1.5 active:opacity-70">
      <Ionicons name="download-outline" size={14} color={colors.ink} />
      <Text className="ml-1 text-[13px] font-semibold text-ink">Exportar</Text>
    </Pressable>
  );

  const now = new Date();
  const recall = clientsToRecall(clients, appointments, profile.recallDays, now, clientHistory);
  const birthdays = birthdaysThisMonth(clients, now);

  const q = normalize(query.trim());
  const digits = query.replace(/\D/g, '');
  const matches = (c: Client) =>
    !q || normalize(c.name).includes(q) || (!!digits && !!c.whatsapp?.includes(digits));

  const nowIso = now.toISOString();
  function lastVisit(clientId: string) {
    return appointments
      .filter((a) => a.clientId === clientId && a.status === 'concluido' && a.startsAt < nowIso)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0]?.startsAt;
  }

  async function sendWhatsApp(client: Client, text: string) {
    if (!client.whatsapp) return notify('Cliente sem WhatsApp', 'Cadastre o número na ficha da cliente.');
    try {
      await whatsappProvider.send(client.whatsapp, text);
    } catch {
      notify('Não foi possível abrir o WhatsApp');
    }
  }

  const open = (id: string) => router.push({ pathname: '/clientes/[id]', params: { id } });
  const rowClass = (index: number, length: number) =>
    `flex-row items-center bg-surface px-4 py-3 active:bg-bg ${
      index === 0 ? 'rounded-t-card' : 'border-t border-line'
    } ${index === length - 1 ? 'rounded-b-card' : ''}`;

  const header = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
        <FilterChip label="Todas" active={filter === 'todas'} onPress={() => setFilter('todas')} />
        <FilterChip
          label="Para chamar de volta"
          count={recall.length}
          active={filter === 'retorno'}
          onPress={() => requireFeature(access.hasRetentionCRM, 'retentionCRM') && setFilter('retorno')}
        />
        <FilterChip
          label={`Aniversariantes de ${MONTHS[now.getMonth()].toLowerCase()}`}
          count={birthdays.length}
          active={filter === 'aniversario'}
          onPress={() => requireFeature(access.hasRetentionCRM, 'retentionCRM') && setFilter('aniversario')}
        />
      </ScrollView>
      {filter === 'retorno' ? (
        <Text className="mb-3 text-[12px] leading-4 text-muted">
          Sem atendimento há mais de {profile.recallDays} dias e sem horário marcado.{' '}
          <Text className="font-semibold text-primary-dark" onPress={() => router.push('/ajustes/retorno')}>
            Ajustar prazo
          </Text>
        </Text>
      ) : null}
    </View>
  );

  // Primeiro carregamento (sem cópia no aparelho): esqueleto da busca + lista
  if (loading) {
    return (
      <Screen>
        <ScreenTitle title="Clientes" subtitle="Carregando…" />
        <ClientsSkeleton />
      </Screen>
    );
  }

  if (filter === 'retorno') {
    const list = recall.filter((r) => matches(r.client));
    return (
      <Screen>
        <ScreenTitle title="Clientes" subtitle={`${clients.length} cadastradas`} right={exportButton} />
        <ExportClientsSheet visible={exporting} onClose={() => setExporting(false)} />
        <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar por nome ou telefone" />
        <FlatList
          data={list}
          keyExtractor={(r) => r.client.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          refreshControl={refreshControl}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyState
              icon="sparkles-outline"
              text="Tudo em dia! Nenhuma cliente sumida no momento"
              subtitle={`Quem passar de ${profile.recallDays} dias sem voltar aparece aqui.`}
            />
          }
          renderItem={({ item: r, index }) => (
            <Pressable accessibilityRole="button" onPress={() => open(r.client.id)} className={rowClass(index, list.length)}>
              <Avatar name={r.client.name} />
              <View className="ml-3 flex-1">
                <Text className="text-[15px] font-semibold text-ink">{r.client.name}</Text>
                <Text numberOfLines={2} className="text-xs text-muted">
                  Última visita há <Text className="font-semibold text-ink">{r.days} dias</Text> · {r.lastService}
                </Text>
              </View>
              <WhatsAppButton
                disabled={!r.client.whatsapp}
                onPress={() =>
                  sendWhatsApp(
                    r.client,
                    fillClientMessage(templateFor('reativacao', templates).body, r.client, profile, {
                      dias: r.days,
                      ultimo_servico: r.lastService,
                    }),
                  )
                }
              />
            </Pressable>
          )}
        />
      </Screen>
    );
  }

  if (filter === 'aniversario') {
    const list = birthdays.filter((b) => matches(b.client));
    return (
      <Screen>
        <ScreenTitle title="Clientes" subtitle={`${clients.length} cadastradas`} right={exportButton} />
        <ExportClientsSheet visible={exporting} onClose={() => setExporting(false)} />
        <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar por nome ou telefone" />
        <FlatList
          data={list}
          keyExtractor={(b) => b.client.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          refreshControl={refreshControl}
          ListHeaderComponent={header}
          ListEmptyComponent={<EmptyState icon="gift-outline" text="Nenhuma aniversariante este mês" />}
          renderItem={({ item: b, index }) => (
            <Pressable accessibilityRole="button" onPress={() => open(b.client.id)} className={rowClass(index, list.length)}>
              <View
                className={`h-10 w-10 items-center justify-center rounded-full ${
                  b.isToday ? 'bg-primary' : 'bg-primary-soft'
                }`}>
                <Text className={`text-[15px] font-bold ${b.isToday ? 'text-on-primary' : 'text-primary-dark'}`}>
                  {b.day}
                </Text>
              </View>
              <View className={`ml-3 flex-1 ${b.isPast ? 'opacity-50' : ''}`}>
                <Text className="text-[15px] font-semibold text-ink">{b.client.name}</Text>
                <Text className="text-xs text-muted">
                  {b.isToday ? '🎂 Hoje! · ' : ''}
                  {String(b.day).padStart(2, '0')}/{String(now.getMonth() + 1).padStart(2, '0')}
                  {b.age ? ` · ${b.isPast || b.isToday ? 'fez' : 'faz'} ${b.age} anos` : ''}
                </Text>
              </View>
              <WhatsAppButton
                disabled={!b.client.whatsapp}
                onPress={() =>
                  sendWhatsApp(b.client, fillClientMessage(templateFor('aniversario', templates).body, b.client, profile))
                }
              />
            </Pressable>
          )}
        />
      </Screen>
    );
  }

  const list = clients.filter(matches).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Screen>
      <ScreenTitle title="Clientes" subtitle={`${clients.length} cadastradas`} right={exportButton} />
      <ExportClientsSheet visible={exporting} onClose={() => setExporting(false)} />
      <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar por nome ou telefone" />
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
          refreshControl={refreshControl}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            text={query.trim() ? 'Nenhuma cliente encontrada' : 'Nenhuma cliente cadastrada ainda'}
            subtitle={query.trim() ? `Nada com "${query.trim()}".` : undefined}
            actionLabel="Cadastrar nova cliente"
            onAction={() => router.push({ pathname: '/clientes/nova', params: { name: /\d/.test(query) ? '' : query.trim() } })}
          />
        }
        renderItem={({ item: c, index }) => {
          const last = lastVisit(c.id);
          return (
            <Pressable accessibilityRole="button" onPress={() => open(c.id)} className={rowClass(index, list.length)}>
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
      {/* Nova cliente: sempre à mão, como o "+" da Agenda */}
      <Fab label="Nova cliente" onPress={() => router.push('/clientes/nova')} />
    </Screen>
  );
}
