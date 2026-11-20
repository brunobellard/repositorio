-- =====================================================================
-- Agenda Beleza — Pacotes, taxa de deslocamento e cliente removida
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- 1. Editar os serviços de uma sessão de pacote tirando o serviço do pacote:
--    a sessão deixa de usar o pacote (antes cobrava o preço cheio E ainda
--    gastava o crédito ao concluir).
-- 2. Editar os serviços de um atendimento a domicílio: a taxa de
--    deslocamento sempre entra no total (antes sumia quando o total novo
--    dos serviços era igual ao total antigo).
-- 3. Pacote "vence hoje": vale até o fim do dia no fuso do estúdio (antes,
--    depois das 21h já era recusado, porque o banco usava o dia em UTC).
-- 4. Cliente removida (LGPD): marcada com removed_at, sai do limite do
--    plano Free e o nome dela sai também da descrição da venda do pacote.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 e 2. Edição de agendamentos
-- ---------------------------------------------------------------------
create or replace function update_appointments(
  p_ids            uuid[],
  p_shift          interval default '0',
  p_service_ids    uuid[] default null,
  p_mark_exception boolean default false,
  p_new_group      boolean default false
)
returns setof appointments
language plpgsql security invoker as $$
declare
  v_min   int;
  v_price numeric(10,2);
  grp     uuid := case when p_new_group then gen_random_uuid() end;
  a       appointments;
begin
  if p_service_ids is not null then
    if coalesce(array_length(p_service_ids, 1), 0) = 0 then
      raise exception 'Escolha pelo menos um serviço';
    end if;
    select sum(s.duration_min), sum(s.price) into v_min, v_price
      from services s where s.id = any(p_service_ids) and s.owner_id = auth.uid();
    if v_min is null then
      raise exception 'Serviços não encontrados';
    end if;
  end if;

  -- Ordem que evita esbarrar na própria série ao mover para frente/para trás
  for a in
    select * from appointments
     where id = any(p_ids) and owner_id = auth.uid() and status not in ('concluido', 'cancelado')
     order by case when p_shift > interval '0' then starts_at end desc, starts_at asc
  loop
    update appointments set
      starts_at = a.starts_at + p_shift,
      ends_at   = a.starts_at + p_shift
                  + coalesce(make_interval(mins => v_min), a.ends_at - a.starts_at),
      -- Serviços + taxa de deslocamento (a taxa nunca se perde na troca de serviços)
      total_price = coalesce(v_price + a.travel_fee, a.total_price),
      -- Sem o serviço do pacote, a sessão deixa de usar o pacote (e o crédito fica livre)
      client_package_id = case
        when p_service_ids is not null and a.client_package_id is not null
             and not exists (select 1 from client_packages p
                              where p.id = a.client_package_id and p.service_id = any(p_service_ids))
          then null
        else a.client_package_id end,
      is_recurrence_exception = a.is_recurrence_exception or p_mark_exception,
      recurrence_group_id = case when p_new_group then grp else a.recurrence_group_id end
    where id = a.id;

    if p_service_ids is not null then
      delete from appointment_services where appointment_id = a.id;
      insert into appointment_services (appointment_id, service_id, name, price, duration_min, position)
      select a.id, s.id, s.name, s.price, s.duration_min, array_position(p_service_ids, s.id)
        from services s where s.id = any(p_service_ids) and s.owner_id = auth.uid();
    end if;
  end loop;

  return query select * from appointments where id = any(p_ids) and owner_id = auth.uid() order by starts_at;
end;
$$;

grant execute on function update_appointments(uuid[], interval, uuid[], boolean, boolean) to authenticated;
revoke execute on function update_appointments(uuid[], interval, uuid[], boolean, boolean) from anon, public;

-- A taxa só ajusta o total quando ela própria muda. O total recalculado pelos serviços já
-- vem com a taxa somada (acima); antes o gatilho tentava somar e falhava quando o total não mudava.
create or replace function appointments_keep_travel_fee()
returns trigger language plpgsql as $$
begin
  if new.travel_fee is distinct from old.travel_fee and new.total_price = old.total_price then
    new.total_price := new.total_price - old.travel_fee + new.travel_fee;
  end if;
  return new;
end;
$$;
revoke execute on function appointments_keep_travel_fee() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Validade do pacote no fuso do estúdio
-- ---------------------------------------------------------------------
create or replace function create_appointment(
  p_client_id           uuid,
  p_starts_at           timestamptz,
  p_service_ids         uuid[],
  p_notes               text default null,
  p_status              appointment_status default 'pendente',
  p_recurrence_group_id uuid default null,
  p_recurrence_rule     text default null,
  p_client_package_id   uuid default null,
  p_location_type       text default 'fixed',
  p_service_address     text default null,
  p_travel_fee          numeric default 0
)
returns appointments
language plpgsql security invoker as $$
declare
  total_min   int;
  total_price numeric(10,2);
  v_home      boolean := p_location_type = 'home_service';
  v_fee       numeric(10,2) := case when p_location_type = 'home_service' then greatest(coalesce(p_travel_fee, 0), 0) else 0 end;
  v_today     date;
  pkg         client_packages;
  appt        appointments;
begin
  if coalesce(array_length(p_service_ids, 1), 0) = 0 then
    raise exception 'Escolha pelo menos um serviço';
  end if;

  select sum(s.duration_min), sum(s.price)
    into total_min, total_price
    from services s
   where s.id = any(p_service_ids) and s.owner_id = auth.uid();

  if total_min is null then
    raise exception 'Serviços não encontrados';
  end if;

  -- Crédito de pacote: precisa ser da mesma cliente, cobrir um dos serviços e ter saldo
  if p_client_package_id is not null then
    select * into pkg from client_packages
     where id = p_client_package_id and owner_id = auth.uid()
     for update;
    if pkg.id is null or pkg.client_id <> p_client_id then
      raise exception 'Pacote não encontrado para esta cliente';
    end if;
    if not (pkg.service_id = any(p_service_ids)) then
      raise exception 'O pacote não cobre nenhum dos serviços escolhidos';
    end if;
    -- "Hoje" no fuso do estúdio (o banco roda em UTC)
    select (now() at time zone coalesce(nullif(timezone, ''), 'America/Sao_Paulo'))::date
      into v_today from profiles where id = auth.uid();
    if pkg.status <> 'active' or (pkg.expires_at is not null and pkg.expires_at < coalesce(v_today, current_date)) then
      raise exception 'Pacote vencido ou encerrado';
    end if;
    if pkg.total_sessions - pkg.used_sessions - (
         select count(*) from appointments a
          where a.client_package_id = pkg.id and a.status not in ('concluido', 'cancelado')
       ) < 1 then
      raise exception 'O pacote não tem mais sessões disponíveis';
    end if;
  end if;

  insert into appointments (client_id, starts_at, ends_at, status, total_price, notes,
                            recurrence_group_id, recurrence_rule, client_package_id,
                            location_type, service_address, travel_fee)
  values (p_client_id, p_starts_at, p_starts_at + make_interval(mins => total_min), p_status,
          total_price + v_fee, p_notes, p_recurrence_group_id, p_recurrence_rule, p_client_package_id,
          case when v_home then 'home_service' else 'fixed' end,
          case when v_home then p_service_address end,
          v_fee)
  returning * into appt;

  insert into appointment_services (appointment_id, service_id, name, price, duration_min, position)
  select appt.id, s.id, s.name, s.price, s.duration_min, array_position(p_service_ids, s.id)
    from services s
   where s.id = any(p_service_ids) and s.owner_id = auth.uid();

  return appt;
end;
$$;

revoke execute on function create_appointment(uuid, timestamptz, uuid[], text, appointment_status, uuid, text, uuid, text, text, numeric) from anon, public;
grant execute on function create_appointment(uuid, timestamptz, uuid[], text, appointment_status, uuid, text, uuid, text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Cliente removida
-- ---------------------------------------------------------------------
alter table clients add column if not exists removed_at timestamptz;

-- Já removidas antes desta versão (nome trocado e sem contato)
update clients set removed_at = coalesce(updated_at, now())
 where removed_at is null and name = 'Cliente removida' and whatsapp is null and email is null;

-- Apaga os dados pessoais e mantém atendimentos e valores (tudo numa operação só)
create or replace function anonymize_client(p_client_id uuid)
returns clients
language plpgsql security invoker as $$
declare
  c clients;
begin
  update clients set
    name = 'Cliente removida',
    whatsapp = null, email = null, birth_date = null, technical_notes = null,
    address = null, neighborhood = null,
    removed_at = coalesce(removed_at, now())
  where id = p_client_id and owner_id = auth.uid()
  returning * into c;
  if c.id is null then
    raise exception 'Cliente não encontrada';
  end if;

  -- Endereço do atendimento a domicílio também é dado pessoal
  update appointments set service_address = null
   where client_id = p_client_id and owner_id = auth.uid() and service_address is not null;

  -- A venda do pacote guardava o nome da cliente na descrição
  update transactions t set description = p.name || ' — Cliente removida'
    from client_packages p
   where t.client_package_id = p.id and p.client_id = p_client_id
     and t.owner_id = auth.uid() and p.owner_id = auth.uid();

  return c;
end;
$$;
revoke execute on function anonymize_client(uuid) from anon, public;
grant execute on function anonymize_client(uuid) to authenticated;

-- Limite do plano Free: clientes removidas não contam
create or replace function enforce_plan_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  plan text := effective_plan(new.owner_id);
  n    int;
  tz   text;
begin
  if tg_table_name = 'clients' then
    if plan = 'free' then
      select count(*) into n from clients where owner_id = new.owner_id and removed_at is null;
      if n >= 10 then raise exception 'PLAN_LIMIT:clients'; end if;
    end if;

  elsif tg_table_name = 'services' then
    if plan = 'free' and new.active and (tg_op = 'INSERT' or not old.active) then
      select count(*) into n from services where owner_id = new.owner_id and active and id <> new.id;
      if n >= 3 then raise exception 'PLAN_LIMIT:services'; end if;
    end if;

  elsif tg_table_name = 'appointments' then
    if new.recurrence_group_id is not null and plan_rank(plan) < 1 then
      raise exception 'PLAN_LIMIT:recurrence';
    end if;
    if new.source = 'online' and plan_rank(plan) < 2 then
      raise exception 'O agendamento online deste estúdio está desativado.';
    end if;
    if plan = 'free' then
      select timezone into tz from profiles where id = new.owner_id;
      select count(*) into n from appointments
       where owner_id = new.owner_id and status <> 'cancelado'
         and date_trunc('month', starts_at at time zone tz) = date_trunc('month', new.starts_at at time zone tz);
      if n >= 20 then raise exception 'PLAN_LIMIT:appointments'; end if;
    end if;

  elsif tg_table_name = 'client_packages' then
    if plan_rank(plan) < 2 then raise exception 'PLAN_LIMIT:packages'; end if;
  end if;

  return new;
end;
$$;
revoke execute on function enforce_plan_limits() from public, anon, authenticated;

-- Atualiza a lista de funções da API na hora
notify pgrst, 'reload schema';
