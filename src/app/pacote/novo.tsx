import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderKeyboardView } from '@/components/keyboard-view';
import { Avatar, Button, Chip, Field, SectionLabel } from '@/components/ui';
import { useStore } from '@/data/store';
import { closeModal, notify } from '@/lib/confirm';
import { addDays, formatDateShort, startOfDay } from '@/lib/dates';
import { formatBRL, formatPhone, maskBRL, normalize, onlyDigits } from '@/lib/format';
import { activeFees, feeFor } from '@/lib/packages';
import { colors, paymentLabels } from '@/theme/colors';
import type { PaymentMethod } from '@/types';

const SESSIONS = [4, 5, 6, 8, 10];
const METHODS: PaymentMethod[] = ['pix', 'credito', 'debito', 'dinheiro'];
const VALIDITY = [
  { days: 0, label: 'Sem validade' },
  { days: 60, label: '60 dias' },
  { days: 90, label: '90 dias' },
  { days: 180, label: '6 meses' },
];

const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function VenderPacote() {
  const params = useLocalSearchParams<{ clientId?: string }>();
  const insets = useSafeAreaInsets();
  const { clients, services, profile, sellPackage } = useStore();

  const [clientId, setClientId] = useState(params.clientId);
  const [query, setQuery] = useState('');
  // Serviços do pacote (andam juntos: cada visita tem todos eles e usa 1 sessão)
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState(4);
  const [customSessions, setCustomSessions] = useState('');
  const [discountMode, setDiscountMode] = useState<'percent' | 'value'>('percent');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountValue, setDiscountValue] = useState(0);
  const [name, setName] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [validity, setValidity] = useState(0);
  const [saving, setSaving] = useState(false);

  const client = clients.find((c) => c.id === clientId);
  const chosen = serviceIds
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);
  const perSession = chosen.reduce((t, s) => t + s.price, 0);
  const fullPrice = Math.round(perSession * sessions * 100) / 100;
  // Desconto em % ou em R$, nunca maior que o valor cheio
  const discount = Math.min(
    fullPrice,
    discountMode === 'percent'
      ? Math.round(fullPrice * Math.min(Number(discountPercent) || 0, 100)) / 100
      : discountValue,
  );
  const total = Math.max(0, Math.round((fullPrice - discount) * 100) / 100);
  const fee = feeFor(total, method, activeFees(profile));
  const servicesLabel = chosen.map((s) => s.name).join(' + ');
  const autoName = chosen.length ? `Pacote ${sessions}x ${servicesLabel}` : '';

  function toggleService(id: string) {
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }
  const expiresAt = validity ? addDays(startOfDay(new Date()), validity) : null;

  const q = normalize(query);
  const qDigits = onlyDigits(query);
  const matches = clients
    .filter((c) => !c.removed)
    .filter((c) => !q || normalize(c.name).includes(q) || (qDigits && c.whatsapp?.includes(qDigits)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, q ? 20 : 6);

  const canSave = !!client && chosen.length > 0 && sessions > 0 && total >= 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const ok = await sellPackage({
      clientId: client!.id,
      serviceIds: chosen.map((s) => s.id),
      name: name.trim() || autoName,
      totalSessions: sessions,
      totalPaid: total,
      paymentMethod: method,
      expiresAt: expiresAt ? toISODate(expiresAt) : undefined,
    });
    setSaving(false);
    if (!ok) return;
    notify('Pacote vendido', `${formatBRL(total)} foi lançado no Financeiro de hoje.`);
    closeModal();
  }

  return (
    <HeaderKeyboardView>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        {/* Cliente */}
        <SectionLabel>Cliente</SectionLabel>
        {client ? (
          <Pressable accessibilityRole="button"
            onPress={() => !params.clientId && setClientId(undefined)}
            className="flex-row items-center rounded-card border border-primary bg-primary-soft p-3">
            <Avatar name={client.name} />
            <View className="ml-3 flex-1">
              <Text className="text-[15px] font-semibold text-ink">{client.name}</Text>
              <Text className="text-xs text-muted">{formatPhone(client.whatsapp)}</Text>
            </View>
            {!params.clientId ? <Text className="text-[13px] font-medium text-primary-dark">Trocar</Text> : null}
          </Pressable>
        ) : (
          <View>
            <View className="mb-2 flex-row items-center rounded-2xl border border-line bg-surface px-3">
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar cliente"
                placeholderTextColor={colors.muted}
                className="flex-1 px-2 py-3 text-[15px] text-ink"
              />
            </View>
            <View className="overflow-hidden rounded-card border border-line bg-surface">
              {matches.map((c, i) => (
                <Pressable accessibilityRole="button"
                  key={c.id}
                  onPress={() => setClientId(c.id)}
                  className={`flex-row items-center px-3 py-2.5 active:bg-bg ${i ? 'border-t border-line' : ''}`}>
                  <Avatar name={c.name} size={32} />
                  <Text className="ml-3 flex-1 text-[15px] text-ink">{c.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Serviços */}
        <SectionLabel>Serviços do pacote</SectionLabel>
        <Text className="mb-2 text-[13px] leading-5 text-muted">
          Escolha um ou mais. Em cada visita a cliente faz todos eles, e o pacote desconta 1 sessão.
        </Text>
        <View className="flex-row flex-wrap">
          {services
            .filter((s) => s.active)
            .map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                sublabel={formatBRL(s.price)}
                selected={serviceIds.includes(s.id)}
                onPress={() => toggleService(s.id)}
              />
            ))}
        </View>

        {/* Sessões */}
        <SectionLabel>Quantidade de sessões</SectionLabel>
        <View className="flex-row flex-wrap items-center">
          {SESSIONS.map((n) => (
            <Chip
              key={n}
              label={`${n} sessões`}
              selected={!customSessions && sessions === n}
              onPress={() => {
                setCustomSessions('');
                setSessions(n);
              }}
            />
          ))}
          <TextInput
            value={customSessions}
            onChangeText={(t) => {
              const v = onlyDigits(t).slice(0, 2);
              setCustomSessions(v);
              if (Number(v) > 0) setSessions(Number(v));
            }}
            placeholder="Outro"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            className={`mb-2 w-20 rounded-full border px-4 py-2 text-center text-sm text-ink ${
              customSessions ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
            }`}
          />
        </View>

        {/* Desconto */}
        <SectionLabel>Desconto</SectionLabel>
        <View className="flex-row items-center">
          <Chip label="%" selected={discountMode === 'percent'} onPress={() => setDiscountMode('percent')} />
          <Chip label="R$" selected={discountMode === 'value'} onPress={() => setDiscountMode('value')} />
          {discountMode === 'percent' ? (
            <TextInput
              accessibilityLabel="Desconto em porcentagem"
              value={discountPercent}
              onChangeText={(t) => setDiscountPercent(String(Math.min(Number(onlyDigits(t).slice(0, 3)) || 0, 100) || ''))}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              className="mb-2 ml-1 flex-1 rounded-2xl border border-line bg-surface px-4 py-2.5 text-[17px] font-semibold text-ink"
            />
          ) : (
            <TextInput
              accessibilityLabel="Desconto em reais"
              value={formatBRL(discountValue)}
              onChangeText={(t) => setDiscountValue(maskBRL(t).value)}
              keyboardType="number-pad"
              className="mb-2 ml-1 flex-1 rounded-2xl border border-line bg-surface px-4 py-2.5 text-[17px] font-semibold text-ink"
            />
          )}
        </View>

        {/* Valor */}
        {chosen.length ? (
          <View className="mt-1 rounded-card border border-line bg-surface p-4">
            <View className="flex-row justify-between">
              <Text className="text-[13px] text-muted">Valor cheio ({sessions}x {formatBRL(perSession)})</Text>
              <Text className="text-[13px] text-muted">{formatBRL(fullPrice)}</Text>
            </View>
            {discount ? (
              <View className="mt-1 flex-row justify-between">
                <Text className="text-[13px] text-muted">
                  Desconto{discountMode === 'percent' && discountPercent ? ` (${discountPercent}%)` : ''}
                </Text>
                <Text className="text-[13px] text-muted">− {formatBRL(discount)}</Text>
              </View>
            ) : null}
            <View className="mt-2 flex-row justify-between border-t border-line pt-2">
              <Text className="text-[15px] font-semibold text-ink">Total do pacote</Text>
              <Text className="text-[15px] font-semibold text-ink">{formatBRL(total)}</Text>
            </View>
            {sessions ? (
              <Text className="mt-1 text-right text-xs text-muted">{formatBRL(total / sessions)} por sessão</Text>
            ) : null}
          </View>
        ) : null}

        {/* Pagamento */}
        <SectionLabel>Forma de pagamento</SectionLabel>
        <View className="flex-row flex-wrap">
          {METHODS.map((m) => (
            <Chip key={m} label={paymentLabels[m]} selected={method === m} onPress={() => setMethod(m)} />
          ))}
        </View>
        {fee > 0 ? (
          <Text className="text-[13px] text-muted">
            Taxa da maquininha: {formatBRL(fee)} · você recebe {formatBRL(total - fee)}
          </Text>
        ) : null}

        {/* Validade */}
        <SectionLabel>Validade</SectionLabel>
        <View className="flex-row flex-wrap">
          {VALIDITY.map((v) => (
            <Chip key={v.days} label={v.label} selected={validity === v.days} onPress={() => setValidity(v.days)} />
          ))}
        </View>
        {expiresAt ? <Text className="text-[13px] text-muted">Vence em {formatDateShort(expiresAt)}</Text> : null}

        <View className="mt-4">
          <Field label="Nome do pacote" value={name} onChangeText={setName} placeholder={autoName || 'Ex: Combo 4 manutenções'} />
        </View>
      </ScrollView>

      <View
        className="border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="mb-2 flex-row justify-between">
          <Text className="text-[13px] text-muted">
            {sessions} {sessions === 1 ? 'sessão' : 'sessões'}
            {chosen.length ? ` de ${servicesLabel}` : ''}
          </Text>
          <Text className="text-[15px] font-semibold text-ink">{formatBRL(total)}</Text>
        </View>
        <Button title={saving ? 'Salvando…' : 'Vender pacote'} loading={saving} onPress={save} disabled={!canSave} />
      </View>
    </HeaderKeyboardView>
  );
}
