// Filtro do Sentry/PostHog: nada de e-mail, documento, telefone, nome, endereço ou anotação sai do aparelho.
import { describe, expect, it } from '@jest/globals';

import { safeProps, scrubBreadcrumb, scrubEvent, scrubText, scrubUrl } from '@/lib/telemetry-scrub';

describe('telemetria sem dados sensíveis', () => {
  it('troca e-mail, CPF, CNPJ, telefone e tokens por marcadores', () => {
    const out = scrubText(
      'falhou para maria.silva+1@gmail.com cpf 123.456.789-09 cnpj 12.345.678/0001-90 tel (11) 98765-4321 jwt eyJhbGciOi.eyJzdWIiOiIx.abcdefghij chave ' + 'sb_' + 'secret_exemplo',
    );
    expect(out).not.toMatch(/maria|123\.456|12\.345|98765|eyJ|sb_secret/);
    expect(out).toContain('[email]');
    expect(out).toContain('[numero]');
    expect(out).toContain('[token]');
    expect(out).toContain('[chave]');
  });

  it('mantém números curtos (horas, quantidades, códigos de erro)', () => {
    expect(scrubText('erro 23P01 às 14:30, 3 serviços')).toBe('erro 23P01 às 14:30, 3 serviços');
  });

  it('tira filtros e âncoras das URLs', () => {
    expect(scrubUrl('https://x.supabase.co/rest/v1/clients?phone=eq.11987654321#a')).toBe(
      'https://x.supabase.co/rest/v1/clients',
    );
    expect(scrubText('GET https://x.supabase.co/rest/v1/clients?name=eq.Ana falhou')).toBe(
      'GET https://x.supabase.co/rest/v1/clients falhou',
    );
  });

  it('traits e propriedades: só códigos curtos e nenhuma chave sensível', () => {
    expect(
      safeProps({
        plan: 'basic',
        email: 'a@b.com',
        owner_name: 'Ana',
        cpf: '12345678909',
        phone: 'x',
        notes: 'alergia',
        address: 'rua',
        password: 'segredo',
        n_services: 2,
      }),
    ).toEqual({ plan: 'basic', n_services: 2 });
  });

  it('descarta toques e logs comuns; limpa os demais breadcrumbs', () => {
    expect(scrubBreadcrumb({ category: 'touch', message: 'Maria Souza' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'ui.click', message: 'Maria Souza' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'console', level: 'log', message: 'qualquer coisa' })).toBeNull();
    const b = scrubBreadcrumb({
      category: 'fetch',
      data: { url: 'https://x.supabase.co/rest/v1/clients?phone=eq.11987654321', method: 'GET', client_name: 'Ana' },
    });
    expect(b?.data).toEqual({ url: 'https://x.supabase.co/rest/v1/clients', method: 'GET' });
  });

  it('evento do Sentry: usuário só com id, sem request/cookies/IP, textos e extras limpos', () => {
    const ev = scrubEvent({
      message: 'erro com joao@x.com',
      user: { id: 'uuid-1', email: 'joao@x.com', ip_address: '1.2.3.4', username: 'Joao' },
      request: { url: 'https://app/agendar/estudio?x=1', cookies: 'a=b', headers: { Authorization: 'Bearer y' } },
      exception: { values: [{ value: 'duplicate key (phone)=(11987654321)' }] },
      extra: { where: 'store_save', client: { name: 'Ana', notes: 'alergia' } },
      contexts: { device: { name: 'iPhone de Maria', model: 'iPhone15,2' }, os: { name: 'iOS', version: '19' } },
      breadcrumbs: [{ category: 'touch', message: 'Ana' }, { category: 'event', message: 'appointment_saved' }],
      server_name: 'meu-pc',
    });
    expect(ev.user).toEqual({ id: 'uuid-1' });
    expect(ev.request).toEqual({ url: 'https://app/agendar/estudio' });
    expect(ev.server_name).toBeUndefined();
    expect(ev.message).toBe('erro com [email]');
    expect(ev.exception?.values?.[0].value).toContain('[numero]');
    expect(ev.exception?.values?.[0].value).not.toMatch(/\d{5}/);
    expect(ev.extra).toEqual({ where: 'store_save', client: {} });
    expect(ev.contexts).toEqual({ device: { model: 'iPhone15,2' }, os: { name: 'iOS', version: '19' } });
    expect(ev.breadcrumbs).toEqual([{ category: 'event', message: 'appointment_saved', data: undefined }]);
  });
});
