// Formatos de planilha (CSV e Excel .xlsx) e utilidades de texto, sem nada específico do celular
// (pode ser testado fora do app). O envio/compartilhamento fica em export-files.ts.
import { strToU8, zipSync } from 'fflate';

// ---------------------------------------------------------------------
// Tabela (base comum do CSV e do .xlsx)
// ---------------------------------------------------------------------
/** Texto, ou { money } para valores em R$ (viram número de verdade no Excel/Planilhas). */
export type Cell = string | { money: number } | null | undefined;

export interface Table {
  sheetName: string;
  header: string[];
  rows: Cell[][];
  /** Largura aproximada de cada coluna (em caracteres) no .xlsx */
  widths?: number[];
}

export const money = (n: number): Cell => ({ money: Math.round(n * 100) / 100 });

const isMoney = (c: Cell): c is { money: number } => typeof c === 'object' && c !== null;

// ---------------------------------------------------------------------
// CSV no padrão do Excel em português: UTF-8 com BOM e separador ";"
// ---------------------------------------------------------------------
const BOM = String.fromCharCode(0xfeff);

/** 1234.5 -> "1234,50" (sem "R$", para a coluna poder ser somada) */
export const csvMoney = (n: number) => n.toFixed(2).replace('.', ',');

function csvCell(c: Cell): string {
  const s = c === null || c === undefined ? '' : isMoney(c) ? csvMoney(c.money) : c;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(t: Table): string {
  return [t.header, ...t.rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

/** Bytes UTF-8 do texto, começando com a marca EF BB BF (o Excel usa para ler acentos). */
export function utf8WithBom(text: string): Uint8Array {
  const body = new TextEncoder().encode(text.startsWith(BOM) ? text.slice(1) : text);
  const bytes = new Uint8Array(body.length + 3);
  bytes.set([0xef, 0xbb, 0xbf], 0);
  bytes.set(body, 3);
  return bytes;
}

// ---------------------------------------------------------------------
// Planilha Excel (.xlsx): um ZIP com arquivos XML. Os acentos ficam corretos em
// qualquer aplicativo (Excel, Google Planilhas, Numbers), sem depender de codificação.
// ---------------------------------------------------------------------
const xmlEsc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Remove caracteres de controle que o XML não aceita
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

/** Índice da coluna -> letra do Excel (0 -> A, 26 -> AA) */
function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export function toXlsx(t: Table): Uint8Array {
  // Estilos: 0 = normal, 1 = cabeçalho em negrito, 2 = dinheiro "#,##0.00"
  const cell = (c: Cell, ref: string, header = false) => {
    if (c === null || c === undefined || c === '') return '';
    if (isMoney(c)) return `<c r="${ref}" s="2"><v>${c.money}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ''}><is><t xml:space="preserve">${xmlEsc(c)}</t></is></c>`;
  };
  const rowXml = (cells: Cell[], r: number, header = false) =>
    `<row r="${r}">${cells.map((c, i) => cell(c, `${colName(i)}${r}`, header)).join('')}</row>`;

  const cols = (t.widths ?? t.header.map((h) => Math.max(12, h.length + 2)))
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    // Cabeçalho fixo ao rolar
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${rowXml(t.header, 1, true)}${t.rows.map((r, i) => rowXml(r, i + 2)).join('')}</sheetData>` +
    '</worksheet>';

  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${xmlEsc(t.sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets>` +
      '</workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>',
    'xl/styles.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '</cellXfs>' +
      '</styleSheet>',
    'xl/worksheets/sheet1.xml': sheet,
  };

  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), { level: 6 });
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
/** Data no formato DD/MM/AAAA */
export const ddmmyyyy = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
};

/** Nome de arquivo seguro: "relatorio-financeiro-novembro-de-2026" */
export const fileSlug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[^\x20-\x7E]/g, '') // tira acentos (as marcas viram caracteres fora do ASCII)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

/** Escapa texto para dentro do HTML do relatório. */
export const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
