-- =====================================================================
-- Agenda Beleza — Marcar e remover dados de exemplo (UX-10 / BUG-006)
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
-- RODAR ANTES do deploy do app: a versão nova grava is_example ao carregar exemplos.
--
-- "Carregar dados de exemplo" passa a marcar as clientes, despesas e folgas que cria.
-- remove_example_data() apaga só o que foi marcado, junto com os atendimentos,
-- pacotes e receitas dessas clientes de exemplo. Dados reais não são tocados.
-- Exemplos carregados antes desta migração não têm a marca e continuam como estão.
-- =====================================================================

alter table clients         add column if not exists is_example boolean not null default false;
alter table transactions    add column if not exists is_example boolean not null default false;
alter table schedule_blocks add column if not exists is_example boolean not null default false;

create or replace function remove_example_data()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid := auth.uid();
  v_clients uuid[];
  v_appts uuid[];
  v_pkgs uuid[];
  n_clients int;
  n_appts int;
  n_tx int;
  n_blocks int;
begin
  if v_owner is null then
    raise exception 'Entre na sua conta para remover os exemplos';
  end if;

  select coalesce(array_agg(id), '{}') into v_clients from clients where owner_id = v_owner and is_example;
  select coalesce(array_agg(id), '{}') into v_appts from appointments where owner_id = v_owner and client_id = any (v_clients);
  select coalesce(array_agg(id), '{}') into v_pkgs from client_packages where owner_id = v_owner and client_id = any (v_clients);

  delete from message_log where owner_id = v_owner and (appointment_id = any (v_appts) or client_id = any (v_clients));
  delete from transactions
   where owner_id = v_owner
     and (is_example or appointment_id = any (v_appts) or client_package_id = any (v_pkgs));
  get diagnostics n_tx = row_count;
  delete from appointment_services where owner_id = v_owner and appointment_id = any (v_appts);
  delete from appointments where owner_id = v_owner and id = any (v_appts);
  get diagnostics n_appts = row_count;
  delete from client_packages where owner_id = v_owner and id = any (v_pkgs);
  delete from schedule_blocks where owner_id = v_owner and is_example;
  get diagnostics n_blocks = row_count;
  delete from clients where owner_id = v_owner and id = any (v_clients);
  get diagnostics n_clients = row_count;

  return jsonb_build_object('clients', n_clients, 'appointments', n_appts, 'transactions', n_tx, 'blocks', n_blocks);
end;
$$;

revoke execute on function remove_example_data() from public, anon;
grant execute on function remove_example_data() to authenticated;
