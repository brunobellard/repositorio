// Gera arquivos (planilha Excel .xlsx, CSV e PDF) e abre o compartilhamento do celular.
// No navegador (versão web), baixa a planilha e abre a janela de impressão para salvar o PDF.
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { toCsv, toXlsx, utf8WithBom, type Table } from '@/lib/sheet-format';

export * from '@/lib/sheet-format';

// ---------------------------------------------------------------------
// Gravar e compartilhar
// ---------------------------------------------------------------------
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Grava bytes na pasta de cache do app e abre o compartilhamento (WhatsApp, e-mail, Drive…). */
async function shareBytes(
  name: string,
  bytes: Uint8Array,
  mimeType: string,
  UTI: string,
  dialogTitle: string,
) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType, UTI, dialogTitle });
}

export type SheetFormat = 'xlsx' | 'csv';

/** Exporta a tabela como planilha Excel (.xlsx) ou CSV. */
export async function shareTable(fileName: string, table: Table, format: SheetFormat, dialogTitle: string) {
  if (format === 'xlsx') {
    await shareBytes(`${fileName}.xlsx`, toXlsx(table), XLSX_MIME, 'org.openxmlformats.spreadsheetml.sheet', dialogTitle);
  } else {
    await shareBytes(
      `${fileName}.csv`,
      utf8WithBom(toCsv(table)),
      'text/csv',
      'public.comma-separated-values-text',
      dialogTitle,
    );
  }
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
  // O arquivo que o expo-print grava fica numa pasta que o app não pode ler no Android
  // (o compartilhamento recusa). Por isso pedimos o PDF em base64 e gravamos nós mesmos
  // na pasta de cache do app, já com um nome amigável.
  const { base64 } = await Print.printToFileAsync({ html, width: 595, height: 842, base64: true }); // A4
  if (!base64) throw new Error('Não foi possível gerar o PDF.');
  const file = new File(Paths.cache, `${fileName}.pdf`);
  file.create({ overwrite: true });
  await file.write(base64, { encoding: 'base64' });
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
}
