// Importar clientes da agenda do celular: transforma os contatos em candidatos
// e marca quem já é cliente (mesmo telefone ou mesmo nome sem telefone).
import { isValidPhone, phoneDigitsBR } from '@/lib/format';
import type { Client } from '@/types';

export interface PhoneContact {
  id: string;
  fullName?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  phones?: { number?: string; label?: string }[] | null;
}

export interface ImportCandidate {
  id: string;
  name: string;
  /** Só dígitos, com DDD (10 ou 11); vazio se o contato não tem um número brasileiro válido */
  whatsapp: string;
  /** Já existe uma cliente com este telefone (ou com este nome, quando não há telefone) */
  existing: boolean;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** Prefere celular (11 dígitos com 9 depois do DDD); senão o primeiro número válido. */
function bestPhone(phones: PhoneContact['phones']): string {
  const valid = (phones ?? []).map((p) => phoneDigitsBR(p.number)).filter((d) => isValidPhone(d));
  return valid.find((d) => d.length === 11 && d[2] === '9') ?? valid[0] ?? '';
}

export function toImportCandidates(contacts: PhoneContact[], clients: Client[]): ImportCandidate[] {
  const active = clients.filter((c) => !c.removed);
  const phones = new Set(active.map((c) => phoneDigitsBR(c.whatsapp)).filter(Boolean));
  const names = new Set(active.map((c) => norm(c.name)));
  const seen = new Set<string>();
  const out: ImportCandidate[] = [];
  for (const c of contacts) {
    const name = (c.fullName || [c.givenName, c.familyName].filter(Boolean).join(' ')).trim().replace(/\s+/g, ' ');
    const whatsapp = bestPhone(c.phones);
    if (!name) continue;
    // O mesmo contato repetido na agenda (ex: conta Google e chip) aparece uma vez só
    const key = whatsapp || `nome:${norm(name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const existing = whatsapp ? phones.has(whatsapp) : names.has(norm(name));
    out.push({ id: c.id, name, whatsapp, existing });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
