-- =====================================================================
-- Histórico antigo e fila offline
--
-- 1. client_history_summary: o app carrega só os últimos 12 meses de
--    atendimentos. Este resumo (uma linha por cliente, com todo o histórico)
--    permite saber quem sumiu há mais de 12 meses ("Para chamar de volta")
--    e quem tem atendimentos antigos (exclusão vira "apagar dados").
-- 2. delete_package: excluir pacote confere no banco se há sessões ligadas
--    (inclusive antigas) e apaga pacote e receita juntos, ou nada.
-- 3. create_offline_appointment: agendamento feito sem internet entra com os
--    serviços numa única operação (antes podia ficar gravado sem serviços).
-- =====================================================================

-- 1. Resumo do histórico por cliente -----------------------------------
create or replace function public.client_history_summary()
returns table (client_id uuid, appointments int, last_done_at timestamptz, last_service text)
language sql
stable
security invoker
set search_path = public
as $$
  select c.client_id, c.total, l.starts_at, l.services
  from (
    select a.client_id, count(*)::int as total
    from appointments a
    group by a.client_id
  ) c
  left join lateral (
    select a.starts_at,
      (select string_agg(s.name, ' + ' order by s.position, s.name)
         from appointment_services s
        where s.appointment_id = a.id) as services
    from appointments a
    where a.client_id = c.client_id and a.status = 'concluido'
    order by a.starts_at desc
    limit 1
  ) l on true;
$$;

grant execute on function public.client_history_summary() to authenticated;

-- 2. Excluir pacote (tudo ou nada) --------------------------------------
create or replace function public.delete_package(p_package_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_linked int;
begin
  if not exists (select 1 from client_packages where id = p_package_id) then
    raise exception 'Pacote não encontrado.' using errcode = 'P0002';
  end if;

  select count(*) into v_linked
  from appointments
  where client_package_id = p_package_id and status <> 'cancelado';

  if v_linked > 0 then
    raise exception 'package_in_use:%', v_linked using errcode = 'P0001';
  end if;

  delete from transactions where client_package_id = p_package_id;
  delete from client_packages where id = p_package_id;
end;
$$;

grant execute on function public.delete_package(uuid) to authenticated;

-- 3. Agendamento da fila offline (agendamento + serviços juntos) --------
create or replace function public.create_offline_appointment(p_appointment jsonb, p_services jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  r appointments;
  v_id uuid := (p_appointment->>'id')::uuid;
begin
  if jsonb_array_length(coalesce(p_services, '[]'::jsonb)) = 0 then
    raise exception 'Escolha pelo menos um serviço.' using errcode = '23514';
  end if;

  r := jsonb_populate_record(null::appointments, p_appointment);

  -- Já enviado antes (a conexão caiu no meio): não duplica
  if not exists (select 1 from appointments where id = v_id) then
    insert into appointments (
      id, client_id, starts_at, ends_at, status, total_price, notes, source,
      client_package_id, location_type, service_address, travel_fee
    ) values (
      v_id, r.client_id, r.starts_at, r.ends_at, coalesce(r.status, 'pendente'), r.total_price, r.notes,
      coalesce(r.source, 'manual'), r.client_package_id,
      coalesce(r.location_type, 'fixed'), r.service_address, coalesce(r.travel_fee, 0)
    );
  end if;

  -- Serviços: grava se ainda não houver (cobre também agendamentos que ficaram sem eles)
  if not exists (select 1 from appointment_services where appointment_id = v_id) then
    insert into appointment_services (appointment_id, service_id, name, price, duration_min, position)
    select v_id, s.service_id, s.name, s.price, s.duration_min, coalesce(s.position, 0)
    from jsonb_populate_recordset(null::appointment_services, p_services) s;
  end if;
end;
$$;

grant execute on function public.create_offline_appointment(jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
