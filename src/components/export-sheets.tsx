// Janelas de exportação (Financeiro e Clientes).
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { RangeCalendar } from '@/components/range-calendar';
import { Sheet } from '@/components/sheet';
import { Button, Chip } from '@/components/ui';
import { useStore } from '@/data/store';
import { clientsForExport, exportClientsCsv, type ClientFilter } from '@/lib/export-clients';
import {
  countInPeriod,
  exportFinanceCsv,
  exportFinancePdf,
  periodFor,
  type PeriodPreset,
} from '@/lib/export-finance';
import { ddmmyyyy } from '@/lib/export-files';

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
  const { transactions, appointments, clients, packages, profile } = useStore();
  const [preset, setPreset] = useState<PeriodPreset>('mes_atual');
  const [range, setRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'warn' | 'error' } | null>(null);

  const customReady = preset !== 'personalizado' || !!range.start;
  const period = periodFor(preset, range.start ? { start: range.start, end: range.end ?? range.start } : undefined);
  const data = { transactions, appointments, clients, packages, profile };
  const count = customReady ? countInPeriod(data, period) : 0;

  async function run(kind: 'csv' | 'pdf') {
    setMessage(null);
    if (!count) {
      // Período sem movimentações: avisa em vez de gerar arquivo vazio
      setMessage({ text: `Nenhuma movimentação em ${period.label}. Escolha outro período.`, tone: 'warn' });
      return;
    }
    setBusy(kind);
    try {
      if (kind === 'csv') await exportFinanceCsv(data, period);
      else await exportFinancePdf(data, period);
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
          {customReady
            ? `${period.label} · ${count} ${count === 1 ? 'movimentação' : 'movimentações'}`
            : 'Escolha as datas do período.'}
        </Text>

        {message ? <Notice text={message.text} tone={message.tone} /> : null}

        <View className="gap-2">
          <Button
            title={busy === 'csv' ? 'Gerando planilha…' : 'Exportar planilha (CSV)'}
            icon="grid-outline"
            variant="secondary"
            loading={busy === 'csv'}
            disabled={!customReady || busy !== null}
            onPress={() => run('csv')}
          />
          <Button
            title={busy === 'pdf' ? 'Gerando PDF…' : 'Exportar relatório (PDF)'}
            icon="document-text-outline"
            loading={busy === 'pdf'}
            disabled={!customReady || busy !== null}
            onPress={() => run('pdf')}
          />
        </View>
        <Text className="mt-3 text-center text-[11px] leading-4 text-muted">
          A planilha abre direto no Excel (acentos e colunas em português). O PDF traz resumo, totais por forma de
          pagamento e todas as movimentações.
        </Text>
      </ScrollView>
    </Sheet>
  );
}

export function ExportClientsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { clients, appointments, packages, profile } = useStore();
  const [filter, setFilter] = useState<ClientFilter>('todas');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'warn' | 'error' } | null>(null);

  const data = { clients, appointments, packages, recallDays: profile.recallDays };
  const count = clientsForExport(data, filter).length;

  async function run() {
    setMessage(null);
    if (!count) {
      setMessage({
        text: filter === 'inativas' ? 'Nenhuma cliente inativa no momento.' : 'Nenhuma cliente cadastrada.',
        tone: 'warn',
      });
      return;
    }
    setBusy(true);
    try {
      await exportClientsCsv(data, filter);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Não foi possível gerar o arquivo.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Exportar base de clientes"
      subtitle="Planilha CSV com contato, aniversário, total gasto, última visita e anotações técnicas.">
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
        title={busy ? 'Gerando planilha…' : 'Exportar planilha (CSV)'}
        icon="download-outline"
        loading={busy}
        onPress={run}
      />
    </Sheet>
  );
}
