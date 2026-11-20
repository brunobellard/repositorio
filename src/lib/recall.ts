// Retorno de clientes ("Para chamar de volta") e aniversariantes do mês.
import { clientTemplates } from '@/data/mock';
import { startOfDay } from '@/lib/dates';
import { formatAddress } from '@/lib/hours';
import type { Appointment, Client, MessageKind, MessageTemplate, Profile } from '@/types';

export interface RecallInfo {
  client: Client;
  /** Dias desde o último atendimento concluído */
  days: number;
  lastService: string;
  lastAt: string;
}

/**
 * Clientes cujo último atendimento concluído foi há mais de `recallDays` dias
 * e que não têm nenhum horário futuro marcado. Mais antigas primeiro.
 */
export function clientsToRecall(
  clients: Client[],
  appointments: Appointment[],
  recallDays: number,
  now = new Date(),
): RecallInfo[] {
  const today = startOfDay(now).getTime();
  const nowIso = now.toISOString();
  const result: RecallInfo[] = [];
  for (const client of clients) {
    if (client.removed) continue; // removida: só histórico, não se chama de volta
    const mine = appointments.filter((a) => a.clientId === client.id);
    const hasFuture = mine.some(
      (a) => a.startsAt >= nowIso && (a.status === 'pendente' || a.status === 'confirmado'),
    );
    if (hasFuture) continue;
    const last = mine
      .filter((a) => a.status === 'concluido')
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
    if (!last) continue;
    const days = Math.floor((today - startOfDay(new Date(last.startsAt)).getTime()) / 86_400_000);
    if (days <= recallDays) continue;
    result.push({ client, days, lastService: last.services.map((s) => s.name).join(' + '), lastAt: last.startsAt });
  }
  return result.sort((a, b) => b.days - a.days);
}

export interface BirthdayInfo {
  client: Client;
  day: number;
  /** Idade que completa este ano (se o ano de nascimento for conhecido) */
  age?: number;
  isToday: boolean;
  isPast: boolean;
}

/** Aniversariantes do mês atual, em ordem de dia. */
export function birthdaysThisMonth(clients: Client[], now = new Date()): BirthdayInfo[] {
  const month = now.getMonth() + 1;
  return clients
    .filter((c) => c.birthDate && Number(c.birthDate.slice(5, 7)) === month)
    .map((c) => {
      const [y, , d] = c.birthDate!.split('-').map(Number);
      return {
        client: c,
        day: d,
        age: y > 1900 ? now.getFullYear() - y : undefined,
        isToday: d === now.getDate(),
        isPast: d < now.getDate(),
      };
    })
    .sort((a, b) => a.day - b.day);
}

/** Modelo salvo pela profissional ou, se ainda não existir, o padrão. */
export function templateFor(kind: MessageKind, templates: MessageTemplate[]): MessageTemplate {
  return (
    templates.find((t) => t.channel === 'whatsapp' && t.kind === kind) ??
    clientTemplates.find((t) => t.kind === kind)!
  );
}

/** Preenche {nome} {dias} {ultimo_servico} {estudio} {endereco} {instagram} */
export function fillClientMessage(
  body: string,
  client: Client,
  profile: Profile,
  extra: { dias?: number; ultimo_servico?: string } = {},
): string {
  const vars: Record<string, string> = {
    nome: client.name.split(' ')[0],
    dias: extra.dias !== undefined ? String(extra.dias) : '',
    ultimo_servico: extra.ultimo_servico?.toLowerCase() ?? 'atendimento',
    estudio: profile.businessName,
    endereco: formatAddress(profile),
    instagram: profile.instagram ? `@${profile.instagram}` : '',
  };
  return body.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}
