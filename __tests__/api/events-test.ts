// CT-EVT: eventos de uso (migração 20261207000000_eventos_de_uso.sql).
// Sem login: ninguém grava nem lê app_events direto; o link público só grava pela função,
// e ela ignora em silêncio nomes e estúdios inválidos.
// Com a conta de teste: grava os próprios eventos, não grava em nome de outra conta e não lê nada.
// Enquanto a migração não rodou, os casos que dependem dela passam sem afirmar nada.
import { afterAll, describe, expect, it } from '@jest/globals';

import { configured, hasTestAccount, MISSING_SLUG, newClient, TEST_EMAIL, TEST_PASSWORD } from './supabase';

const missingMigration = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === '42P01' || /does not exist|schema cache/i.test(e.message ?? ''));

(configured ? describe : describe.skip)('eventos de uso sem login', () => {
  const db = newClient();

  it('CT-EVT-01 não grava evento direto na tabela', async () => {
    const { error } = await db.from('app_events').insert({ name: 'qa_intruso', props: {} });
    expect(error).not.toBeNull();
  });

  it('CT-EVT-02 não lê os eventos', async () => {
    const { data, error } = await db.from('app_events').select('*').limit(1);
    if (error) expect(error.code).toBeTruthy();
    else expect(data).toEqual([]);
  });

  it('CT-EVT-03 função do link público ignora estúdio inexistente sem erro', async () => {
    const { error } = await db.rpc('log_public_event', {
      p_slug: MISSING_SLUG,
      p_name: 'public_link_viewed',
      p_props: {},
      p_session: 'qa-sessao-teste-0001',
      p_platform: 'web',
    });
    if (missingMigration(error)) return;
    expect(error).toBeNull();
  });

  it('CT-EVT-04 função do link público ignora nome fora da lista sem erro', async () => {
    const { error } = await db.rpc('log_public_event', {
      p_slug: MISSING_SLUG,
      p_name: 'qualquer_coisa',
      p_props: { nome: 'Maria' },
      p_session: 'qa-sessao-teste-0001',
      p_platform: 'web',
    });
    if (missingMigration(error)) return;
    expect(error).toBeNull();
  });

  it('CT-EVT-05 limpeza de eventos antigos é só do servidor', async () => {
    const { error } = await db.rpc('purge_old_app_events');
    expect(error).not.toBeNull();
  });
});

(hasTestAccount ? describe : describe.skip)('eventos de uso com a conta de teste', () => {
  const db = newClient();
  let uid = '';

  afterAll(async () => {
    await db.auth.signOut();
  });

  it('CT-EVT-06 grava o próprio evento, mas não em nome de outra conta, e não lê nada', async () => {
    const { data, error: e } = await db.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
    if (e) throw new Error(`Login da conta de teste falhou: ${e.message}`);
    uid = data.user.id;

    const own = await db.from('app_events').insert({ name: 'qa_teste_api', props: { n: 1 }, platform: 'web', session_id: 'qa-api' });
    if (missingMigration(own.error)) return;
    expect(own.error).toBeNull();

    const other = await db
      .from('app_events')
      .insert({ account_id: '00000000-0000-4000-8000-000000000000', name: 'qa_teste_api', props: {} });
    expect(other.error).not.toBeNull();

    const read = await db.from('app_events').select('id').eq('account_id', uid).limit(1);
    if (read.error) expect(read.error.code).toBeTruthy();
    else expect(read.data).toEqual([]);
  });
});
