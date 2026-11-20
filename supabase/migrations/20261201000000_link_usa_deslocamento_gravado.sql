-- =====================================================================
-- Agenda Beleza — O link público usa o deslocamento gravado em cada atendimento
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- Cada atendimento guarda "ocupado até" (busy_until = fim + deslocamento da
-- época em que foi marcado), e é ele que o banco usa para impedir encavalar.
-- O link público ainda calculava com o deslocamento ATUAL dos Ajustes: depois
-- de mudar o deslocamento, o link mostrava horários livres que o banco
-- recusava ("Esse horário acabou de ser ocupado"), ou escondia horários livres.
-- Agora as duas funções do link usam o busy_until.
-- =====================================================================

-- Horários ocupados (atendimentos com o deslocamento gravado, folgas e bloqueios)
create or replace function get_public_busy_slots(p_slug text, p_start_date date, p_end_date date)
returns table (start_time timestamptz, end_time timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  prof profiles;
  t_from timestamptz;
  t_to   timestamptz;
begin
  select * into prof from profiles where slug = lower(p_slug);
  if prof.id is null then
    return;
  end if;
  if p_end_date < p_start_date or p_end_date - p_start_date > 120 then
    raise exception 'Período inválido (máximo de 120 dias)';
  end if;
  t_from := p_start_date::timestamp at time zone prof.timezone;
  t_to   := (p_end_date + 1)::timestamp at time zone prof.timezone;

  return query
    select a.starts_at, a.busy_until
      from appointments a
     where a.owner_id = prof.id and a.status <> 'cancelado'
       and a.starts_at < t_to and a.busy_until > t_from
    union all
    select b.starts_at, b.ends_at          -- folgas, feriados e bloqueios
      from schedule_blocks b
     where b.owner_id = prof.id
       and b.starts_at < t_to and b.ends_at > t_from;
end;
$$;

-- Reserva pela cliente: confere o horário livre com o busy_until dos atendimentos já marcados
create or replace function create_public_booking(
  p_slug          text,
  p_service_ids   uuid[],
  p_starts_at     timestamptz,
  p_name          text,
  p_whatsapp      text,
  p_notes         text default null,
  p_location_type text default 'fixed',
  p_area_id       uuid default null,
  p_address       text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  prof      profiles;
  digits    text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_min     int;
  v_price   numeric(10,2);
  v_count   int;
  v_end     timestamptz;
  v_busy_end timestamptz;     -- fim + deslocamento (domicílio)
  v_home    boolean := coalesce(p_location_type, 'fixed') = 'home_service';
  v_area    service_areas;
  v_address text;
  local_ts  timestamp;
  local_end timestamp;
  bh        business_hours;
  cli_id    uuid;
  appt      appointments;
begin
  select * into prof from profiles where slug = lower(p_slug);
  if prof.id is null then
    raise exception 'Estúdio não encontrado';
  end if;

  -- Uma reserva por vez neste estúdio: evita duas clientes no mesmo horário
  perform pg_advisory_xact_lock(hashtextextended(prof.id::text, 0));

  if length(trim(coalesce(p_name, ''))) < 3 or length(trim(p_name)) > 120 then
    raise exception 'Informe seu nome completo';
  end if;
  if length(digits) not between 10 and 13 then
    raise exception 'Informe um WhatsApp válido com DDD';
  end if;
  digits := right(digits, 11);

  if coalesce(array_length(p_service_ids, 1), 0) = 0 or array_length(p_service_ids, 1) > 6 then
    raise exception 'Escolha de 1 a 6 serviços';
  end if;
  select count(*), sum(duration_min), sum(price) into v_count, v_min, v_price
    from services where id = any(p_service_ids) and owner_id = prof.id and active;
  if v_count <> array_length(p_service_ids, 1) then
    raise exception 'Serviço indisponível';
  end if;
  v_end := p_starts_at + make_interval(mins => v_min);

  if p_starts_at < now() + interval '30 minutes' or p_starts_at > now() + interval '90 days' then
    raise exception 'Escolha um horário a partir de 30 minutos e em até 90 dias';
  end if;

  local_ts  := p_starts_at at time zone prof.timezone;
  local_end := v_end at time zone prof.timezone;

  -- Local do atendimento conforme o modelo do estúdio
  if prof.service_mode = 'fixed' and v_home then
    raise exception 'Este estúdio não faz atendimento a domicílio';
  end if;
  if prof.service_mode = 'home_service' and not v_home then
    raise exception 'Este estúdio atende somente a domicílio';
  end if;
  if v_home then
    select * into v_area from service_areas
     where id = p_area_id and owner_id = prof.id and is_active;
    if v_area.id is null then
      raise exception 'Escolha um bairro atendido';
    end if;
    if not (extract(dow from local_ts)::int = any(v_area.allowed_days)) then
      raise exception 'O estúdio não atende esse bairro neste dia da semana';
    end if;
    v_address := nullif(trim(left(coalesce(p_address, ''), 300)), '');
    if v_address is null or length(v_address) < 5 then
      raise exception 'Informe o endereço completo do atendimento';
    end if;
  end if;
  v_busy_end := v_end + case when v_home then make_interval(mins => prof.travel_buffer_minutes) else interval '0' end;

  -- Expediente (no fuso do estúdio), sem atravessar a pausa
  select * into bh from business_hours
   where owner_id = prof.id and day_of_week = extract(dow from local_ts);
  if bh.owner_id is null or not bh.is_open
     or local_end::date <> local_ts::date
     or local_ts::time < bh.open_time or local_end::time > bh.close_time
     or (bh.break_start is not null and local_ts::time < bh.break_end and local_end::time > bh.break_start) then
    raise exception 'Horário fora do expediente';
  end if;

  -- Folgas/bloqueios e horário realmente livre (com o deslocamento gravado de cada atendimento)
  if exists (select 1 from schedule_blocks
              where owner_id = prof.id and starts_at < v_end and ends_at > p_starts_at)
     or exists (select 1 from appointments a
                 where a.owner_id = prof.id and a.status <> 'cancelado'
                   and a.starts_at < v_busy_end
                   and a.busy_until > p_starts_at) then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
  end if;

  -- Cliente: reaproveita o cadastro pelo WhatsApp ou cria um novo
  select id into cli_id from clients
   where owner_id = prof.id and right(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), 11) = digits
   order by created_at limit 1;
  if cli_id is null then
    insert into clients (owner_id, name, whatsapp, address, neighborhood)
    values (prof.id, initcap(trim(p_name)), digits,
            case when v_home then v_address end, case when v_home then v_area.neighborhood_name end)
    returning id into cli_id;
  elsif v_home then
    -- Guarda o endereço na ficha se ainda não houver
    update clients set address = coalesce(nullif(address, ''), v_address),
                       neighborhood = coalesce(nullif(neighborhood, ''), v_area.neighborhood_name)
     where id = cli_id;
  end if;

  if (select count(*) from appointments
       where owner_id = prof.id and client_id = cli_id and source = 'online'
         and status in ('pendente', 'confirmado') and starts_at > now()) >= 3 then
    raise exception 'Você já tem horários marcados. Fale com o estúdio pelo WhatsApp.';
  end if;

  insert into appointments (owner_id, client_id, starts_at, ends_at, status, total_price, notes, source,
                            location_type, service_address, travel_fee)
  values (prof.id, cli_id, p_starts_at, v_end,
          case when prof.booking_auto_approve then 'confirmado' else 'pendente' end::appointment_status,
          v_price + case when v_home then v_area.travel_fee else 0 end,
          nullif(trim(left(coalesce(p_notes, ''), 500)), ''), 'online',
          case when v_home then 'home_service' else 'fixed' end,
          case when v_home then v_address || ' – ' || v_area.neighborhood_name end,
          case when v_home then v_area.travel_fee else 0 end)
  returning * into appt;

  insert into appointment_services (appointment_id, service_id, owner_id, name, price, duration_min, position)
  select appt.id, s.id, prof.id, s.name, s.price, s.duration_min, array_position(p_service_ids, s.id)
    from services s where s.id = any(p_service_ids) and s.owner_id = prof.id;

  return jsonb_build_object(
    'id', appt.id, 'starts_at', appt.starts_at, 'ends_at', appt.ends_at,
    'status', appt.status, 'total_price', appt.total_price,
    'location_type', appt.location_type, 'service_address', appt.service_address,
    'travel_fee', appt.travel_fee
  );
exception
  when exclusion_violation then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
end;
$$;

grant execute on function get_public_busy_slots(text, date, date) to anon, authenticated;
grant execute on function create_public_booking(text, uuid[], timestamptz, text, text, text, text, uuid, text)
  to anon, authenticated;
