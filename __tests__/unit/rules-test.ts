// CT-PLA / CT-CLI / CT-FMT / CT-FUS: planos, retorno de clientes, formatação e fuso horário
import { describe, expect, it } from '@jest/globals';

import { effectivePlan, LIMIT_TO_FEATURE, planHas } from '@/constants/plans';
import { isValidSlug, sanitizeSlugInput, slugify } from '@/lib/booking';
import { formatPhone, maskBRL, maskDocument, maskPhone, normalize } from '@/lib/format';
import { clientsToRecall, fillClientMessage } from '@/lib/recall';
import { zonedInstant, zonedParts } from '@/lib/timezone';
import type { Profile } from '@/types';

import { appt, client, local } from '../fixtures';

describe('planos', () => {
  const now = new Date('2030-03-04T12:00:00Z');

  it('CT-PLA-01 assinatura ativa vale o plano contratado', () => {
    expect(effectivePlan({ planTier: 'pro', subscriptionStatus: 'active' }, now)).toBe('pro');
  });

  it('CT-PLA-02 teste grátis vale até o fim; depois vira Free', () => {
    expect(effectivePlan({ planTier: 'pro', subscriptionStatus: 'trialing', trialEndsAt: '2030-03-05T00:00:00Z' }, now)).toBe('pro');
    expect(effectivePlan({ planTier: 'pro', subscriptionStatus: 'trialing', trialEndsAt: '2030-03-01T00:00:00Z' }, now)).toBe('free');
  });

  it('CT-PLA-03 assinatura cancelada ou atrasada vira Free', () => {
    expect(effectivePlan({ planTier: 'pro', subscriptionStatus: 'canceled' } as Pick<Profile, 'planTier' | 'subscriptionStatus'>, now)).toBe('free');
  });

  it('CT-PLA-04 recursos por plano (Free não tem link nem pacotes)', () => {
    expect(planHas('free', 'packages')).toBe(false);
    expect(planHas('pro', 'packages')).toBe(true);
  });

  it('CT-PLA-05 todo limite do banco tem recurso correspondente no app', () => {
    for (const code of ['clients', 'appointments', 'services', 'recurrence', 'packages', 'homeService']) {
      expect(LIMIT_TO_FEATURE[code]).toBeDefined();
    }
  });
});

describe('retorno de clientes ("Para chamar de volta")', () => {
  const now = local(2030, 6, 1, 12);
  const done = (clientId: string, isoDay: string) =>
    appt({ id: `${clientId}-${isoDay}`, clientId, status: 'concluido', startsAt: `${isoDay}T13:00:00.000Z`, endsAt: `${isoDay}T14:00:00.000Z` });

  it('CT-CLI-01 entra quem passou do prazo e não tem horário marcado', () => {
    const r = clientsToRecall([client()], [done('c1', '2030-04-01')], 30, now);
    expect(r).toHaveLength(1);
    expect(r[0].days).toBe(61);
  });

  it('CT-CLI-02 não entra quem já tem horário futuro', () => {
    const future = appt({ id: 'f', clientId: 'c1', status: 'confirmado', startsAt: '2030-06-10T13:00:00.000Z' });
    expect(clientsToRecall([client()], [done('c1', '2030-04-01'), future], 30, now)).toHaveLength(0);
  });

  it('CT-CLI-03 não entra cliente removida (regressão grupo 3)', () => {
    expect(clientsToRecall([client({ removed: true })], [done('c1', '2030-04-01')], 30, now)).toHaveLength(0);
  });

  it('CT-CLI-04 usa o histórico antigo (> 12 meses) do resumo do banco (regressão grupo 4)', () => {
    const history = { c1: { appointments: 3, lastDoneAt: '2028-01-10T13:00:00.000Z', lastService: 'Manicure' } };
    const r = clientsToRecall([client()], [], 30, now, history);
    expect(r).toHaveLength(1);
    expect(r[0].lastService).toBe('Manicure');
  });

  it('CT-CLI-05 o atendimento carregado mais recente vence o resumo antigo', () => {
    const history = { c1: { appointments: 3, lastDoneAt: '2028-01-10T13:00:00.000Z', lastService: 'Antigo' } };
    expect(clientsToRecall([client()], [done('c1', '2030-05-25')], 30, now, history)).toHaveLength(0);
  });

  it('CT-CLI-06 mensagem troca as variáveis e mantém as desconhecidas', () => {
    const msg = fillClientMessage('Oi {nome}, faz {dias} dias! {xyz}', client({ name: 'Ana Souza' }), { businessName: 'Studio' } as Profile, { dias: 40 });
    expect(msg).toBe('Oi Ana, faz 40 dias! {xyz}');
  });
});

describe('formatação e link', () => {
  it('CT-FMT-01 telefone com 10 e 11 dígitos', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(maskPhone('119876')).toBe('(11) 9876');
  });

  it('CT-FMT-02 CPF e CNPJ', () => {
    expect(maskDocument('12345678901')).toBe('123.456.789-01');
    expect(maskDocument('12345678000199')).toBe('12.345.678/0001-99');
  });

  it('CT-FMT-03 moeda digitada vira centavos', () => {
    expect(maskBRL('1234').value).toBe(12.34);
    expect(maskBRL('').value).toBe(0);
  });

  it('CT-FMT-04 busca sem acento e sem maiúsculas', () => {
    expect(normalize('Cílios ÂNGELA')).toBe('cilios angela');
  });

  it('CT-FMT-05 link do estúdio sem acento, espaço ou símbolo', () => {
    expect(slugify('Ateliê da Ana & Cia!')).toBe('atelie-da-ana-cia');
    expect(isValidSlug('atelie-da-ana')).toBe(true);
    expect(isValidSlug('ab')).toBe(false);
    expect(isValidSlug('-ana')).toBe(false);
    expect(sanitizeSlugInput('  Studio  Ana-')).toBe('studio-ana-');
  });
});

describe('fuso horário do estúdio (link aberto em outro fuso)', () => {
  it('CT-FUS-01 9h no relógio de São Paulo é 12h UTC', () => {
    expect(zonedInstant(local(2030, 3, 4), 9 * 60, 'America/Sao_Paulo').toISOString()).toBe('2030-03-04T12:00:00.000Z');
  });

  it('CT-FUS-02 9h em Manaus (UTC−4) é 13h UTC', () => {
    expect(zonedInstant(local(2030, 3, 4), 9 * 60, 'America/Manaus').toISOString()).toBe('2030-03-04T13:00:00.000Z');
  });

  it('CT-FUS-03 instante volta para dia e minutos no relógio do estúdio', () => {
    const p = zonedParts(new Date('2030-03-05T02:30:00.000Z'), 'America/Sao_Paulo');
    expect(p.day.getDate()).toBe(4);
    expect(p.minutes).toBe(23 * 60 + 30);
  });

  it('CT-FUS-04 fuso inválido não quebra (usa o do aparelho)', () => {
    expect(() => zonedInstant(local(2030, 3, 4), 600, 'Fuso/Inexistente')).not.toThrow();
  });
});
