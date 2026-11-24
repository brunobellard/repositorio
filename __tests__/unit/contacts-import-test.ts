// CT-IMP: importar clientes dos contatos do celular (src/lib/contacts-import.ts)
import { describe, expect, it } from '@jest/globals';

import { toImportCandidates } from '@/lib/contacts-import';

import { client } from '../fixtures';

describe('importar contatos', () => {
  it('CT-IMP-01 usa o nome completo e normaliza o número com +55', () => {
    const [c] = toImportCandidates([{ id: 'x', fullName: 'Bia  Lima', phones: [{ number: '+55 (21) 99876-5432' }] }], []);
    expect(c).toEqual({ id: 'x', name: 'Bia Lima', whatsapp: '21998765432', existing: false });
  });

  it('CT-IMP-02 prefere o celular e ignora número inválido', () => {
    const [c] = toImportCandidates(
      [{ id: 'x', givenName: 'Carla', familyName: 'Dias', phones: [{ number: '123' }, { number: '(11) 3333-4444' }, { number: '11 91234-5678' }] }],
      [],
    );
    expect(c.name).toBe('Carla Dias');
    expect(c.whatsapp).toBe('11912345678');
    const [semNumero] = toImportCandidates([{ id: 'y', fullName: 'Duda', phones: [{ number: '123' }] }], []);
    expect(semNumero.whatsapp).toBe('');
  });

  it('CT-IMP-03 marca quem já é cliente (pelo telefone ou pelo nome sem telefone)', () => {
    const list = toImportCandidates(
      [
        { id: 'a', fullName: 'Ana S.', phones: [{ number: '+5511987654321' }] },
        { id: 'b', fullName: 'Érica Melo' },
        { id: 'c', fullName: 'Nova Pessoa', phones: [{ number: '11999990000' }] },
      ],
      [client(), client({ id: 'c2', name: 'erica melo', whatsapp: undefined })],
    );
    expect(list.map((c) => [c.id, c.existing])).toEqual([
      ['a', true],
      ['b', true],
      ['c', false],
    ]);
  });

  it('CT-IMP-04 ignora contato sem nome e repetido; cliente removida não conta', () => {
    const list = toImportCandidates(
      [
        { id: 'a', fullName: '', phones: [{ number: '11911112222' }] },
        { id: 'b', fullName: 'Lia', phones: [{ number: '11911112222' }] },
        { id: 'c', fullName: 'Lia (Google)', phones: [{ number: '+55 11 91111-2222' }] },
      ],
      [client({ whatsapp: '11911112222', removed: true })],
    );
    expect(list).toEqual([{ id: 'b', name: 'Lia', whatsapp: '11911112222', existing: false }]);
  });
});
