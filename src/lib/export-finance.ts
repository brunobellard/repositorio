// Relatórios do Financeiro: planilha CSV e relatório mensal em PDF.
import { addDays, startOfDay } from '@/lib/dates';
import {
  ddmmyyyy,
  esc,
  fileSlug,
  money,
  sharePdf,
  shareTable,
  type SheetFormat,
  type Table,
} from '@/lib/export-files';
import { formatBRL, maskDocument } from '@/lib/format';
import { formatAddress } from '@/lib/hours';
import { paymentLabels } from '@/theme/colors';
import type { Appointment, Client, ClientPackage, PaymentMethod, Profile, Transaction } from '@/types';

export type PeriodPreset = 'mes_atual' | 'mes_anterior' | 'ultimos_90' | 'personalizado';

export interface Period {
  from: Date; // início do dia
  to: Date; // fim do dia (exclusivo: início do dia seguinte)
  label: string;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function periodFor(preset: PeriodPreset, custom?: { start: Date; end: Date }, now = new Date()): Period {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'mes_atual':
      return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1), label: `${MESES[m]} de ${y}` };
    case 'mes_anterior': {
      const from = new Date(y, m - 1, 1);
      return { from, to: new Date(y, m, 1), label: `${MESES[from.getMonth()]} de ${from.getFullYear()}` };
    }
    case 'ultimos_90': {
      const to = addDays(startOfDay(now), 1);
      const from = addDays(to, -90);
      return { from, to, label: `${ddmmyyyy(from)} a ${ddmmyyyy(addDays(to, -1))}` };
    }
    case 'personalizado': {
      const from = startOfDay(custom?.start ?? now);
      const last = startOfDay(custom?.end ?? custom?.start ?? now);
      return { from, to: addDays(last, 1), label: `${ddmmyyyy(from)} a ${ddmmyyyy(last)}` };
    }
  }
}

export interface FinanceData {
  transactions: Transaction[];
  appointments: Appointment[];
  clients: Client[];
  packages: ClientPackage[];
  profile: Profile;
}

interface Row {
  date: Date;
  income: boolean;
  what: string;
  client: string;
  method?: PaymentMethod;
  gross: number;
  fee: number;
  net: number;
}

/** Movimentações do período, com a cliente ligada (pelo agendamento ou pelo pacote). */
function buildRows(d: FinanceData, p: Period): Row[] {
  const clientName = new Map(d.clients.map((c) => [c.id, c.name]));
  const apptClient = new Map(d.appointments.map((a) => [a.id, a.clientId]));
  const pkgClient = new Map(d.packages.map((k) => [k.id, k.clientId]));
  return d.transactions
    .filter((t) => {
      const at = new Date(t.occurredAt);
      return at >= p.from && at < p.to;
    })
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((t) => {
      const income = t.type === 'receita';
      const cid = (t.appointmentId && apptClient.get(t.appointmentId)) || (t.clientPackageId && pkgClient.get(t.clientPackageId));
      return {
        date: new Date(t.occurredAt),
        income,
        what: income
          ? t.description || t.category
          : [t.category, t.description].filter(Boolean).join(' — '),
        client: cid ? (clientName.get(cid) ?? '') : '',
        method: t.paymentMethod,
        gross: t.grossAmount,
        fee: income ? t.feeAmount : 0,
        // Saída entra negativa no líquido: somar a coluna dá o lucro do período
        net: income ? t.netAmount : -t.grossAmount,
      };
    });
}

export interface FinanceSummary {
  gross: number;
  fees: number;
  expenses: number;
  profit: number;
  byMethod: { method: PaymentMethod; count: number; gross: number; fee: number; net: number }[];
  count: number;
}

function summarize(rows: Row[]): FinanceSummary {
  const incomes = rows.filter((r) => r.income);
  const gross = incomes.reduce((s, r) => s + r.gross, 0);
  const fees = incomes.reduce((s, r) => s + r.fee, 0);
  const expenses = rows.filter((r) => !r.income).reduce((s, r) => s + r.gross, 0);
  const methods: PaymentMethod[] = ['pix', 'credito', 'debito', 'dinheiro'];
  const byMethod = methods
    .map((method) => {
      const list = incomes.filter((r) => r.method === method);
      return {
        method,
        count: list.length,
        gross: list.reduce((s, r) => s + r.gross, 0),
        fee: list.reduce((s, r) => s + r.fee, 0),
        net: list.reduce((s, r) => s + r.net, 0),
      };
    })
    .filter((m) => m.count > 0);
  return { gross, fees, expenses, profit: gross - fees - expenses, byMethod, count: rows.length };
}

/** Quantas movimentações há no período (para avisar quando estiver vazio). */
export function countInPeriod(d: FinanceData, p: Period) {
  return buildRows(d, p).length;
}

// ---------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------
/** Planilha das movimentações do período (Excel .xlsx ou CSV). */
export async function exportFinanceSheet(d: FinanceData, p: Period, format: SheetFormat) {
  const rows = buildRows(d, p);
  const table: Table = {
    sheetName: 'Financeiro',
    header: ['Data', 'Tipo (Entrada/Saída)', 'Categoria/Serviço', 'Cliente', 'Forma de Pagamento', 'Valor Bruto (R$)', 'Taxa (R$)', 'Valor Líquido (R$)'],
    widths: [12, 20, 40, 24, 20, 16, 12, 18],
    rows: rows.map((r) => [
      ddmmyyyy(r.date),
      r.income ? 'Entrada' : 'Saída',
      r.what,
      r.client,
      r.method ? paymentLabels[r.method] : '',
      money(r.gross),
      money(r.fee),
      money(r.net),
    ]),
  };
  await shareTable(`financeiro-${fileSlug(p.label)}`, table, format, 'Exportar planilha do financeiro');
}

// ---------------------------------------------------------------------
// PDF (HTML minimalista nas cores do app)
// ---------------------------------------------------------------------
function financeHtml(d: FinanceData, p: Period): string {
  const rows = buildRows(d, p);
  const s = summarize(rows);
  const prof = d.profile;
  const doc = prof.document ? `${prof.document.length > 11 ? 'CNPJ' : 'CPF'} ${maskDocument(prof.document)}` : '';
  const address = formatAddress(prof);
  const card = (label: string, value: number, tone = '#2A2326') =>
    `<div class="card"><div class="lbl">${label}</div><div class="val" style="color:${tone}">${formatBRL(value)}</div></div>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Relatório financeiro — ${esc(p.label)}</title>
<style>
  @page { margin: 28px; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Inter, Arial, sans-serif; color: #2A2326; margin: 0; font-size: 11px; }
  .head { display: flex; align-items: center; gap: 14px; padding-bottom: 14px; border-bottom: 1px solid #EFE9E7; }
  .logo { width: 52px; height: 52px; border-radius: 14px; object-fit: cover; }
  .initials { width: 52px; height: 52px; border-radius: 14px; background: #F7EBED; color: #9A5561; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; }
  h1 { font-size: 18px; margin: 0; }
  .muted { color: #6F6569; }
  .period { margin-left: auto; text-align: right; }
  .period b { display: block; font-size: 13px; color: #2A2326; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0; }
  .card { border: 1px solid #EFE9E7; border-radius: 12px; padding: 10px 12px; }
  .lbl { color: #6F6569; font-size: 10px; }
  .val { font-size: 15px; font-weight: 700; margin-top: 2px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6F6569; margin: 18px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: 600; color: #6F6569; font-size: 10px; padding: 6px 4px; border-bottom: 1px solid #EFE9E7; }
  td { padding: 6px 4px; border-bottom: 1px solid #F4F0EE; vertical-align: top; }
  .r { text-align: right; white-space: nowrap; }
  .in { color: #4A7356; } .out { color: #B2474F; }
  tfoot td { font-weight: 700; border-bottom: none; }
  .foot { margin-top: 18px; color: #6F6569; font-size: 9px; text-align: center; }
</style></head><body>
  <div class="head">
    ${prof.logoUrl ? `<img class="logo" src="${esc(prof.logoUrl)}" />` : `<div class="initials">${esc(prof.businessName.slice(0, 2).toUpperCase())}</div>`}
    <div>
      <h1>${esc(prof.businessName)}</h1>
      <div class="muted">${esc([prof.tradeName, doc].filter(Boolean).join(' · '))}</div>
      ${address ? `<div class="muted">${esc(address)}</div>` : ''}
    </div>
    <div class="period"><span class="muted">Relatório financeiro</span><b>${esc(p.label)}</b></div>
  </div>

  <div class="cards">
    ${card('Faturamento bruto', s.gross)}
    ${card('Taxas descontadas', s.fees, '#8A6420')}
    ${card('Total de despesas', s.expenses, '#B2474F')}
    ${card('Lucro líquido', s.profit, s.profit >= 0 ? '#4A7356' : '#B2474F')}
  </div>

  <h2>Por forma de pagamento</h2>
  <table>
    <thead><tr><th>Forma</th><th class="r">Entradas</th><th class="r">Bruto</th><th class="r">Taxas</th><th class="r">Líquido</th></tr></thead>
    <tbody>
      ${
        s.byMethod.length
          ? s.byMethod
              .map(
                (m) =>
                  `<tr><td>${paymentLabels[m.method]}</td><td class="r">${m.count}</td><td class="r">${formatBRL(m.gross)}</td><td class="r">${formatBRL(m.fee)}</td><td class="r">${formatBRL(m.net)}</td></tr>`,
              )
              .join('')
          : '<tr><td colspan="5" class="muted">Nenhuma entrada no período.</td></tr>'
      }
    </tbody>
  </table>

  <h2>Movimentações (${rows.length})</h2>
  <table>
    <thead><tr><th>Data</th><th>Descrição</th><th>Cliente</th><th>Pagamento</th><th class="r">Bruto</th><th class="r">Taxa</th><th class="r">Líquido</th></tr></thead>
    <tbody>
      ${rows
        .map(
          (r) => `<tr>
        <td>${ddmmyyyy(r.date)}</td>
        <td>${esc(r.what)}</td>
        <td>${esc(r.client)}</td>
        <td>${r.method ? paymentLabels[r.method] : ''}</td>
        <td class="r ${r.income ? 'in' : 'out'}">${r.income ? '+' : '−'} ${formatBRL(r.gross)}</td>
        <td class="r">${r.fee ? formatBRL(r.fee) : ''}</td>
        <td class="r ${r.income ? '' : 'out'}">${r.income ? '' : '− '}${formatBRL(Math.abs(r.net))}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
    <tfoot><tr><td colspan="4">Resultado do período</td><td class="r">${formatBRL(s.gross - s.expenses)}</td><td class="r">${formatBRL(s.fees)}</td><td class="r">${formatBRL(s.profit)}</td></tr></tfoot>
  </table>

  <div class="foot">Gerado pelo Agenda Beleza em ${ddmmyyyy(new Date())}</div>
</body></html>`;
}

export async function exportFinancePdf(d: FinanceData, p: Period) {
  await sharePdf(`relatorio-financeiro-${fileSlug(p.label)}`, financeHtml(d, p), 'Exportar relatório do financeiro');
}
