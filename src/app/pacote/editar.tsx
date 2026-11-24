import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderKeyboardView } from '@/components/keyboard-view';
import { Button, Card, Chip, Field, SectionLabel } from '@/components/ui';
import { useStore } from '@/data/store';
import { closeModal, confirmAction, notify } from '@/lib/confirm';
import { addDays, formatDateShort, startOfDay } from '@/lib/dates';
import { formatBRL, onlyDigits } from '@/lib/format';
import { packageServicesLabel, scheduledSessions } from '@/lib/packages';
import { colors, paymentLabels } from '@/theme/colors';

const VALIDITY = [
  { days: 60, label: '60 dias' },
  { days: 90, label: '90 dias' },
  { days: 180, label: '6 meses' },
];

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Corrige um pacote vendido (nome, sessões, validade) ou exclui um vendido por engano. */
export default function EditarPacote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { packages, appointments, clients, services, updatePackage, deletePackage } = useStore();
  const pkg = packages.find((p) => p.id === id);

  const [name, setName] = useState(pkg?.name ?? '');
  const [sessions, setSessions] = useState(String(pkg?.totalSessions ?? ''));
  const [expiresAt, setExpiresAt] = useState<string | undefined>(pkg?.expiresAt);
  const [saving, setSaving] = useState(false);

  if (!pkg) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <Text className="text-muted">Pacote não encontrado.</Text>
      </View>
    );
  }
  const p = pkg;

  const client = clients.find((c) => c.id === p.clientId);
  const servicesLabel = packageServicesLabel(p, services);
  const scheduled = scheduledSessions(p, appointments);
  // Não dá para ter menos sessões do que as já usadas e agendadas
  const minSessions = Math.max(1, p.usedSessions + scheduled);
  const total = Number(sessions) || 0;
  const sessionsOk = total >= minSessions && total <= 99;
  const canSave = !!name.trim() && sessionsOk && !saving;
  // Atendimentos (não cancelados) ligados ao pacote: com eles o pacote não pode sair
  const linked = appointments.filter((a) => a.clientPackageId === p.id && a.status !== 'cancelado');
  const sold = startOfDay(new Date(p.createdAt));

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const ok = await updatePackage(p.id, { name: name.trim(), totalSessions: total, expiresAt });
    if (!ok) {
      setSaving(false);
      return;
    }
    notify('Pacote atualizado');
    closeModal();
  }

  function askDelete() {
    if (linked.length) {
      notify(
        'Pacote em uso',
        `Há ${linked.length === 1 ? '1 sessão marcada ou feita' : `${linked.length} sessões marcadas ou feitas`} com este pacote, então ele não pode ser excluído. Você pode corrigir o nome, as sessões e a validade.`,
        'info',
      );
      return;
    }
    confirmAction(
      'Excluir pacote?',
      `O pacote e a receita da venda (${formatBRL(p.totalPaid)}) saem do Financeiro. Use quando o pacote foi vendido por engano ou devolvido. Não dá para desfazer.`,
      async () => {
        setSaving(true);
        const ok = await deletePackage(p.id);
        if (!ok) {
          setSaving(false);
          return;
        }
        notify('Pacote excluído');
        router.back();
      },
      'Excluir',
    );
  }

  return (
    <HeaderKeyboardView>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Text className="text-[15px] font-semibold text-ink">{client?.name ?? 'Cliente'}</Text>
          <Text className="mt-1 text-[13px] text-muted">
            {servicesLabel} · {formatBRL(p.totalPaid)} no {paymentLabels[p.paymentMethod]} · vendido em{' '}
            {formatDateShort(sold)}
          </Text>
          <Text className="mt-1 text-[13px] text-muted">
            {p.usedSessions} {p.usedSessions === 1 ? 'sessão usada' : 'sessões usadas'}
            {scheduled ? ` · ${scheduled} agendada${scheduled > 1 ? 's' : ''}` : ''}
          </Text>
        </Card>

        <View className="mt-4">
          <Field label="Nome do pacote" value={name} onChangeText={setName} placeholder="Ex: Combo 4 manutenções" />
        </View>

        <SectionLabel>Quantidade de sessões</SectionLabel>
        <TextInput
          value={sessions}
          onChangeText={(t) => setSessions(onlyDigits(t).slice(0, 2))}
          keyboardType="number-pad"
          placeholderTextColor={colors.muted}
          className={`w-28 rounded-2xl border bg-surface px-4 py-3 text-center text-[17px] text-ink ${
            sessionsOk ? 'border-line' : 'border-danger'
          }`}
        />
        <Text className="mt-1.5 text-[13px] text-muted">
          {sessionsOk
            ? 'O valor pago não muda.'
            : `Mínimo de ${minSessions} (sessões já usadas e agendadas).`}
        </Text>

        <SectionLabel>Validade</SectionLabel>
        <View className="flex-row flex-wrap">
          <Chip label="Sem validade" selected={!expiresAt} onPress={() => setExpiresAt(undefined)} />
          {VALIDITY.map((v) => {
            const date = toISODate(addDays(sold, v.days));
            return <Chip key={v.days} label={v.label} selected={expiresAt === date} onPress={() => setExpiresAt(date)} />;
          })}
          {expiresAt && !VALIDITY.some((v) => toISODate(addDays(sold, v.days)) === expiresAt) ? (
            <Chip label={`Atual: ${expiresAt.split('-').reverse().join('/')}`} selected onPress={() => {}} />
          ) : null}
        </View>
        <Text className="text-[13px] text-muted">
          {expiresAt ? `Vence em ${expiresAt.split('-').reverse().join('/')} (contado da venda)` : 'O pacote não vence.'}
        </Text>

        <View className="mt-6">
          <Button title="Excluir pacote" icon="trash-outline" variant="danger" onPress={askDelete} disabled={saving} />
        </View>
      </ScrollView>

      <View className="border-t border-line bg-surface px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Button title={saving ? 'Salvando…' : 'Salvar alterações'} loading={saving} onPress={save} disabled={!canSave} />
      </View>
    </HeaderKeyboardView>
  );
}
