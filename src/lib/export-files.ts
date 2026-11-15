// Gera arquivos (CSV e PDF) e abre o compartilhamento do celular.
// No navegador (versão web), baixa o CSV e abre a janela de impressão para salvar o PDF.
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------
// CSV no padrão do Excel em português: UTF-8 com BOM e separador ";"
// ---------------------------------------------------------------------
const BOM = '﻿';

/** Escapa um valor para CSV (aspas, ponto e vírgula e quebras de linha). */
function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(';'));
  return BOM + lines.join('\r\n') + '\r\n';
}

/** 1234.5 -> "1234,50" (sem "R$", para o Excel somar a coluna) */
export const csvMoney = (n: number) => n.toFixed(2).replace('.', ',');

/** Data no formato DD/MM/AAAA */
export const ddmmyyyy = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
};

/** Nome de arquivo seguro: "relatorio-financeiro-2026-11" */
export const fileSlug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

/** Grava o CSV e abre o compartilhamento (WhatsApp, e-mail, salvar em Arquivos…). */
export async function shareCsv(fileName: string, csv: string, dialogTitle: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  const file = new File(Paths.cache, `${fileName}.csv`);
  file.create({ overwrite: true });
  await file.write(csv);
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle });
}

/** Gera o PDF a partir de HTML e abre o compartilhamento. */
export async function sharePdf(fileName: string, html: string, dialogTitle: string) {
  if (Platform.OS === 'web') {
    // O navegador não gera PDF direto: abre o relatório e a janela de impressão ("Salvar como PDF")
    const w = window.open('', '_blank');
    if (!w) throw new Error('O navegador bloqueou a nova janela. Permita pop-ups para este site.');
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.document.title = fileName;
    setTimeout(() => w.print(), 600);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 }); // A4
  // Renomeia o arquivo para um nome amigável antes de compartilhar
  const target = new File(Paths.cache, `${fileName}.pdf`);
  if (target.exists) target.delete();
  new File(uri).move(target);
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
}

/** Escapa texto para dentro do HTML do relatório. */
export const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
