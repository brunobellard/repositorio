import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';

import { Button, Card } from '@/components/ui';
import { useStore } from '@/data/store';
import { notify } from '@/lib/confirm';
import { formatBRL } from '@/lib/format';
import { colors } from '@/theme/colors';
import type { IconName } from '@/components/ui';
import type { PaymentFees } from '@/types';

const ROWS: { key: keyof PaymentFees; label: string; icon: IconName; hint: string }[] = [
  { key: 'debit', label: 'Débito', icon: 'card-outline', hint: 'Ex: 1,99' },
  { key: 'credit', label: 'Crédito à vista', icon: 'card', hint: 'Ex: 4,99' },
  { key: 'pix', label: 'Pix', icon: 'flash-outline', hint: 'Geralmente 0' },
  { key: 'cash', label: 'Dinheiro', icon: 'cash-outline', hint: 'Geralmente 0' },
];

const toText = (n: number) => (n ? String(n).replace('.', ',') : '');
/** "4,99" -> 4.99 (aceita vírgula ou ponto, até 2 casas, máximo 30%) */
const parse = (t: string) => {
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 30) : 0;
};

export default function TaxasPagamento() {
  const { profile, updatePaymentFees } = useStore();
  const [text, setText] = useState<Record<keyof PaymentFees, string>>({
    debit: toText(profile.paymentFees.debit),
    credit: toText(profile.paymentFees.credit),
    pix: toText(profile.paymentFees.pix),
    cash: toText(profile.paymentFees.cash),
  });
  const [saving, setSaving] = useState(false);

  const fees: PaymentFees = {
    debit: parse(text.debit),
    credit: parse(text.credit),
    pix: parse(text.pix),
    cash: parse(text.cash),
  };
  const dirty = (Object.keys(fees) as (keyof PaymentFees)[]).some((k) => fees[k] !== profile.paymentFees[k]);

  async function save() {
    setSaving(true);
    const ok = await updatePaymentFees(fees);
    setSaving(false);
    if (ok) notify('Taxas salvas', 'Valem para as próximas entradas no Financeiro.');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Text className="mb-4 text-[13px] leading-5 text-muted">
          Informe o percentual que a maquininha ou o banco desconta em cada forma de pagamento. O Financeiro passa
          a mostrar o valor bruto, a taxa e o lucro líquido real.
        </Text>

        <Card className="py-1">
          {ROWS.map((r, i) => (
            <View key={r.key} className={`flex-row items-center py-3 ${i ? 'border-t border-line' : ''}`}>
              <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-soft">
                <Ionicons name={r.icon} size={16} color={colors.primaryDark} />
              </View>
              <Text className="ml-3 flex-1 text-[15px] text-ink">{r.label}</Text>
              <TextInput
                value={text[r.key]}
                onChangeText={(t) => setText((s) => ({ ...s, [r.key]: t.replace(/[^\d,.]/g, '').slice(0, 5) }))}
                placeholder={r.hint}
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                className="w-24 rounded-xl border border-line bg-bg px-3 py-2 text-right text-[15px] text-ink"
              />
              <Text className="ml-1.5 text-[15px] text-muted">%</Text>
            </View>
          ))}
        </Card>

        <Text className="mt-3 text-[12px] leading-4 text-muted">
          Exemplo: numa venda de {formatBRL(100)} no crédito, a taxa seria {formatBRL(fees.credit)} e você recebe{' '}
          {formatBRL(100 - fees.credit)}. Lançamentos antigos mantêm a taxa da época.
        </Text>

        {dirty ? (
          <View className="mt-4">
            <Button title={saving ? 'Salvando…' : 'Salvar taxas'} onPress={save} disabled={saving} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
