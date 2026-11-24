export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** 11987654321 -> (11) 98765-4321 */
export function formatPhone(digits?: string): string {
  if (!digits) return '';
  const d = digits.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Busca sem acento e sem diferenciar maiúsculas. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export const onlyDigits = (s: string | undefined) => (s ?? '').replace(/\D/g, '');

/** E-mail com formato válido: nome@dominio.ext (sem espaços; extensão com 2+ letras). */
/** Celular/fixo brasileiro com DDD: 10 ou 11 dígitos (mesma regra do link público). */
export const isValidPhone = (s: string | undefined) => {
  const n = onlyDigits(s).length;
  return n === 10 || n === 11;
};

export const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(s.trim());

/**
 * Dígitos de um telefone brasileiro, sem código do país nem zeros de discagem.
 * Ex. colado do WhatsApp: "+55 11 98765-4321" -> "11987654321"; "0055..." e "011..." também.
 * Só remove quando sobra mais de 11 dígitos (o DDD 55 do RS continua valendo).
 */
export function phoneDigitsBR(input: string | undefined): string {
  let d = onlyDigits(input);
  if (d.length > 11 && d.startsWith('00')) d = d.slice(2);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length > 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

/** Máscara progressiva de telefone, para usar enquanto digita (aceita número colado com +55). */
export function maskPhone(input: string): string {
  const d = phoneDigitsBR(input).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00), conforme a quantidade de dígitos. */
export function maskDocument(input: string): string {
  const d = onlyDigits(input).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function maskZip(input: string): string {
  const d = onlyDigits(input).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Máscara de moeda: os dígitos digitados viram centavos (1234 -> R$ 12,34). */
export function maskBRL(input: string): { text: string; value: number } {
  const cents = Number(onlyDigits(input).slice(0, 9) || '0');
  const value = cents / 100;
  return { text: formatBRL(value), value };
}

/** Máscara de hora HH:mm enquanto digita. */
export function maskTime(input: string): string {
  const d = onlyDigits(input).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}
