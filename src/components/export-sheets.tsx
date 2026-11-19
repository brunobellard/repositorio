// Janelas de exportação (Financeiro e Clientes).
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { RangeCalendar } from '@/components/range-calendar';
import { Sheet } from '@/components/sheet';
import { Button, Chip } from '@/components/ui';
import { useStore } from '@/data/store';
import { clientsForExport, exportClientsSheet, type ClientFilter } from '@/lib/export-clients';
import {
  countInPeriod,
  exportFinanceSheet,
  exportFinancePdf,
  periodFor,
  type PeriodPreset,
} from '@/lib/export-finance';
import { ddmmyyyy, type SheetFormat } from '@/lib/export-files';

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'mes_atual', label: 'Mês atual' },
  { value: 'mes_anterior', label: 'Mês anterior' },
  { value: 'ultimos_90', label: 'Últimos 90 dias' },
  { value: 'personalizado', label: 'Personalizado' },
];

function Notice({ text, tone = 'warn' }: { text: string; tone?: 'warn' | 'error' }) {
  return (
    <View className={`mb-3 rounded-2xl px-4 py-3 ${tone === 'warn' ? 'bg-[#FBF3E4]' : 'bg-[#F8E9EA]'}`}>
      <Text className={`text-[13px] leading-5 ${tone === 'warn' ? 'text-[#8A6420]' : 'text-[#B2474F]'}`}>{text}</Text>
    </View>
  );
}

export function ExportFinanceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { transactions, appointments, clients, packages, profile, historyFrom, ensureFullHistory } = useStore();
  const [preset, setPreset] = useState<PeriodPreset>('mes_atual');
  const [range, setRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [busy, setBusy] = useState<'xlsx' | 'csv' | 'pdf' | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'warn' | 'error' } | null>(null);

  const customReady = preset !== 'personalizado' || !!range.start;
  const period = periodFor(preset, range.start ? { start: range.start, end: range.end ?? range.start } : undefined);
  const data = { transactions, appointments, clients, packages, profile };
  const count = customReady ? countInPeriod(data, period) : 0;
  // Período anterior ao histórico carregado (12 meses): busca o restante ao exportar
  const needsOlder = !!historyFrom && period.from < new Date(historyFrom);

  async function run(kind: 'xlsx' | 'csv' | 'pdf') {
    setMessage(null);
    let full = data;
    if (needsOlder) {
      setBusy(kind);
      const older = await ensureFullHistory();
      if (!older) {
        setBusy(null);
        return;
      }
      full = { ...data, ...older };
    }
    if (!countInPeriod(full, period)) {
      // Período sem movimentações: avisa em vez de gerar arquivo vazio
      setBusy(null);
      setMessage({ text: `Nenhuma movimentação em ${period.label}. Escolha outro período.`, tone: 'warn' });
      return;
    }
    setBusy(kind);
    try {
      if (kind === 'pdf') await exportFinancePdf(full, period);
      else await exportFinanceSheet(full, period, kind);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Não foi possível gerar o arquivo.', tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Exportar financeiro" subtitle="Escolha o período do relatório.">
      <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
        <View className="flex-row flex-wrap">
          {PRESETS.map((p) => (
            <Chip
              key={p.value}
              label={p.label}
              selected={preset === p.value}
              onPress={() => {
                setPreset(p.value);
                setMessage(null);
              }}
            />
          ))}
        </View>

        {preset === 'personalizado' ? (
          <View className="mb-2 mt-1 rounded-2xl border border-line p-3">
            <RangeCalendar
              allowPast
              start={range.start}
              end={range.end}
              onChange={(start, end) => {
                setRange({ start, end });
                setMessage(null);
              }}
            />
            <Text className="mt-1 text-center text-[12px] text-muted">
              {range.start
                ? `${ddmmyyyy(range.start)}${range.end ? ` a ${ddmmyyyy(range.end)}` : ' · toque na data final'}`
                : 'Toque na data inicial e depois na final'}
            </Text>
          </View>
        ) : null}

        <Text className="mb-3 mt-1 text-[13px] text-muted">
          {!customReady
            ? 'Escolha as datas do período.'
            : needsOlder
              ? `${period.label} · inclui o histórico com mais de 12 meses, buscado ao exportar`
              : `${period.label} · ${count} ${count === 1 ? 'movimentação' : 'movimentações'}`}
        </Text>

        {message ? <Notice text={message.text} tone={message.tone} /> : null}

        <View className="gap-2">
          <Button
            title={busy === 'pdf' ? 'Gerando PDF…' : 'Exportar relatório (PDF)'}
            icon="document-text-outline"
            loading={busy === 'pdf'}
            disabled={!customReady || busy !== null}
            onPress={() => run('pdf')}
          />
          <Button
            title={busy === 'xlsx' ? 'Gerando planilha…' : 'Exportar planilha (Excel)'}
            icon="grid-outline"
            variant="secondary"
            loading={busy === 'xlsx'}
            disabled={!customReady || busy !== null}
            onPress={() => run('xlsx')}
          />
        </View>
        <Text
          className={`mt-3 self-center py-1 text-[13px] font-medium text-primary-dark ${busy ? 'opacity-40' : ''}`}
          onPress={busy || !customReady ? undefined : () => run('csv')}>
          {busy === 'csv' ? 'Gerando CSV…' : 'Prefere CSV? Exportar em CSV'}
        </Text>
        <Text className="mt-2 text-center text-[11px] leading-4 text-muted">
          A planilha (.xlsx) abre com acentos e valores certos no Excel e no Google Planilhas. O PDF traz resumo,
          totais por forma de pagamento e todas as movimentações.
        </Text>
      </ScrollView>
    </Sheet>
  );
}

export function ExportClientsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { clients, appointments, packages, profile, ensureFullHistory } = useStore();
  const [filter, setFilter] = useState<ClientFilter>('todas');
  const [busy, setBusy] = useState<SheetFormat | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'warn' | 'error' } | null>(null);

  const data = { clients, appointments, packages, recallDays: profile.recallDays };
  const count = clientsForExport(data, filter).length;

  async function run(format: SheetFormat) {
    setMessage(null);
    if (!count) {
      setMessage({
        text: filter === 'inativas' ? 'Nenhuma cliente inativa no momento.' : 'Nenhuma cliente cadastrada.',
        tone: 'warn',
      });
      return;
    }
    setBusy(format);
    try {
      // Total gasto e última visita contam todo o histórico, não só os últimos 12 meses
      const older = await ensureFullHistory();
      if (!older) return;
      await exportClientsSheet({ ...data, appointments: older.appointments }, filter, format);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Não foi possível gerar o arquivo.', tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Exportar base de clientes"
      subtitle="Planilha com contato, aniversário, total gasto, última visita e anotações técnicas.">
      <View className="flex-row flex-wrap">
        <Chip
          label="Todas as clientes"
          selected={filter === 'todas'}
          onPress={() => {
            setFilter('todas');
            setMessage(null);
          }}
        />
        <Chip
          label={`Apenas inativas (+${profile.recallDays} dias)`}
          selected={filter === 'inativas'}
          onPress={() => {
            setFilter('inativas');
            setMessage(null);
          }}
        />
      </View>
      <Text className="mb-3 mt-1 text-[13px] text-muted">
        {count} {count === 1 ? 'cliente' : 'clientes'}
        {filter === 'inativas' ? ' sem visita há mais tempo e sem horário marcado' : ''}
      </Text>
      {message ? <Notice text={message.text} tone={message.tone} /> : null}
      <Button
        title={busy === 'xlsx' ? 'Gerando planilha…' : 'Exportar planilha (Excel)'}
        icon="download-outline"
        loading={busy === 'xlsx'}
        disabled={busy !== null}
        onPress={() => run('xlsx')}
      />
      <Text
        className={`mt-3 self-center py-1 text-[13px] font-medium text-primary-dark ${busy ? 'opacity-40' : ''}`}
        onPress={busy ? undefined : () => run('csv')}>
        {busy === 'csv' ? 'Gerando CSV…' : 'Prefere CSV? Exportar em CSV'}
      </Text>
    </Sheet>
  );
}
