-- =====================================================================
-- Agenda Beleza — Pacote cobre só o próprio serviço e agendamento "tudo ou nada"
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- 1. complete_appointment: o pacote paga UMA sessão do serviço dele.
--    Outros serviços do mesmo horário e a taxa de deslocamento viram receita.
-- 2. create_appointment / create_appointment_series: o crédito do pacote e o
--    atendimento a domicílio são gravados junto com o agendamento (antes eram
--    dois passos separados; se o segundo falhasse, ficava pela metade).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Concluir atendimento
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

  -- Valor já pago no pacote: o preço de uma sessão do serviço do pacote
  if appt.client_package_id is not null then
    select coalesce((
      select s.price
        from appointment_services s
        join client_packages p on p.id = appt.client_package_id
       where s.appointment_id = appt.id and s.service_id = p.service_id
       order by s.position
       limit 1), 0)
      into covered;
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
-- 2. Criar agendamento (com pacote e domicílio na mesma operação)
-- ---------------------------------------------------------------------
drop function if exists create_appointment_series(uuid, timestamptz[], uuid[], text, text);
drop function if exists create_appointment_series(uuid, timestamptz[], uuid[], text, text, uuid, text, text, numeric);
drop function if exists create_appointment(uuid, timestamptz, uuid[], text, appointment_status, uuid, text);
drop function if exists create_appointment(uuid, timestamptz, uuid[], text, appointment_status, uuid, text, uuid, text, text, numeric);

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
    if pkg.status <> 'active' or (pkg.expires_at is not null and pkg.expires_at < current_date) then
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

-- Série: todas as sessões numa só transação (se uma falhar, nenhuma é criada)
create or replace function create_appointment_series(
  p_client_id         uuid,
  p_starts_at         timestamptz[],
  p_service_ids       uuid[],
  p_notes             text default null,
  p_recurrence_rule   text default null,
  p_client_package_id uuid default null,
  p_location_type     text default 'fixed',
  p_service_address   text default null,
  p_travel_fee        numeric default 0
)
returns setof appointments
language plpgsql security invoker as $$
declare
  grp   uuid := case when array_length(p_starts_at, 1) > 1 then gen_random_uuid() end;
  start timestamptz;
  appt  appointments;
  ids   uuid[] := '{}';
begin
  if coalesce(array_length(p_starts_at, 1), 0) = 0 then
    raise exception 'Nenhuma data para agendar';
  end if;
  foreach start in array p_starts_at loop
    appt := create_appointment(p_client_id, start, p_service_ids, p_notes, 'pendente', grp,
                               case when grp is not null then p_recurrence_rule end,
                               p_client_package_id, p_location_type, p_service_address, p_travel_fee);
    ids := ids || appt.id;
  end loop;
  return query select * from appointments where id = any(ids) order by starts_at;
end;
$$;

revoke execute on function create_appointment(uuid, timestamptz, uuid[], text, appointment_status, uuid, text, uuid, text, text, numeric) from anon, public;
revoke execute on function create_appointment_series(uuid, timestamptz[], uuid[], text, text, uuid, text, text, numeric) from anon, public;
revoke execute on function complete_appointment(uuid, payment_method) from anon, public;
grant execute on function create_appointment(uuid, timestamptz, uuid[], text, appointment_status, uuid, text, uuid, text, text, numeric) to authenticated;
grant execute on function create_appointment_series(uuid, timestamptz[], uuid[], text, text, uuid, text, text, numeric) to authenticated;
grant execute on function complete_appointment(uuid, payment_method) to authenticated;

-- Atualiza a lista de funções da API na hora
notify pgrst, 'reload schema';
