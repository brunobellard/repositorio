-- =====================================================================
-- Esmero — Pacote com vários serviços (ex: "10 sessões de mão + pé")
--          e repetir um agendamento avulso ao editar (item 6)
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
-- RODAR ANTES do deploy do app que vende pacote com vários serviços.
--
-- Regras:
-- - Os serviços do pacote andam juntos: cada visita usa 1 sessão e precisa ter
--   TODOS os serviços do pacote no atendimento.
-- - O pacote cobre o preço de todos os serviços dele; outros serviços do mesmo
--   horário e a taxa de deslocamento continuam sendo cobrados à parte.
-- - service_id continua existindo (= primeiro serviço), para o app antigo instalado
--   nos celulares seguir funcionando. A lista completa fica em service_ids.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Lista de serviços do pacote
-- ---------------------------------------------------------------------
alter table client_packages add column if not exists service_ids uuid[];
update client_packages set service_ids = array[service_id] where service_ids is null;

-- Mantém service_id e service_ids coerentes, venha a gravação do app novo ou do antigo
create or replace function client_packages_sync_services()
returns trigger language plpgsql as $$
begin
  if new.service_ids is null or coalesce(array_length(new.service_ids, 1), 0) = 0 then
    new.service_ids := array[new.service_id];
  end if;
  new.service_id := new.service_ids[1];
  return new;
end;
$$;
revoke execute on function client_packages_sync_services() from public, anon, authenticated;

drop trigger if exists client_packages_sync_services on client_packages;
create trigger client_packages_sync_services
  before insert or update of service_id, service_ids on client_packages
  for each row execute function client_packages_sync_services();

alter table client_packages alter column service_ids set not null;

-- ---------------------------------------------------------------------
-- 2. Vender pacote com vários serviços
-- ---------------------------------------------------------------------
create or replace function sell_package_services(
  p_client_id      uuid,
  p_service_ids    uuid[],
  p_name           text,
  p_total_sessions int,
  p_total_paid     numeric,
  p_payment_method payment_method,
  p_expires_at     date default null
)
returns client_packages
language plpgsql security invoker as $$
declare
  pkg client_packages;
  v_ids uuid[];
begin
  -- Sem repetidos, na ordem escolhida
  select array_agg(id order by pos) into v_ids
    from (select distinct on (id) id, pos from unnest(p_service_ids) with ordinality as t(id, pos) order by id, pos) x;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Escolha pelo menos um serviço';
  end if;
  if (select count(*) from services where id = any(v_ids) and owner_id = auth.uid()) <> array_length(v_ids, 1) then
    raise exception 'Serviços não encontrados';
  end if;

  insert into client_packages (client_id, service_id, service_ids, name, total_sessions, total_paid, payment_method, expires_at)
  values (p_client_id, v_ids[1], v_ids, p_name, p_total_sessions, p_total_paid, p_payment_method, p_expires_at)
  returning * into pkg;

  if p_total_paid > 0 then
    insert into transactions (type, amount, category, description, payment_method, client_package_id, occurred_at)
    values ('receita', p_total_paid, 'Pacote',
            p_name || ' — ' || (select name from clients where id = p_client_id),
            p_payment_method, pkg.id, now());
  end if;

  return pkg;
end;
$$;

grant execute on function sell_package_services(uuid, uuid[], text, int, numeric, payment_method, date) to authenticated;
revoke execute on function sell_package_services(uuid, uuid[], text, int, numeric, payment_method, date) from anon, public;

-- ---------------------------------------------------------------------
-- 3. Concluir: o pacote cobre o preço de todos os serviços dele
-- ---------------------------------------------------------------------
create or replace function complete_appointment(p_appointment_id uuid, p_payment_method payment_method default null)
returns transactions
language plpgsql security invoker as $$
declare
  appt    appointments;
  tx      transactions;
  covered numeric(10,2) := 0;
  due     numeric(10,2);
begin
  select * into appt from appointments
   where id = p_appointment_id and owner_id = auth.uid()
   for update;

  if appt.id is null then
    raise exception 'Agendamento não encontrado';
  end if;

  -- Valor já pago no pacote: o preço de uma sessão de cada serviço do pacote
  if appt.client_package_id is not null then
    select coalesce(sum(s.price), 0)
      into covered
      from appointment_services s
      join client_packages p on p.id = appt.client_package_id
     where s.appointment_id = appt.id and s.service_id = any(p.service_ids);
  end if;
  due := greatest(appt.total_price - covered, 0);

  if due > 0 and p_payment_method is null then
    raise exception 'Escolha a forma de pagamento';
  end if;

  -- Conclui (o trigger dá baixa no crédito do pacote)
  update appointments set status = 'concluido' where id = appt.id;

  -- Pacote cobriu tudo: nada a lançar
  if due = 0 then
    delete from transactions where appointment_id = appt.id;
    return null;
  end if;

  insert into transactions (type, amount, category, description, payment_method, appointment_id, occurred_at)
  values ('receita', due, 'Serviço',
          (select string_agg(name, ' + ' order by position) from appointment_services where appointment_id = appt.id),
          p_payment_method, appt.id, now())
  on conflict (appointment_id) do update
     set amount = excluded.amount, payment_method = excluded.payment_method
  returning * into tx;

  return tx;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Criar agendamento: o pacote só vale com todos os serviços dele
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

  -- Crédito de pacote: precisa ser da mesma cliente, ter todos os serviços dele e ter saldo
  if p_client_package_id is not null then
    select * into pkg from client_packages
     where id = p_client_package_id and owner_id = auth.uid()
     for update;
    if pkg.id is null or pkg.client_id <> p_client_id then
      raise exception 'Pacote não encontrado para esta cliente';
    end if;
    if not (pkg.service_ids <@ p_service_ids) then
      raise exception 'O atendimento precisa ter todos os serviços do pacote';
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
-- 5. Editar: tirando algum serviço do pacote, a sessão deixa de usar o pacote
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
      -- Sem todos os serviços do pacote, a sessão deixa de usar o pacote (e o crédito fica livre)
      client_package_id = case
        when p_service_ids is not null and a.client_package_id is not null
             and not exists (select 1 from client_packages p
                              where p.id = a.client_package_id and p.service_ids <@ p_service_ids)
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

-- ---------------------------------------------------------------------
-- 6. Repetir um agendamento avulso ao editar
--    O agendamento vira a 1ª sessão de uma série nova; as próximas são criadas
--    com os mesmos serviços, observações e local (tudo numa operação só).
--    As sessões novas não usam pacote (o crédito é escolhido sessão a sessão).
-- ---------------------------------------------------------------------
create or replace function extend_into_series(
  p_appointment_id  uuid,
  p_starts_at       timestamptz[],
  p_recurrence_rule text
)
returns setof appointments
language plpgsql security invoker as $$
declare
  a     appointments;
  grp   uuid := gen_random_uuid();
  v_ids uuid[];
  start timestamptz;
  appt  appointments;
  ids   uuid[];
begin
  select * into a from appointments
   where id = p_appointment_id and owner_id = auth.uid()
   for update;
  if a.id is null then
    raise exception 'Agendamento não encontrado';
  end if;
  if a.recurrence_group_id is not null then
    raise exception 'Este agendamento já faz parte de uma série';
  end if;
  if a.status in ('concluido', 'cancelado') then
    raise exception 'Agendamento concluído ou cancelado não pode virar série';
  end if;
  if coalesce(array_length(p_starts_at, 1), 0) = 0 then
    raise exception 'Nenhuma data para agendar';
  end if;

  select array_agg(service_id order by position) into v_ids
    from appointment_services where appointment_id = a.id;

  update appointments
     set recurrence_group_id = grp, recurrence_rule = p_recurrence_rule
   where id = a.id;
  ids := array[a.id];

  foreach start in array p_starts_at loop
    appt := create_appointment(a.client_id, start, v_ids, a.notes, 'pendente', grp, p_recurrence_rule,
                               null, a.location_type, a.service_address, a.travel_fee);
    ids := ids || appt.id;
  end loop;

  return query select * from appointments where id = any(ids) order by starts_at;
end;
$$;

grant execute on function extend_into_series(uuid, timestamptz[], text) to authenticated;
revoke execute on function extend_into_series(uuid, timestamptz[], text) from anon, public;

-- Atualiza o cache do PostgREST (função nova e coluna nova visíveis na hora)
notify pgrst, 'reload schema';
