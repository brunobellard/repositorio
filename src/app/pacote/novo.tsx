import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Chip, Field, SectionLabel } from '@/components/ui';
import { useStore } from '@/data/store';
import { closeModal, notify } from '@/lib/confirm';
import { addDays, formatDateShort, startOfDay } from '@/lib/dates';
import { formatBRL, formatPhone, maskBRL, normalize, onlyDigits } from '@/lib/format';
import { feeFor } from '@/lib/packages';
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
  const [serviceId, setServiceId] = useState<string | undefined>();
  const [sessions, setSessions] = useState(4);
  const [customSessions, setCustomSessions] = useState('');
  const [price, setPrice] = useState(0);
  const [priceTouched, setPriceTouched] = useState(false);
  const [name, setName] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [validity, setValidity] = useState(0);
  const [saving, setSaving] = useState(false);

  const client = clients.find((c) => c.id === clientId);
  const service = services.find((s) => s.id === serviceId);
  const fullPrice = service ? service.price * sessions : 0;
  // Sugere o preço cheio até a profissional digitar um valor com desconto
  const total = priceTouched ? price : fullPrice;
  const discount = fullPrice > total ? fullPrice - total : 0;
  const fee = feeFor(total, method, profile.paymentFees);
  const autoName = service ? `Pacote ${sessions}x ${service.name}` : '';
  const expiresAt = validity ? addDays(startOfDay(new Date()), validity) : null;

  const q = normalize(query);
  const qDigits = onlyDigits(query);
  const matches = clients
    .filter((c) => !q || normalize(c.name).includes(q) || (qDigits && c.whatsapp?.includes(qDigits)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, q ? 20 : 6);

  const canSave = !!client && !!service && sessions > 0 && total >= 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const ok = await sellPackage({
      clientId: client!.id,
      serviceId: service!.id,
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 170 }} keyboardShouldPersistTaps="handled">
        {/* Cliente */}
        <SectionLabel>Cliente</SectionLabel>
        {client ? (
          <Pressable
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
                <Pressable
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

        {/* Serviço */}
        <SectionLabel>Serviço do pacote</SectionLabel>
        <View className="flex-row flex-wrap">
          {services
            .filter((s) => s.active)
            .map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                sublabel={formatBRL(s.price)}
                selected={serviceId === s.id}
                onPress={() => setServiceId(s.id)}
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

        {/* Valor */}
        <SectionLabel>Valor total cobrado</SectionLabel>
        <TextInput
          value={formatBRL(total)}
          onChangeText={(t) => {
            setPriceTouched(true);
            setPrice(maskBRL(t).value);
          }}
          keyboardType="number-pad"
          className="rounded-2xl border border-line bg-surface px-4 py-3 text-[20px] font-semibold text-ink"
        />
        {service ? (
          <Text className="mt-1.5 text-[13px] text-muted">
            Avulso sairia {formatBRL(fullPrice)}
            {discount ? ` · desconto de ${formatBRL(discount)}` : ''}
            {sessions ? ` · ${formatBRL(total / sessions)} por sessão` : ''}
          </Text>
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
        className="absolute bottom-0 left-0 right-0 border-t border-line bg-surface px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <View className="mb-2 flex-row justify-between">
          <Text className="text-[13px] text-muted">
            {sessions} {sessions === 1 ? 'sessão' : 'sessões'}
            {service ? ` de ${service.name}` : ''}
          </Text>
          <Text className="text-[15px] font-semibold text-ink">{formatBRL(total)}</Text>
        </View>
        <Button title={saving ? 'Salvando…' : 'Vender pacote'} loading={saving} onPress={save} disabled={!canSave} />
      </View>
    </KeyboardAvoidingView>
  );
}
