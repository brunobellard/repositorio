// Regras dos eventos de uso (puras, testáveis sem banco). Ver src/lib/analytics.ts.

export type EventValue = string | number | boolean | null | undefined;
export type EventProps = Record<string, EventValue>;

const MAX_STRING = 40;

/** Nome válido para o banco: minúsculas e "_" (3 a 48 caracteres). */
export const isValidEventName = (name: string) => /^[a-z][a-z_]{2,47}$/.test(name);

/**
 * Só valores simples e curtos: números, booleanos e códigos de até 40 caracteres.
 * Objetos, listas e textos longos (que poderiam carregar algo digitado) são descartados.
 */
export function sanitizeProps(props: EventProps = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!/^[a-z][a-z_]{0,31}$/.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'boolean') out[k] = v;
    // Textos: só códigos curtos; nada com espaço, @ ou 8+ dígitos seguidos (parece telefone ou documento)
    else if (typeof v === 'string' && v.length <= MAX_STRING && !/[@\s]/.test(v) && !/\d{8,}/.test(v)) out[k] = v;
  }
  return out;
}
