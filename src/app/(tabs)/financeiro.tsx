import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { ExportFinanceSheet } from '@/components/export-sheets';
import { FinanceSkeleton } from '@/components/skeleton';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { Card, EmptyState, Fab, Screen, ScreenTitle, SectionLabel, Segmented } from '@/components/ui';
import { useStore } from '@/data/store';
import { usePlanAccess } from '@/hooks/usePlanAccess';
import { requireFeature } from '@/lib/upgrade';
import { confirmAction, notify } from '@/lib/confirm';
import { formatDateShort, formatTime, MONTHS, startOfDay, startOfWeek } from '@/lib/dates';
import { formatBRL } from '@/lib/format';
import { colors, paymentLabels } from '@/theme/colors';

type Period = 'hoje' | 'semana' | 'mes';

function Stat({
  label,
  value,
  tone,
  hint,
  count,
}: {
  label: string;
  value: number;
  tone?: 'pos' | 'neg';
  hint?: string;
  /** Mostra o número puro (ex.: quantidade), sem R$ */
  count?: boolean;
}) {
  return (
    <Card className="mb-3 w-[48%]">
      <Text className="text-xs text-muted">{label}</Text>
      <Text
        className="mt-1 text-lg font-bold"
        style={{ color: tone === 'neg' ? '#B2474F' : tone === 'pos' ? '#4A7356' : colors.ink }}>
        {count ? value : formatBRL(value)}
      </Text>
      {hint ? <Text className="mt-0.5 text-[11px] text-muted">{hint}</Text> : null}
    </Card>
  );
}

export default function FinanceiroScreen() {
  const { transactions, appointments, clients, packages, loading, refresh, deleteExpense, historyFrom } = useStore();

  /** Despesa lançada errado: exclui depois de confirmar. */
  function removeExpense(id: string, label: string, amount: number) {
    confirmAction('Excluir despesa?', `"${label}" (${formatBRL(amount)}) sai do Financeiro.`, async () => {
      if (await deleteExpense(id)) notify('Despesa excluída');
    }, 'Excluir');
  }
  const access = usePlanAccess();
  const { refreshing, onRefresh } = usePullToRefresh(refresh);
  const [period, setPeriod] = useState<Period>('mes');
  // Mês mostrado (0 = este mês, -1 = mês passado…): UX-11
  const [monthOffset, setMonthOffset] = useState(0);
  const [exporting, setExporting] = useState(false);

  const now = new Date();
  const today = startOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const isCurrentMonth = monthOffset === 0;
  // O app carrega só os últimos 12 meses: antes disso o mês pareceria vazio sem estar
  const oldestMonth = historyFrom ? new Date(new Date(historyFrom).getFullYear(), new Date(historyFrom).getMonth(), 1) : null;
  const canGoBack = !oldestMonth || monthStart > oldestMonth;
  // No mês atual dá para olhar hoje / semana / mês; meses passados mostram o mês inteiro.
  // Cartões e lista seguem sempre o mesmo período (antes os cartões eram do mês e a lista não)
  const activePeriod: Period = isCurrentMonth ? period : 'mes';
  const from =
    activePeriod === 'hoje'
      ? today
      : activePeriod === 'semana'
        ? startOfWeek(now)
        : monthStart;
  const to = isCurrentMonth ? new Date(8.64e15) : monthEnd;
  const periodLabel = activePeriod === 'hoje' ? 'hoje' : activePeriod === 'semana' ? 'na semana' : 'no mês';

  const sum = (
    list: typeof transactions,
    type: 'receita' | 'despesa',
    field: 'amount' | 'netAmount' | 'feeAmount' = 'amount',
  ) => list.filter((t) => t.type === type).reduce((s, t) => s + t[field], 0);

  const filtered = transactions
    .filter((t) => {
      const d = new Date(t.occurredAt);
      return d >= from && d < to;
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const income = sum(filtered, 'receita');
  const expense = sum(filtered, 'despesa');
  // Lucro líquido real: receitas já descontadas as taxas de maquininha, menos despesas
  const fees = sum(filtered, 'receita', 'feeAmount');
  const net = sum(filtered, 'receita', 'netAmount') - expense;
  const served = filtered.filter((t) => t.type === 'receita' && t.appointmentId).length;

  /** "Larissa O.": quem pagou (atendimento ou pacote), para reconhecer a linha sem abrir nada */
  function clientOf(t: (typeof transactions)[number]): string | null {
    const clientId =
      (t.appointmentId && appointments.find((a) => a.id === t.appointmentId)?.clientId) ||
      (t.clientPackageId && packages.find((p) => p.id === t.clientPackageId)?.clientId) ||
      null;
    const c = clientId ? clients.find((x) => x.id === clientId) : null;
    if (!c) return null;
    const [first, ...rest] = c.name.trim().split(/\s+/);
    return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
  }

  return (
    <Screen>
      <ScreenTitle
        title="Financeiro"
        subtitle={`${MONTHS[monthStart.getMonth()]} de ${monthStart.getFullYear()}`}
        right={
          <View className="flex-row gap-2">
            <Pressable accessibilityRole="button"
              onPress={() => requireFeature(access.hasExport, 'export') && setExporting(true)}
              accessibilityLabel="Exportar relatório"
              className="flex-row items-center rounded-full border border-line bg-surface px-3 py-1.5 active:opacity-70">
              <Ionicons name="download-outline" size={14} color={colors.ink} />
              <Text className="ml-1 text-[13px] font-semibold text-ink">Exportar</Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              onPress={() => requireFeature(access.hasPackages, 'packages') && router.push('/pacote/novo')}
              accessibilityLabel="Vender pacote"
              className="flex-row items-center rounded-full border border-line bg-surface px-3 py-1.5 active:opacity-70">
              <Ionicons name="ticket-outline" size={14} color={colors.ink} />
              <Text className="ml-1 text-[13px] font-semibold text-ink">Vender pacote</Text>
            </Pressable>
          </View>
        }
      />
      <ExportFinanceSheet visible={exporting} onClose={() => setExporting(false)} />
      {loading ? (
        <FinanceSkeleton />
      ) : (
      <ScrollView
        // Espaço para o botão "+ Despesa" não cobrir o último valor da lista
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }>
        {/* Mês: ‹ Novembro 2026 › */}
        <View className="mb-3 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mês anterior"
            accessibilityState={{ disabled: !canGoBack }}
            disabled={!canGoBack}
            onPress={() => setMonthOffset(monthOffset - 1)}
            hitSlop={10}
            className={`rounded-full p-2 active:opacity-60 ${canGoBack ? '' : 'opacity-30'}`}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </Pressable>
          <Text className="text-[16px] font-semibold text-ink">
            {MONTHS[monthStart.getMonth()]} {monthStart.getFullYear()}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Próximo mês"
            accessibilityState={{ disabled: isCurrentMonth }}
            disabled={isCurrentMonth}
            onPress={() => setMonthOffset(Math.min(0, monthOffset + 1))}
            hitSlop={10}
            className={`rounded-full p-2 active:opacity-60 ${isCurrentMonth ? 'opacity-30' : ''}`}>
            <Ionicons name="chevron-forward" size={20} color={colors.ink} />
          </Pressable>
        </View>
        {isCurrentMonth ? (
          <View className="mb-3">
            <Segmented
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'hoje', label: 'Hoje' },
                { value: 'semana', label: 'Esta semana' },
                { value: 'mes', label: 'Este mês' },
              ]}
            />
          </View>
        ) : null}

        <View className="flex-row flex-wrap justify-between">
          <Stat label={`Faturamento ${periodLabel}`} value={income} />
          <Stat label={`Despesas ${periodLabel}`} value={expense} tone="neg" />
          <Stat
            label="Lucro líquido real"
            value={net}
            tone={net >= 0 ? 'pos' : 'neg'}
            hint={fees ? `já sem ${formatBRL(fees)} de taxas` : undefined}
          />
          <Stat label="Atendimentos pagos" value={served} count />
        </View>

        <SectionLabel>Transações</SectionLabel>
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
                        color={income ? '#4A7356' : '#B2474F'}
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text numberOfLines={1} className="text-[14px] font-medium text-ink">
                        {t.description || t.category}
                        {clientOf(t) ? <Text className="font-normal text-muted"> · {clientOf(t)}</Text> : null}
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
                      style={{ color: income ? '#4A7356' : '#B2474F' }}>
                      {income ? '+' : '−'} {formatBRL(t.amount)}
                    </Text>
                    {!income ? (
                      <Pressable accessibilityRole="button"
                        onPress={() => removeExpense(t.id, t.description || t.category, t.amount)}
                        hitSlop={8}
                        accessibilityLabel="Excluir despesa"
                        className="ml-2 p-1 active:opacity-60">
                        <Ionicons name="trash-outline" size={17} color={colors.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          ) : (
            <EmptyState
              icon="receipt-outline"
              text={isCurrentMonth ? 'Nenhuma movimentação registrada neste período' : 'Nenhuma movimentação neste mês'}
              subtitle="Receitas entram ao concluir atendimentos ou vender pacotes."
              actionLabel="+ Lançar despesa"
              onAction={() => router.push('/financeiro/despesa')}
            />
          )}
        </View>
      </ScrollView>
      )}
      <Fab icon="add" text="Despesa" label="Lançar despesa" onPress={() => router.push('/financeiro/despesa')} />
    </Screen>
  );
}
