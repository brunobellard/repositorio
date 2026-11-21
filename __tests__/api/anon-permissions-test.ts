// CT-SEG: permissões de quem NÃO está logado (link público / qualquer pessoa na internet).
// Seguro para rodar em produção: só leituras e tentativas de escrita que o banco deve recusar.
import { describe, expect, it } from '@jest/globals';

import { configured, MISSING_SLUG, newClient } from './supabase';

const d = configured ? describe : describe.skip;
const db = newClient();
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

d('sem login: dados dos estúdios ficam fechados (RLS)', () => {
  for (const table of ['profiles', 'clients', 'appointments', 'appointment_services', 'transactions', 'client_packages', 'schedule_blocks', 'services', 'message_templates', 'business_hours']) {
    it(`CT-SEG-01 não lê nada de ${table}`, async () => {
      const { data, error } = await db.from(table).select('*').limit(1);
      // RLS: ou devolve lista vazia, ou recusa a consulta; nunca devolve linhas
      if (error) expect(error.code).toBeTruthy();
      else expect(data).toEqual([]);
    });
  }

  it('CT-SEG-02 não grava cliente', async () => {
    const { error } = await db.from('clients').insert({ name: 'QA intruso' });
    expect(error).not.toBeNull();
  });

  it('CT-SEG-03 não lê o registro de IPs do link', async () => {
    const { data, error } = await db.from('online_booking_log').select('*').limit(1);
    expect(error ?? (data?.length ? 'linhas visíveis' : null)).not.toBeNull();
  });
});

d('sem login: funções restritas', () => {
  it('CT-SEG-04 não executa a exclusão de conta', async () => {
    const { error } = await db.rpc('delete_account', { p_owner: FAKE_ID });
    expect(error).not.toBeNull();
  });

  it('CT-SEG-05 não executa a limpeza de dados da conta', async () => {
    const { error } = await db.rpc('purge_account_data', { p_owner: FAKE_ID });
    expect(error).not.toBeNull();
  });

  it('CT-SEG-06 resumo do histórico não mostra clientes de ninguém', async () => {
    const { data, error } = await db.rpc('client_history_summary');
    if (error) expect(error.code).toBeTruthy();
    else expect(data).toEqual([]);
  });

  it('CT-SEG-07 não exclui pacote de ninguém', async () => {
    const { error } = await db.rpc('delete_package', { p_package_id: FAKE_ID });
    expect(error).not.toBeNull();
  });

  it('CT-SEG-08 não anonimiza cliente de ninguém', async () => {
    const { data, error } = await db.rpc('anonymize_client', { p_client_id: FAKE_ID });
    expect(error ?? (data && (data as { id?: string }).id ? 'alterou' : null)).not.toBe('alterou');
  });

  it('CT-SEG-09 não cria agendamento pela fila offline', async () => {
    const { error } = await db.rpc('create_offline_appointment', {
      p_appointment: { id: FAKE_ID, client_id: FAKE_ID, starts_at: '2030-01-01T12:00:00Z', ends_at: '2030-01-01T13:00:00Z', total_price: 1 },
      p_services: [{ service_id: FAKE_ID, name: 'x', price: 1, duration_min: 60, position: 1 }],
    });
    expect(error).not.toBeNull();
  });

  // BUG-005: funções do app logado devem ser recusadas por permissão (42501) antes de rodar,
  // não só "não achar nada" por causa do RLS.
  for (const [fn, args] of [
    ['client_history_summary', {}],
    ['delete_package', { p_package_id: FAKE_ID }],
    ['create_offline_appointment', { p_appointment: {}, p_services: [] }],
    ['anonymize_client', { p_client_id: FAKE_ID }],
    ['plan_rank', { p_tier: 'pro' }],
    // 414d88b: "Remover dados de exemplo" (Ajustes) só para quem está logado
    ['remove_example_data', {}],
  ] as const) {
    it(`CT-SEG-11 sem permissão para executar ${fn}`, async () => {
      const { error } = await db.rpc(fn, args);
      expect(error?.message).toMatch(/permission denied for function/);
    });
  }
});

d('link público', () => {
  it('CT-LNK-01 estúdio inexistente não devolve dados', async () => {
    const { data } = await db.rpc('public_studio', { p_slug: MISSING_SLUG });
    expect(data ?? null).toBeNull();
  });

  it('CT-LNK-02 horários ocupados de estúdio inexistente: lista vazia', async () => {
    const { data, error } = await db.rpc('get_public_busy_slots', {
      p_slug: MISSING_SLUG,
      p_start_date: '2030-01-01',
      p_end_date: '2030-01-10',
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('CT-LNK-03 reserva em estúdio inexistente é recusada com mensagem em português', async () => {
    const { error } = await db.rpc('create_public_booking', {
      p_slug: MISSING_SLUG,
      p_service_ids: [FAKE_ID],
      p_starts_at: '2030-01-01T12:00:00Z',
      p_name: 'Cliente QA',
      p_whatsapp: '11999999999',
    });
    expect(error?.message).toBe('Estúdio não encontrado');
  });
});

const slug = process.env.QA_STUDIO_SLUG;
(configured && slug ? describe : describe.skip)('link público de um estúdio real (QA_STUDIO_SLUG)', () => {
  it('CT-LNK-04 estúdio existe e informa se o link está liberado', async () => {
    const { data, error } = await db.rpc('public_studio', { p_slug: slug });
    expect(error).toBeNull();
    expect(typeof (data as { booking_enabled?: boolean }).booking_enabled).toBe('boolean');
  });

  it('CT-LNK-05 período enorme não dá erro e fica limitado aos próximos ~95 dias (grupo 5)', async () => {
    const { data, error } = await db.rpc('get_public_busy_slots', { p_slug: slug, p_start_date: '2000-01-01', p_end_date: '2099-12-31' });
    expect(error).toBeNull();
    const limit = Date.now() + 97 * 86_400_000;
    const from = Date.now() - 3 * 86_400_000;
    for (const b of (data ?? []) as { start_time: string; end_time: string }[]) {
      expect(new Date(b.start_time).getTime()).toBeLessThan(limit);
      expect(new Date(b.end_time).getTime()).toBeGreaterThan(from);
    }
  });

  it('CT-LNK-06 nome curto é recusado antes de gravar qualquer coisa', async () => {
    const { error } = await db.rpc('create_public_booking', {
      p_slug: slug,
      p_service_ids: [FAKE_ID],
      p_starts_at: '2030-01-01T12:00:00Z',
      p_name: 'A',
      p_whatsapp: '11999999999',
    });
    expect(error?.message).toMatch(/nome completo|não está recebendo/);
  });

  it('CT-LNK-07 mais de 6 serviços é recusado', async () => {
    const { error } = await db.rpc('create_public_booking', {
      p_slug: slug,
      p_service_ids: Array.from({ length: 7 }, (_, i) => `00000000-0000-4000-8000-00000000000${i}`),
      p_starts_at: '2030-01-01T12:00:00Z',
      p_name: 'Cliente QA',
      p_whatsapp: '11999999999',
    });
    expect(error?.message).toMatch(/1 a 6 serviços|não está recebendo/);
  });
});
