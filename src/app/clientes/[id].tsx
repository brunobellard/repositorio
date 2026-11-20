import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Avatar, Button, Card, EmptyState, SectionLabel, StatusPill } from '@/components/ui';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { confirmAction, notify } from '@/lib/confirm';
import { requireFeature } from '@/lib/upgrade';
import { formatDateShort, formatTime } from '@/lib/dates';
import { formatBRL, formatPhone } from '@/lib/format';
import { amountDue, availableCredits, isExpired, scheduledSessions } from '@/lib/packages';
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
  const { clients, appointments, packages, services, profile, deleteClient, historyFrom, ensureFullHistory, clientHistory } =
    useStore();
  const access = usePlanAccess();
  const [loadingOlder, setLoadingOlder] = useState(false);
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
  const clientPackages = packages.filter((p) => p.clientId === client.id);
  // Sessões de pacote já foram pagas na venda: conta o valor do pacote e só os extras de cada sessão.
  // Com só os últimos 12 meses carregados, conta também só os pacotes vendidos nesse período
  // (antes somava pacotes de todos os tempos com atendimentos de 12 meses)
  const spent =
    done.reduce((t, a) => t + amountDue(a, packages), 0) +
    clientPackages
      .filter((p) => !historyFrom || new Date(p.createdAt) >= new Date(historyFrom))
      .reduce((t, p) => t + p.totalPaid, 0);
  // Atendimentos no banco, inclusive os mais antigos que não estão carregados
  const hasHistory = history.length > 0 || (clientHistory[client.id]?.appointments ?? 0) > 0;

  const c = client;
  function askDelete() {
    const open = history.filter(
      (a) => (a.status === 'pendente' || a.status === 'confirmado') && new Date(a.endsAt) > new Date(),
    );
    if (open.length) {
      notify(
        'Há atendimentos marcados',
        `${c.name} tem ${open.length === 1 ? '1 atendimento marcado' : `${open.length} atendimentos marcados`}. Cancele ou conclua antes de excluir.`,
        'info',
      );
      return;
    }
    if (!hasHistory) {
      confirmAction(
        'Excluir cliente?',
        clientPackages.length
          ? `${c.name} e os pacotes dela serão excluídos. Os valores já recebidos continuam no Financeiro. Não dá para desfazer.`
          : `${c.name} será excluída. Não dá para desfazer.`,
        async () => {
          const r = await deleteClient(c.id);
          if (r) {
            // 'anonymized': o banco achou atendimentos antigos e apagou só os dados pessoais
            notify(r === 'anonymized' ? 'Dados da cliente apagados' : 'Cliente excluída');
            router.back();
          }
        },
        'Excluir',
      );
      return;
    }
    confirmAction(
      'Apagar dados da cliente?',
      `${c.name} tem atendimentos no histórico, que precisam continuar na agenda e no Financeiro. O nome, o WhatsApp, o e-mail, o nascimento, o endereço e as anotações serão apagados, e ela passará a aparecer como "Cliente removida". Não dá para desfazer.`,
      async () => {
        const r = await deleteClient(c.id);
        if (r) {
          notify('Dados da cliente apagados');
          router.back();
        }
      },
      'Apagar dados',
    );
  }

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
          <Text className="text-xs text-muted">{historyFrom ? 'Atendimentos (12 meses)' : 'Atendimentos'}</Text>
          <Text className="text-xl font-bold text-ink">{done.length}</Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-xs text-muted">{historyFrom ? 'Gasto (12 meses)' : 'Total gasto'}</Text>
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

      <View className="mb-2 mt-5 flex-row items-center justify-between">
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted">Pacotes</Text>
        <Pressable accessibilityRole="button"
          onPress={() =>
            requireFeature(access.hasPackages, 'packages') &&
            router.push({ pathname: '/pacote/novo', params: { clientId: client.id } })
          }
          className="py-1 active:opacity-60">
          <Text className="text-[13px] font-semibold text-primary-dark">+ Vender pacote</Text>
        </Pressable>
      </View>
      {clientPackages.length ? (
        <Card className="py-1">
          {clientPackages.map((p, i) => {
            const credits = availableCredits(p, appointments);
            const scheduled = scheduledSessions(p, appointments);
            const expired = isExpired(p);
            return (
              <Pressable accessibilityRole="button"
                key={p.id}
                onPress={() => router.push({ pathname: '/pacote/editar', params: { id: p.id } })}
                className={`py-3 active:opacity-60 ${i ? 'border-t border-line' : ''}`}>
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[14px] font-medium text-ink" numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text
                    className={`ml-2 text-[12px] font-semibold ${
                      p.status === 'completed' || expired ? 'text-muted' : 'text-status-confirmado'
                    }`}>
                    {p.status === 'completed' ? 'Concluído' : expired ? 'Vencido' : 'Ativo'}
                  </Text>
                </View>
                {/* Barra de progresso das sessões usadas */}
                <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                  <View
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(p.usedSessions / p.totalSessions) * 100}%` }}
                  />
                </View>
                <Text className="mt-1.5 text-xs text-muted">
                  {p.usedSessions} de {p.totalSessions} sessões usadas
                  {scheduled ? ` · ${scheduled} agendada${scheduled > 1 ? 's' : ''}` : ''}
                  {p.status === 'active' && !expired ? ` · ${credits} para agendar` : ''}
                </Text>
                <Text className="text-xs text-muted">
                  {services.find((s) => s.id === p.serviceId)?.name ?? 'Serviço'} · {formatBRL(p.totalPaid)}
                  {p.expiresAt ? ` · vence ${p.expiresAt.split('-').reverse().join('/')}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <Text className="text-[13px] text-muted">Nenhum pacote. Venda sessões antecipadas com desconto.</Text>
      )}

      <SectionLabel>Dados</SectionLabel>
      <Card>
        <Info icon="logo-whatsapp" label="WhatsApp" value={formatPhone(client.whatsapp)} />
        <Info icon="mail-outline" label="E-mail" value={client.email} />
        <Info icon="gift-outline" label="Nascimento" value={birth} />
        {profile.serviceMode !== 'fixed' || client.address ? (
          <Info
            icon="home-outline"
            label="Endereço"
            value={[client.address, client.neighborhood].filter(Boolean).join(' – ')}
          />
        ) : null}
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
            <Pressable accessibilityRole="button"
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
              <Text className="text-[14px] font-medium text-ink">
                {a.clientPackageId
                  ? amountDue(a, packages) > 0
                    ? `Pacote + ${formatBRL(amountDue(a, packages))}`
                    : 'Pacote'
                  : formatBRL(a.totalPrice)}
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : (
        <EmptyState icon="time-outline" text="Sem atendimentos ainda" />
      )}
      {historyFrom ? (
        // O app abre com os últimos 12 meses; o restante vem quando pedido
        <Pressable accessibilityRole="button"
          disabled={loadingOlder}
          onPress={async () => {
            setLoadingOlder(true);
            await ensureFullHistory();
            setLoadingOlder(false);
          }}
          className="mt-2 self-center py-2 active:opacity-60">
          <Text className="text-[13px] font-medium text-primary-dark">
            {loadingOlder
              ? 'Carregando…'
              : `Mostrando desde ${formatDateShort(historyFrom)}/${new Date(historyFrom).getFullYear()} · ver histórico completo`}
          </Text>
        </Pressable>
      ) : null}

      <View className="mt-6 gap-3">
        <Button
          title="Editar dados"
          icon="create-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: '/clientes/nova', params: { id: client.id } })}
        />
        <Button title="Excluir cliente" icon="trash-outline" variant="danger" onPress={askDelete} />
      </View>
    </ScrollView>
  );
}
