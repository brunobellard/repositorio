// Envio de mensagens (WhatsApp / e-mail).
//
// Hoje o WhatsApp funciona por deep link: abre o app do WhatsApp com o
// número e a mensagem prontos, e a profissional só toca em "enviar".
// Para envio automático no futuro, basta criar outro WhatsAppProvider
// (Evolution API, WhatsApp Cloud API) e trocar `whatsappProvider` abaixo.
// O e-mail será enviado por uma Supabase Edge Function usando Resend.
import { Linking } from 'react-native';

import { formatTime, relativeDayPhrase } from '@/lib/dates';
import { formatBRL, formatPhone, maskDocument } from '@/lib/format';
import { formatAddress } from '@/lib/hours';
import { amountDue } from '@/lib/packages';
import type { Appointment, Client, ClientPackage, MessageTemplate, Profile } from '@/types';

export interface TemplateVars {
  nome: string;
  servico: string;
  data: string;
  hora: string;
  valor: string;
  estudio: string;
  endereco: string;
}

/**
 * Variáveis das mensagens de um atendimento.
 * {endereco} é onde o atendimento acontece: o endereço da cliente quando é a domicílio.
 * {valor} é o que falta pagar (sem a parte já paga no pacote, quando os pacotes são informados).
 */
export function buildVars(
  appt: Appointment,
  client: Client,
  profile: Profile,
  packages: ClientPackage[] = [],
): TemplateVars {
  const start = new Date(appt.startsAt);
  const home = appt.locationType === 'home_service';
  return {
    nome: client.name.split(' ')[0],
    servico: appt.services.map((s) => s.name).join(' + '),
    data: relativeDayPhrase(start),
    hora: formatTime(start),
    valor: formatBRL(amountDue(appt, packages)),
    estudio: profile.businessName,
    endereco: home ? appt.serviceAddress || client.address || 'no seu endereço' : formatAddress(profile),
  };
}

export function fillTemplate(text: string, vars: TemplateVars): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? vars[key as keyof TemplateVars] : match,
  );
}

// ---------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------
export interface WhatsAppProvider {
  readonly id: 'deeplink' | 'evolution' | 'cloud_api';
  send(phoneDigits: string, message: string): Promise<void>;
}

/** Adiciona o código do Brasil quando o número vem só com DDD. */
function toInternational(digits: string): string {
  const d = digits.replace(/\D/g, '');
  return d.length <= 11 ? `55${d}` : d;
}

export const deepLinkProvider: WhatsAppProvider = {
  id: 'deeplink',
  async send(phoneDigits, message) {
    const url = `https://wa.me/${toInternational(phoneDigits)}?text=${encodeURIComponent(message)}`;
    await Linking.openURL(url);
  },
};

export const whatsappProvider: WhatsAppProvider = deepLinkProvider;

export async function sendWhatsApp(
  template: MessageTemplate,
  appt: Appointment,
  client: Client,
  profile: Profile,
  packages: ClientPackage[] = [],
) {
  if (!client.whatsapp) throw new Error('Cliente sem WhatsApp cadastrado');
  const message = fillTemplate(template.body, buildVars(appt, client, profile, packages));
  await whatsappProvider.send(client.whatsapp, message);
}

// ---------------------------------------------------------------------
// E-mail (estrutura pronta; envio real depende da Edge Function)
// ---------------------------------------------------------------------
export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<void>;
}

export const emailProvider: EmailProvider = {
  async send(to, subject, body) {
    // TODO: chamar supabase.functions.invoke('send-email', { body: { to, subject, body } })
    console.log('[email simulado]', { to, subject, body });
  },
};

/**
 * Cabeçalho do estúdio para e-mails e recibos: logo, nome, razão social,
 * CPF/CNPJ, endereço e contatos — tudo vindo de Ajustes > Dados do estúdio.
 */
export function studioHeaderLines(profile: Profile): string[] {
  return [
    profile.businessName,
    profile.tradeName,
    profile.document ? `${profile.document.length > 11 ? 'CNPJ' : 'CPF'} ${maskDocument(profile.document)}` : '',
    formatAddress(profile),
    [profile.phone ? formatPhone(profile.phone) : '', profile.instagram ? `@${profile.instagram}` : '', profile.email]
      .filter(Boolean)
      .join(' · '),
  ].filter((l): l is string => !!l);
}

/** Corpo do e-mail em HTML com o cabeçalho do estúdio (usado pela Edge Function de envio). */
export function composeEmailHtml(profile: Profile, body: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const [name, ...rest] = studioHeaderLines(profile);
  const logo = profile.logoUrl
    ? `<img src="${profile.logoUrl}" alt="" width="64" height="64" style="border-radius:16px;object-fit:cover" />`
    : '';
  return `<div style="font-family:-apple-system,Segoe UI,Inter,sans-serif;color:#2A2326;max-width:560px">
  <div style="border-bottom:1px solid #EFE9E7;padding-bottom:16px;margin-bottom:16px">${logo}
    <div style="font-size:18px;font-weight:600;margin-top:8px">${esc(name ?? '')}</div>
    ${rest.map((l) => `<div style="font-size:12px;color:#8A7F83">${esc(l)}</div>`).join('')}
  </div>
  <div style="font-size:15px;line-height:1.5;white-space:pre-line">${esc(body)}</div>
</div>`;
}
