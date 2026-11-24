// CT-MSG: link de confirmação nas mensagens do WhatsApp (src/services/messaging.ts)
import { describe, expect, it } from '@jest/globals';

import { mockProfile } from '@/data/mock';
import { composeWhatsApp } from '@/services/messaging';
import type { MessageTemplate } from '@/types';

import { appt, client } from '../fixtures';

process.env.EXPO_PUBLIC_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://exemplo.expo.app';

const confirmacao: MessageTemplate = { channel: 'whatsapp', kind: 'confirmacao', body: 'Olá {nome}! Até {data}.' };
const recibo: MessageTemplate = { channel: 'whatsapp', kind: 'recibo', body: 'Obrigada, {nome}! {link}' };
const future = appt({ confirmToken: 'tok-123', startsAt: '2099-03-04T13:00:00.000Z', endsAt: '2099-03-04T14:00:00.000Z' });

describe('link de confirmação', () => {
  it('CT-MSG-01 confirmação de horário futuro leva o link no final', () => {
    const text = composeWhatsApp(confirmacao, future, client(), mockProfile);
    expect(text).toMatch(/\n\nConfirme ou cancele seu horário: https?:\/\/\S+\/confirmar\/tok-123$/);
  });

  it('CT-MSG-02 com {link} no modelo, o link vai no lugar dele (sem repetir no final)', () => {
    const tpl = { ...confirmacao, body: 'Confirme aqui: {link}' };
    const text = composeWhatsApp(tpl, future, client(), mockProfile);
    expect(text.match(/\/confirmar\/tok-123/g)).toHaveLength(1);
    expect(text).not.toContain('Confirme ou cancele');
  });

  it('CT-MSG-03 sem link em recibo, horário passado, cancelado ou ainda sem código', () => {
    expect(composeWhatsApp(recibo, future, client(), mockProfile)).not.toContain('/confirmar/');
    const past = appt({ confirmToken: 'tok-123', startsAt: '2000-01-01T13:00:00.000Z' });
    expect(composeWhatsApp(confirmacao, past, client(), mockProfile)).not.toContain('/confirmar/');
    const cancelled = { ...future, status: 'cancelado' as const };
    expect(composeWhatsApp(confirmacao, cancelled, client(), mockProfile)).not.toContain('/confirmar/');
    const noToken = { ...future, confirmToken: undefined };
    expect(composeWhatsApp(confirmacao, noToken, client(), mockProfile)).not.toContain('Confirme ou cancele');
  });
});
