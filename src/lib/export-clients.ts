// Backup / exportação da base de clientes em CSV (Excel em português).
import { ddmmyyyy, money, shareTable, type Cell, type SheetFormat, type Table } from '@/lib/export-files';
import { formatPhone } from '@/lib/format';
import { amountDue } from '@/lib/packages';
import { clientsToRecall } from '@/lib/recall';
import type { Appointment, Client, ClientPackage } from '@/types';

export type ClientFilter = 'todas' | 'inativas';

export interface ClientsData {
  clients: Client[];
  appointments: Appointment[];
  packages: ClientPackage[];
  /** Dias sem voltar para ser considerada inativa (Ajustes > Retorno de clientes) */
  recallDays: number;
}

/** Clientes que entram no arquivo conforme o filtro. */
export function clientsForExport(d: ClientsData, filter: ClientFilter): Client[] {
  // Removidas não têm dados pessoais: ficam fora da exportação
  if (filter === 'todas') return d.clients.filter((c) => !c.removed).sort((a, b) => a.name.localeCompare(b.name));
  // Inativas = mesma regra de "Para chamar de volta": sem visita há mais de N dias e sem horário marcado
  return clientsToRecall(d.clients, d.appointments, d.recallDays).map((r) => r.client);
}

/** Planilha da base de clientes (Excel .xlsx ou CSV). */
export async function exportClientsSheet(d: ClientsData, filter: ClientFilter, format: SheetFormat) {
  const list = clientsForExport(d, filter);
  const nowIso = new Date().toISOString();

  const rows: Cell[][] = list.map((c) => {
    const done = d.appointments.filter((a) => a.clientId === c.id && a.status === 'concluido');
    // Sessões de pacote já foram pagas na venda: conta o valor do pacote e só os extras de cada sessão
    const spent =
      done.reduce((t, a) => t + amountDue(a, d.packages), 0) +
      d.packages.filter((p) => p.clientId === c.id).reduce((t, p) => t + p.totalPaid, 0);
    const last = done
      .filter((a) => a.startsAt <= nowIso)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0]?.startsAt;
    return [
      c.name,
      formatPhone(c.whatsapp),
      c.email ?? '',
      c.birthDate ? c.birthDate.split('-').reverse().join('/') : '',
      money(spent),
      last ? ddmmyyyy(last) : '',
      (c.technicalNotes ?? '').replace(/\s*\n\s*/g, ' '),
    ];
  });

  const table: Table = {
    sheetName: 'Clientes',
    header: ['Nome', 'WhatsApp', 'E-mail', 'Data de Nascimento', 'Total Gasto (R$)', 'Última Visita', 'Observações Técnicas'],
    widths: [28, 18, 30, 18, 16, 14, 60],
    rows,
  };
  const stamp = ddmmyyyy(new Date()).split('/').reverse().join('-');
  await shareTable(
    filter === 'todas' ? `clientes-${stamp}` : `clientes-inativas-${stamp}`,
    table,
    format,
    'Exportar base de clientes',
  );
}
