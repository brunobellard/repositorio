-- =====================================================================
-- Agenda Beleza — Link público de agendamento online
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- SEGURANÇA: em vez de abrir as tabelas para visitantes (o que exporia
-- nomes, telefones e anotações das clientes), o acesso público acontece
-- só por 3 funções com regras próprias:
--   public_studio(slug)              -> dados públicos do estúdio, serviços ativos e expediente
--   public_busy(slug, de, até)       -> só intervalos ocupados (sem nome, serviço ou cliente)
--   public_book(slug, ...)           -> cria o agendamento validando tudo no banco
-- As tabelas continuam fechadas para visitantes (RLS inalterado).
-- =====================================================================

alter table profiles
  add column if not exists slug text,
  -- true: agendamento online entra como "confirmado"; false: entra "pendente"
  add column if not exists booking_auto_approve boolean not null default false;

-- Link amigável: letras minúsculas, números e hífen (3 a 40 caracteres), único
do $$ begin
  alter table profiles add constraint profiles_slug_format
    check (slug is null or slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$');
exception when duplicate_object then null; end $$;
create unique index if not exists profiles_slug_key on profiles (slug) where slug is not null;

-- Origem do agendamento ('app' = feito pela profissional, 'online' = pela cliente)
alter table appointments add column if not exists source text not null default 'app';

-- ---------------------------------------------------------------------
-- Dados públicos do estúdio
-- ---------------------------------------------------------------------
create or replace function public_studio(p_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'business_name', p.business_name,
    'logo_url', p.logo_url,
    'phone', p.phone,
    'instagram', p.instagram,
    'address_street', p.address_street,
    'address_number', p.address_number,
    'address_district', p.address_district,
    'address_city', p.address_city,
    'address_state', p.address_state,
    'address_zip', p.address_zip,
    'slot_minutes', p.slot_minutes,
    'timezone', p.timezone,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.name, 'category', s.category,
               'price', s.price, 'duration_min', s.duration_min) order by s.category, s.name)
        from services s where s.owner_id = p.id and s.active
    ), '[]'::jsonb),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day_of_week', h.day_of_week, 'is_open', h.is_open,
               'open_time', to_char(h.open_time, 'HH24:MI'), 'close_time', to_char(h.close_time, 'HH24:MI'),
               'break_start', to_char(h.break_start, 'HH24:MI'), 'break_end', to_char(h.break_end, 'HH24:MI')))
        from business_hours h where h.owner_id = p.id
    ), '[]'::jsonb)
  )
  from profiles p
  where p.slug = lower(p_slug)
$$;

-- ---------------------------------------------------------------------
-- Horários ocupados (agendamentos e bloqueios) — apenas início/fim
-- ---------------------------------------------------------------------
create or replace function public_busy(p_slug text, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz, all_day boolean)
language sql stable security definer set search_path = public as $$
  select a.starts_at, a.ends_at, false
    from appointments a join profiles p on p.id = a.owner_id
   where p.slug = lower(p_slug) and a.status <> 'cancelado'
     and a.starts_at < p_to and a.ends_at > p_from
  union all
  select b.starts_at, b.ends_at, b.all_day
    from schedule_blocks b join profiles p on p.id = b.owner_id
   where p.slug = lower(p_slug)
     and b.starts_at < p_to and b.ends_at > p_from
$$;

-- ---------------------------------------------------------------------
-- Agendar pelo link público (tudo validado aqui, não no navegador)
-- ---------------------------------------------------------------------
drop function if exists public_book(text, uuid[], timestamptz, text, text, text);

create or replace function public_book(
  p_slug        text,
  p_service_ids uuid[],
  p_starts_at   timestamptz,
  p_name        text,
  p_whatsapp    text,
  p_notes       text default null
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

  -- Dados da cliente
  if length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'Informe seu nome completo';
  end if;
  if length(digits) not between 10 and 13 then
    raise exception 'Informe um WhatsApp válido com DDD';
  end if;
  digits := right(digits, 11);

  -- Serviços: precisam existir, estar ativos e ser deste estúdio
  if coalesce(array_length(p_service_ids, 1), 0) = 0 or array_length(p_service_ids, 1) > 6 then
    raise exception 'Escolha de 1 a 6 serviços';
  end if;
  select count(*), sum(duration_min), sum(price) into v_count, v_min, v_price
    from services where id = any(p_service_ids) and owner_id = prof.id and active;
  if v_count <> array_length(p_service_ids, 1) then
    raise exception 'Serviço indisponível';
  end if;
  v_end := p_starts_at + make_interval(mins => v_min);

  -- Data: no futuro e até 90 dias
  if p_starts_at < now() + interval '30 minutes' or p_starts_at > now() + interval '90 days' then
    raise exception 'Escolha um horário a partir de 30 minutos e em até 90 dias';
  end if;

  -- Expediente do dia (no fuso do estúdio), sem atravessar a pausa
  local_ts  := p_starts_at at time zone prof.timezone;
  local_end := v_end at time zone prof.timezone;
  select * into bh from business_hours
   where owner_id = prof.id and day_of_week = extract(dow from local_ts);
  if bh.owner_id is null or not bh.is_open
     or local_end::date <> local_ts::date
     or local_ts::time < bh.open_time or local_end::time > bh.close_time
     or (bh.break_start is not null and local_ts::time < bh.break_end and local_end::time > bh.break_start) then
    raise exception 'Horário fora do expediente';
  end if;

  -- Folgas e bloqueios
  if exists (select 1 from schedule_blocks
              where owner_id = prof.id and starts_at < v_end and ends_at > p_starts_at) then
    raise exception 'Horário indisponível';
  end if;

  -- Cliente: reaproveita o cadastro pelo WhatsApp ou cria um novo
  select id into cli_id from clients
   where owner_id = prof.id and right(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), 11) = digits
   order by created_at limit 1;
  if cli_id is null then
    insert into clients (owner_id, name, whatsapp)
    values (prof.id, initcap(trim(p_name)), digits)
    returning id into cli_id;
  end if;

  -- Proteção contra abuso: no máximo 3 agendamentos online futuros por cliente
  if (select count(*) from appointments
       where owner_id = prof.id and client_id = cli_id and source = 'online'
         and status in ('pendente', 'confirmado') and starts_at > now()) >= 3 then
    raise exception 'Você já tem horários marcados. Fale com o estúdio pelo WhatsApp.';
  end if;

  -- Cria o agendamento (o banco ainda impede sobreposição com outro horário)
  insert into appointments (owner_id, client_id, starts_at, ends_at, status, total_price, notes, source)
  values (prof.id, cli_id, p_starts_at, v_end,
          case when prof.booking_auto_approve then 'confirmado' else 'pendente' end::appointment_status,
          v_price, nullif(trim(left(coalesce(p_notes, ''), 500)), ''), 'online')
  returning * into appt;

  insert into appointment_services (appointment_id, service_id, owner_id, name, price, duration_min, position)
  select appt.id, s.id, prof.id, s.name, s.price, s.duration_min, array_position(p_service_ids, s.id)
    from services s where s.id = any(p_service_ids) and s.owner_id = prof.id;

  return jsonb_build_object(
    'id', appt.id,
    'starts_at', appt.starts_at,
    'ends_at', appt.ends_at,
    'status', appt.status,
    'total_price', appt.total_price
  );
exception
  when exclusion_violation then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
end;
$$;

-- Visitantes (anon) podem chamar apenas estas funções
grant execute on function public_studio(text) to anon, authenticated;
grant execute on function public_busy(text, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public_book(text, uuid[], timestamptz, text, text, text) to anon, authenticated;
