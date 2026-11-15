-- =====================================================================
-- Agenda Beleza — Agendamentos recorrentes
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- Cada sessão de uma série continua sendo um agendamento normal (com seu
-- próprio status e sua própria receita ao ser concluída). As sessões da
-- mesma série compartilham o recurrence_group_id.
-- =====================================================================

alter table appointments
  add column if not exists recurrence_group_id     uuid,
  -- regra no formato iCalendar, ex: FREQ=WEEKLY;INTERVAL=2;COUNT=6
  add column if not exists recurrence_rule         text,
  -- true quando esta sessão foi alterada fora do padrão da série
  add column if not exists is_recurrence_exception boolean not null default false;

create index if not exists appointments_recurrence_idx
  on appointments (owner_id, recurrence_group_id) where recurrence_group_id is not null;

-- ---------------------------------------------------------------------
-- create_appointment: agora aceita a série (opcional)
-- ---------------------------------------------------------------------
drop function if exists create_appointment(uuid, timestamptz, uuid[], text, appointment_status);
drop function if exists create_appointment(uuid, timestamptz, uuid[], text, appointment_status, uuid, text);

create or replace function create_appointment(
  p_client_id           uuid,
  p_starts_at           timestamptz,
  p_service_ids         uuid[],
  p_notes               text default null,
  p_status              appointment_status default 'pendente',
  p_recurrence_group_id uuid default null,
  p_recurrence_rule     text default null
)
returns appointments
language plpgsql security invoker as $$
declare
  total_min   int;
  total_price numeric(10,2);
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

  insert into appointments (client_id, starts_at, ends_at, status, total_price, notes,
                            recurrence_group_id, recurrence_rule)
  values (p_client_id, p_starts_at, p_starts_at + make_interval(mins => total_min), p_status, total_price, p_notes,
          p_recurrence_group_id, p_recurrence_rule)
  returning * into appt;

  insert into appointment_services (appointment_id, service_id, name, price, duration_min, position)
  select appt.id, s.id, s.name, s.price, s.duration_min, array_position(p_service_ids, s.id)
    from services s
   where s.id = any(p_service_ids) and s.owner_id = auth.uid();

  return appt;
end;
$$;

-- ---------------------------------------------------------------------
-- create_appointment_series: cria todas as sessões de uma vez.
-- Se qualquer data der conflito, nada é criado (tudo ou nada).
-- Uso: supabase.rpc('create_appointment_series', { p_client_id, p_starts_at: [...], p_service_ids, p_notes, p_recurrence_rule })
-- ---------------------------------------------------------------------
drop function if exists create_appointment_series(uuid, timestamptz[], uuid[], text, text);

create or replace function create_appointment_series(
  p_client_id       uuid,
  p_starts_at       timestamptz[],
  p_service_ids     uuid[],
  p_notes           text default null,
  p_recurrence_rule text default null
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
                               case when grp is not null then p_recurrence_rule end);
    ids := ids || appt.id;
  end loop;
  return query select * from appointments where id = any(ids) order by starts_at;
end;
$$;

-- ---------------------------------------------------------------------
-- update_appointments: altera horário e/ou serviços de uma ou várias
-- sessões (edição em série). Tudo ou nada.
--   p_shift            quanto mover cada sessão (ex: '1 hour', '2 days')
--   p_service_ids      novos serviços (null = manter os atuais)
--   p_mark_exception   true quando só esta sessão foge do padrão da série
--   p_new_group        true para separar as sessões numa nova série
--                      ("este e os próximos" passam a ser uma série própria)
-- Sessões concluídas ou canceladas nunca são alteradas.
-- ---------------------------------------------------------------------
drop function if exists update_appointments(uuid[], interval, uuid[], boolean, boolean);

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
  a           appointments;
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
      total_price = coalesce(v_price, a.total_price),
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

grant execute on function create_appointment(uuid, timestamptz, uuid[], text, appointment_status, uuid, text) to authenticated;
grant execute on function create_appointment_series(uuid, timestamptz[], uuid[], text, text) to authenticated;
grant execute on function update_appointments(uuid[], interval, uuid[], boolean, boolean) to authenticated;
revoke execute on function create_appointment(uuid, timestamptz, uuid[], text, appointment_status, uuid, text) from anon, public;
revoke execute on function create_appointment_series(uuid, timestamptz[], uuid[], text, text) from anon, public;
revoke execute on function update_appointments(uuid[], interval, uuid[], boolean, boolean) from anon, public;
