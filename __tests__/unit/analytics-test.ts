// Eventos de uso: só nomes válidos e propriedades simples, nunca dados das clientes.
import { describe, expect, it } from '@jest/globals';

import { isValidEventName, sanitizeProps } from '@/lib/analytics-props';

describe('eventos de uso', () => {
  it('aceita nomes em snake_case e recusa o resto', () => {
    expect(isValidEventName('appointment_saved')).toBe(true);
    expect(isValidEventName('Appointment')).toBe(false);
    expect(isValidEventName('ab')).toBe(false);
    expect(isValidEventName('evento com espaço')).toBe(false);
  });

  it('mantém números, booleanos e códigos curtos', () => {
    expect(sanitizeProps({ n_services: 2, used_package: false, origin: 'slot', minutes: 12.345 })).toEqual({
      n_services: 2,
      used_package: false,
      origin: 'slot',
      minutes: 12.35,
    });
  });

  it('descarta texto que pode ser dado pessoal', () => {
    const out = sanitizeProps({
      email: 'cliente@exemplo.com',
      name: 'Maria Silva',
      phone: '11999998888',
      notes: 'x'.repeat(41),
      ok: 'agenda',
    });
    expect(out).toEqual({ ok: 'agenda' });
  });

  it('descarta valores vazios, não finitos e chaves fora do padrão', () => {
    expect(sanitizeProps({ a: null, b: undefined, c: Number.NaN, 'Chave-Ruim': 1, d: Infinity })).toEqual({});
  });
});
