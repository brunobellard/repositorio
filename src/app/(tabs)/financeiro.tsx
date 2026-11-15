import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ExportFinanceSheet } from '@/components/export-sheets';
import { Card, EmptyState, Fab, Screen, ScreenTitle, SectionLabel, Segmented } from '@/components/ui';
import { useStore } from '@/data/store';
import { formatDateShort, formatTime, isSameDay, startOfDay, startOfWeek } from '@/lib/dates';
import { formatBRL } from '@/lib/format';
import { colors, paymentLabels } from '@/theme/colors';

type Period = 'hoje' | 'semana' | 'mes';

function Stat({ label, value, tone, hint }: { label: string; value: number; tone?: 'pos' | 'neg'; hint?: string }) {
  return (
    <Card className="mb-3 w-[48%]">
      <Text className="text-xs text-muted">{label}</Text>
      <Text
        className="mt-1 text-lg font-bold"
        style={{ color: tone === 'neg' ? '#B2474F' : tone === 'pos' ? '#5E8B6A' : colors.ink }}>
        {formatBRL(value)}
      </Text>
      {hint ? <Text className="mt-0.5 text-[11px] text-muted">{hint}</Text> : null}
    </Card>
  );
}

export default function FinanceiroScreen() {
  const { transactions } = useStore();
  const [period, setPeriod] = useState<Period>('semana');
  const [exporting, setExporting] = useState(false);

  const now = new Date();
  const today = startOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const inMonth = transactions.filter((t) => new Date(t.occurredAt) >= monthStart);
  const sum = (
    list: typeof transactions,
    type: 'receita' | 'despesa',
    field: 'amount' | 'netAmount' | 'feeAmount' = 'amount',
  ) => list.filter((t) => t.type === type).reduce((s, t) => s + t[field], 0);

  const dayIncome = sum(transactions.filter((t) => isSameDay(new Date(t.occurredAt), today)), 'receita');
  const monthIncome = sum(inMonth, 'receita');
  const monthExpense = sum(inMonth, 'despesa');
  // Lucro líquido real: receitas já descontadas as taxas de maquininha, menos despesas
  const monthFees = sum(inMonth, 'receita', 'feeAmount');
  const monthNet = sum(inMonth, 'receita', 'netAmount') - monthExpense;

  const from = period === 'hoje' ? today : period === 'semana' ? startOfWeek(now) : monthStart;
  const filtered = transactions
    .filter((t) => new Date(t.occurredAt) >= from)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <Screen>
      <ScreenTitle
        title="Financeiro"
        subtitle="Resumo do mês"
        right={
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setExporting(true)}
              accessibilityLabel="Exportar relatório"
              className="flex-row items-center rounded-full border border-line bg-surface px-3 py-1.5 active:opacity-70">
              <Ionicons name="download-outline" size={14} color={colors.ink} />
              <Text className="ml-1 text-[13px] font-semibold text-ink">Exportar</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/pacote/novo')}
              accessibilityLabel="Vender pacote"
              className="flex-row items-center rounded-full border border-line bg-surface px-3 py-1.5 active:opacity-70">
              <Ionicons name="ticket-outline" size={14} color={colors.ink} />
              <Text className="ml-1 text-[13px] font-semibold text-ink">Pacote</Text>
            </Pressable>
          </View>
        }
      />
      <ExportFinanceSheet visible={exporting} onClose={() => setExporting(false)} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }}>
        <View className="flex-row flex-wrap justify-between">
          <Stat label="Faturamento do dia" value={dayIncome} />
          <Stat label="Faturamento do mês" value={monthIncome} />
          <Stat label="Despesas do mês" value={monthExpense} tone="neg" />
          <Stat
            label="Lucro líquido real"
            value={monthNet}
            tone={monthNet >= 0 ? 'pos' : 'neg'}
            hint={monthFees ? `já sem ${formatBRL(monthFees)} de taxas` : undefined}
          />
        </View>

        <SectionLabel>Transações</SectionLabel>
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'hoje', label: 'Hoje' },
            { value: 'semana', label: 'Esta semana' },
            { value: 'mes', label: 'Este mês' },
          ]}
        />

        <View className="mt-3">
          {filtered.length ? (
            <Card className="py-1">
              {filtered.map((t, i) => {
                const income = t.type === 'receita';
                return (
                  <View key={t.id} className={`flex-row items-center py-3 ${i ? 'border-t border-line' : ''}`}>
                    <View
                      className="h-9 w-9 items-center justify-center rounded-full"
                      style={{ backgroundColor: income ? '#EAF2EC' : '#F8E9EA' }}>
                      <Ionicons
                        name={income ? 'arrow-down' : 'arrow-up'}
                        size={16}
                        color={income ? '#5E8B6A' : '#B2474F'}
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text numberOfLines={1} className="text-[14px] font-medium text-ink">
                        {t.description || t.category}
                      </Text>
                      <Text className="text-xs text-muted">
                        {formatDateShort(t.occurredAt)} {formatTime(t.occurredAt)} · {t.category}
                        {t.paymentMethod ? ` · ${paymentLabels[t.paymentMethod]}` : ''}
                      </Text>
                      {income && t.feeAmount > 0 ? (
                        <Text className="text-[11px] text-muted">
                          Taxa {formatBRL(t.feeAmount)} · líquido {formatBRL(t.netAmount)}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      className="text-[14px] font-semibold"
                      style={{ color: income ? '#5E8B6A' : '#B2474F' }}>
                      {income ? '+' : '−'} {formatBRL(t.amount)}
                    </Text>
                  </View>
                );
              })}
            </Card>
          ) : (
            <EmptyState icon="receipt-outline" text="Nenhuma transação no período" />
          )}
        </View>
      </ScrollView>
      <Fab icon="remove" onPress={() => router.push('/financeiro/despesa')} />
    </Screen>
  );
}
