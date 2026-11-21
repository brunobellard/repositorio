// Filtro de dados sensíveis para o Sentry e o PostHog (regras puras, testáveis sem os SDKs).
// Ver src/services/telemetry.ts.
//
// Defesa em camadas: o app já só manda códigos curtos (sanitizeProps), mas erros e breadcrumbs
// automáticos podem carregar mensagens do banco, endereços com filtros (?phone=eq.…) ou textos
// de tela. Tudo passa por aqui antes de sair do aparelho.
import { sanitizeProps, type EventProps } from '@/lib/analytics-props';

/** Chaves que nunca saem do aparelho, em qualquer nível (traits, propriedades, extras, breadcrumbs). */
const SENSITIVE_KEY =
  /e-?mail|cpf|cnpj|document|phone|telefone|whatsapp|celular|senha|password|passwd|secret|token|auth|cookie|session_key|name|nome|address|endereco|endereço|street|rua|cep|bairro|neighborhood|notes|note|observ|anota|birth|nascimento|instagram|ip_address|card|cartao|cartão/i;

export const isSensitiveKey = (key: string) => SENSITIVE_KEY.test(key);

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const JWT = /eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g;
const API_KEY = /\b(sb_(secret|publishable)_|phc_|sntrys_)[\w-]+/g;
// Sequências de 8+ dígitos, com ou sem pontos, traços, barras, espaços ou parênteses: CPF, CNPJ, telefone, CEP
const LONG_NUMBER = /\+?\(?\d[\d\s().\/-]{6,}\d/g;
// Endereços: mantém o caminho e tira a parte depois de ? ou # (filtros do banco, slugs, tokens)
const URL_QUERY = /(https?:\/\/[^\s?#"']+)[?#][^\s"']*/g;

const MAX_TEXT = 500;

/** Troca e-mails, documentos, telefones, tokens e filtros de URL por marcadores. */
export function scrubText(text: string): string {
  return text
    .slice(0, MAX_TEXT)
    .replace(URL_QUERY, '$1')
    .replace(JWT, '[token]')
    .replace(API_KEY, '[chave]')
    .replace(EMAIL, '[email]')
    .replace(LONG_NUMBER, (m) => (m.replace(/\D/g, '').length >= 8 ? '[numero]' : m));
}

/** Endereço sem a parte de consulta (?…) e sem âncora (#…). */
export function scrubUrl(url: string): string {
  return scrubText(url.split(/[?#]/)[0] ?? '');
}

/** Limpa um valor qualquer: descarta chaves sensíveis e passa os textos pelo scrubText. */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return scrubText(value);
  if (depth >= 4) return '[...]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrubValue(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) continue;
      out[k] = /url$/i.test(k) && typeof v === 'string' ? scrubUrl(v) : scrubValue(v, depth + 1);
    }
    return out;
  }
  return undefined; // funções, símbolos etc.
}

/** Propriedades de evento e traits: as regras do sanitizeProps (códigos curtos) + chaves sensíveis fora. */
export function safeProps(props?: EventProps): Record<string, string | number | boolean> {
  const out = sanitizeProps(props);
  for (const k of Object.keys(out)) if (isSensitiveKey(k)) delete out[k];
  return out;
}

// ---------------------------------------------------------------------
// Formatos mínimos dos eventos do Sentry (só o que o filtro lê ou altera)
// ---------------------------------------------------------------------
export interface ScrubBreadcrumb {
  category?: string;
  level?: string;
  message?: string;
  data?: Record<string, unknown>;
}

interface ScrubEvent {
  message?: string;
  user?: { id?: string | number };
  request?: { url?: string };
  exception?: { values?: { value?: string }[] };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: ScrubBreadcrumb[];
  transaction?: string;
  spans?: { description?: string; data?: Record<string, unknown> }[];
  server_name?: string;
}

/**
 * Breadcrumb que pode sair do aparelho, já limpo; null para descartar.
 * Toques ("touch"/"ui.click") levam o texto do elemento tocado, que pode ser o nome de uma cliente,
 * e logs comuns do console podem levar qualquer coisa: ambos ficam de fora.
 */
export function scrubBreadcrumb<T extends ScrubBreadcrumb>(b: T): T | null {
  const category = b.category ?? '';
  if (category === 'touch' || category.startsWith('ui.')) return null;
  if (category === 'console' && b.level !== 'error' && b.level !== 'warning') return null;
  return {
    ...b,
    message: b.message ? scrubText(b.message) : b.message,
    data: b.data ? (scrubValue(b.data) as Record<string, unknown>) : b.data,
  };
}

/** Evento do Sentry (erro ou transação) limpo antes do envio. Muta e devolve o mesmo objeto. */
export function scrubEvent<T extends ScrubEvent>(event: T): T {
  // Usuário: só o id interno da conta (nada de e-mail, nome ou IP)
  event.user = event.user?.id != null ? { id: event.user.id } : undefined;
  if (event.request) {
    event.request = { url: event.request.url ? scrubUrl(event.request.url) : undefined };
  }
  delete event.server_name;
  if (event.message) event.message = scrubText(event.message);
  for (const ex of event.exception?.values ?? []) if (ex.value) ex.value = scrubText(ex.value);
  if (event.extra) event.extra = scrubValue(event.extra) as Record<string, unknown>;
  if (event.contexts) {
    // "name" cai pelo filtro de chaves (o nome do aparelho, ex.: "iPhone de Maria", é dado pessoal),
    // mas o nome do sistema e do motor JS ("iOS", "hermes") é útil e não identifica ninguém
    const keep = (c: unknown) => (c as { name?: unknown } | undefined)?.name;
    const osName = keep(event.contexts.os);
    const runtimeName = keep(event.contexts.runtime);
    const contexts = scrubValue(event.contexts) as Record<string, Record<string, unknown> | undefined>;
    if (typeof osName === 'string' && contexts.os) contexts.os.name = osName;
    if (typeof runtimeName === 'string' && contexts.runtime) contexts.runtime.name = runtimeName;
    event.contexts = contexts;
  }
  if (event.tags) event.tags = scrubValue(event.tags) as Record<string, unknown>;
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => scrubBreadcrumb(b)).filter((b): b is ScrubBreadcrumb => !!b);
  }
  for (const s of event.spans ?? []) {
    if (s.description) s.description = scrubText(s.description);
    if (s.data) s.data = scrubValue(s.data) as Record<string, unknown>;
  }
  return event;
}
