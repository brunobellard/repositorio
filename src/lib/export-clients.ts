// Backup / exportação da base de clientes em CSV (Excel em português).
import { csvMoney, ddmmyyyy, shareCsv, toCsv } from '@/lib/export-files';
import { formatPhone } from '@/lib/format';
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
  if (filter === 'todas') return [...d.clients].sort((a, b) => a.name.localeCompare(b.name));
  // Inativas = mesma regra de "Para chamar de volta": sem visita há mais de N dias e sem horário marcado
  return clientsToRecall(d.clients, d.appointments, d.recallDays).map((r) => r.client);
}

export async function exportClientsCsv(d: ClientsData, filter: ClientFilter) {
  const list = clientsForExport(d, filter);
  const nowIso = new Date().toISOString();

  const rows = list.map((c) => {
    const done = d.appointments.filter((a) => a.clientId === c.id && a.status === 'concluido');
    // Sessões de pacote já foram pagas na venda: conta o valor do pacote, não o de cada sessão
    const spent =
      done.filter((a) => !a.clientPackageId).reduce((t, a) => t + a.totalPrice, 0) +
      d.packages.filter((p) => p.clientId === c.id).reduce((t, p) => t + p.totalPaid, 0);
    const last = done
      .filter((a) => a.startsAt <= nowIso)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0]?.startsAt;
    return [
      c.name,
      formatPhone(c.whatsapp),
      c.email ?? '',
      c.birthDate ? c.birthDate.split('-').reverse().join('/') : '',
      csvMoney(spent),
      last ? ddmmyyyy(last) : '',
      (c.technicalNotes ?? '').replace(/\s*\n\s*/g, ' '),
    ];
  });

  const csv = toCsv(
    ['Nome', 'WhatsApp', 'E-mail', 'Data de Nascimento', 'Total Gasto (R$)', 'Última Visita', 'Observações Técnicas'],
    rows,
  );
  const stamp = ddmmyyyy(new Date()).split('/').reverse().join('-');
  await shareCsv(
    filter === 'todas' ? `clientes-${stamp}` : `clientes-inativas-${stamp}`,
    csv,
    'Exportar base de clientes',
  );
}
