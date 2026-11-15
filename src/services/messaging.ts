// Envio de mensagens (WhatsApp / e-mail).
//
// Hoje o WhatsApp funciona por deep link: abre o app do WhatsApp com o
// número e a mensagem prontos, e a profissional só toca em "enviar".
// Para envio automático no futuro, basta criar outro WhatsAppProvider
// (Evolution API, WhatsApp Cloud API) e trocar `whatsappProvider` abaixo.
// O e-mail será enviado por uma Supabase Edge Function usando Resend.
import { Linking } from 'react-native';

import { formatTime, relativeDayPhrase } from '@/lib/dates';
import { formatBRL } from '@/lib/format';
import type { Appointment, Client, MessageTemplate, Profile } from '@/types';

export interface TemplateVars {
  nome: string;
  servico: string;
  data: string;
  hora: string;
  valor: string;
  estudio: string;
}

export function buildVars(appt: Appointment, client: Client, profile: Profile): TemplateVars {
  const start = new Date(appt.startsAt);
  return {
    nome: client.name.split(' ')[0],
    servico: appt.services.map((s) => s.name).join(' + '),
    data: relativeDayPhrase(start),
    hora: formatTime(start),
    valor: formatBRL(appt.totalPrice),
    estudio: profile.businessName,
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
) {
  if (!client.whatsapp) throw new Error('Cliente sem WhatsApp cadastrado');
  const message = fillTemplate(template.body, buildVars(appt, client, profile));
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
