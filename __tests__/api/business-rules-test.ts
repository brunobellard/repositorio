// CT-API: regras de negócio no banco, com a CONTA DE TESTE (produção).
// Só roda com QA_TEST_EMAIL e QA_TEST_PASSWORD definidos (segredos do GitHub ou variáveis locais).
// Tudo o que é criado usa o prefixo "QA " e datas em 2031, e é apagado no final.
// NUNCA use a conta real do estúdio aqui.
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';

import { hasTestAccount, newClient, TEST_EMAIL, TEST_PASSWORD } from './supabase';

const d = hasTestAccount ? describe : describe.skip;

d('regras de negócio (conta de teste)', () => {
  let db: SupabaseClient;
  let uid = '';
  let serviceId = '';
  let servicePrice = 0;
  let createdService = false;
  const clientIds: string[] = [];
  const apptIds: string[] = [];
  const packageIds: string[] = [];
  // Minuto "aleatório" em 2031: execuções seguidas não colidem
  const base = Date.UTC(2031, 2, 3, 12, 0) + (Date.now() % 50_000) * 60_000;
  const at = (offsetMin: number) => new Date(base + offsetMin * 60_000).toISOString();

  async function newTestClient(name = 'QA Cliente') {
    const { data, error } = await db.from('clients').insert({ name: `${name} ${Date.now()}`, whatsapp: '11900000000' }).select().single();
    if (error) throw error;
    clientIds.push(data.id);
    return data.id as string;
  }

  async function book(clientId: string, startsAt: string, extra: Record<string, unknown> = {}) {
    const r = await db.rpc('create_appointment', { p_client_id: clientId, p_starts_at: startsAt, p_service_ids: [serviceId], p_notes: 'QA', ...extra });
    if (r.data?.id) apptIds.push(r.data.id);
    return r;
  }

  beforeAll(async () => {
    db = newClient();
    const { data, error } = await db.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
    if (error) throw new Error(`Login da conta de teste falhou: ${error.message}`);
    uid = data.user.id;
    const { data: services } = await db.from('services').select('id, price').eq('active', true).limit(1);
    if (services?.length) {
      serviceId = services[0].id;
      servicePrice = Number(services[0].price);
    } else {
      const { data: s, error: e } = await db
        .from('services')
        .insert({ name: 'QA Serviço', price: 50, duration_min: 60, category: 'Unhas', active: true })
        .select()
        .single();
      if (e) throw e;
      serviceId = s.id;
      servicePrice = 50;
      createdService = true;
    }
  });

  afterAll(async () => {
    if (!db) return;
    // Ordem: lançamentos → atendimentos → pacotes → clientes → serviço
    if (apptIds.length) {
      await db.from('transactions').delete().in('appointment_id', apptIds);
      await db.from('appointments').delete().in('id', apptIds);
    }
    for (const id of packageIds) await db.rpc('delete_package', { p_package_id: id });
    if (clientIds.length) await db.from('clients').delete().in('id', clientIds);
    if (createdService) await db.from('services').delete().eq('id', serviceId);
    await db.auth.signOut();
  });

  it('CT-API-01 só enxerga os próprios dados (RLS)', async () => {
    const { data, error } = await db.from('clients').select('owner_id').limit(200);
    expect(error).toBeNull();
    expect((data ?? []).every((r) => r.owner_id === uid)).toBe(true);
  });

  it('CT-API-02 agendamento calcula total e "ocupado até"', async () => {
    const c = await newTestClient();
    const { data, error } = await book(c, at(0));
    expect(error).toBeNull();
    expect(Number(data.total_price)).toBe(servicePrice);
    expect(new Date(data.busy_until).getTime()).toBeGreaterThanOrEqual(new Date(data.ends_at).getTime());
  });

  it('CT-API-03 mesmo horário é recusado pelo banco (23P01)', async () => {
    const c = await newTestClient();
    expect((await book(c, at(300))).error).toBeNull();
    const second = await book(c, at(300));
    expect(second.error?.code).toBe('23P01');
  });

  it('CT-API-04 concluir lança a receita uma única vez', async () => {
    const c = await newTestClient();
    const { data: a } = await book(c, at(600));
    const done = await db.rpc('complete_appointment', { p_appointment_id: a.id, p_payment_method: 'pix' });
    expect(done.error).toBeNull();
    const { data: tx } = await db.from('transactions').select('*').eq('appointment_id', a.id);
    expect(tx).toHaveLength(1);
    expect(Number(tx![0].amount)).toBe(servicePrice);
    const again = await db.rpc('complete_appointment', { p_appointment_id: a.id, p_payment_method: 'pix' });
    const { data: tx2 } = await db.from('transactions').select('id').eq('appointment_id', a.id);
    expect(again.error !== null || tx2!.length === 1).toBe(true);
  });

  it('CT-API-05 pacote com sessão marcada não pode ser excluído; sem sessão, sai junto com a receita', async () => {
    const c = await newTestClient();
    const sold = await db.rpc('sell_package', {
      p_client_id: c, p_service_id: serviceId, p_name: 'QA Pacote', p_total_sessions: 2,
      p_total_paid: 80, p_payment_method: 'pix', p_expires_at: null,
    });
    if (/PLAN_LIMIT/.test(sold.error?.message ?? '')) return; // plano da conta de teste sem pacotes
    expect(sold.error).toBeNull();
    packageIds.push(sold.data.id);
    const { data: a, error } = await book(c, at(900), { p_client_package_id: sold.data.id });
    expect(error).toBeNull();
    const blocked = await db.rpc('delete_package', { p_package_id: sold.data.id });
    expect(blocked.error?.message).toMatch(/package_in_use:1/);
    await db.from('appointments').update({ status: 'cancelado' }).eq('id', a.id);
    const ok = await db.rpc('delete_package', { p_package_id: sold.data.id });
    expect(ok.error).toBeNull();
    packageIds.pop();
    const { data: tx } = await db.from('transactions').select('id').eq('client_package_id', sold.data.id);
    expect(tx).toEqual([]);
  });

  it('CT-API-06 agendamento da fila offline entra com os serviços e não duplica', async () => {
    const c = await newTestClient();
    const id = crypto.randomUUID();
    const appointment = { id, client_id: c, starts_at: at(1200), ends_at: at(1260), status: 'pendente', total_price: servicePrice, notes: 'QA offline', source: 'manual', client_package_id: null };
    const services = [{ service_id: serviceId, name: 'QA', price: servicePrice, duration_min: 60, position: 1 }];
    expect((await db.rpc('create_offline_appointment', { p_appointment: appointment, p_services: services })).error).toBeNull();
    apptIds.push(id);
    expect((await db.rpc('create_offline_appointment', { p_appointment: appointment, p_services: services })).error).toBeNull();
    // Consultas separadas: appointment_services tem duas chaves para appointments (simples e "mesmo dono"),
    // e o select aninhado fica ambíguo no PostgREST
    const appts = await db.from('appointments').select('id').eq('id', id);
    expect(appts.error).toBeNull();
    expect(appts.data).toHaveLength(1);
    const items = await db.from('appointment_services').select('service_id').eq('appointment_id', id);
    expect(items.error).toBeNull();
    expect(items.data).toHaveLength(1);
  });

  it('CT-API-07 fila offline recusa agendamento sem serviço', async () => {
    const c = await newTestClient();
    const { error } = await db.rpc('create_offline_appointment', {
      p_appointment: { id: crypto.randomUUID(), client_id: c, starts_at: at(1500), ends_at: at(1560), total_price: 0 },
      p_services: [],
    });
    expect(error).not.toBeNull();
  });

  it('CT-API-08 apagar dados da cliente mantém o histórico e some dos ativos', async () => {
    const c = await newTestClient('QA Removida');
    await book(c, at(1800));
    const { data, error } = await db.rpc('anonymize_client', { p_client_id: c });
    expect(error).toBeNull();
    expect(data.name).toBe('Cliente removida');
    expect(data.whatsapp).toBeNull();
    expect(data.removed_at).not.toBeNull();
    const summary = await db.rpc('client_history_summary');
    expect((summary.data as { client_id: string }[]).some((r) => r.client_id === c)).toBe(true);
  });

  it('CT-API-09 cliente com atendimento não pode ser apagada direto (FK 23503)', async () => {
    const c = await newTestClient();
    await book(c, at(2100));
    const { error } = await db.from('clients').delete().eq('id', c);
    expect(error?.code).toBe('23503');
  });
});
