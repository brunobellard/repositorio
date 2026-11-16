-- =====================================================================
-- Agenda Beleza — Atendimento a domicílio (Espaço fixo, A domicílio ou Híbrido)
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Modelo de atendimento do estúdio
-- ---------------------------------------------------------------------
alter table profiles
  add column if not exists service_mode text not null default 'fixed',
  add column if not exists travel_buffer_minutes int not null default 30;

do $$ begin
  alter table profiles add constraint profiles_service_mode_check
    check (service_mode in ('fixed', 'home_service', 'hybrid'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table profiles add constraint profiles_travel_buffer_check
    check (travel_buffer_minutes between 0 and 180);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Bairros / regiões atendidas
--    (owner_id segue o padrão das outras tabelas: é o profile_id da profissional)
-- ---------------------------------------------------------------------
create table if not exists service_areas (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid() references profiles (id) on delete cascade,
  neighborhood_name text not null check (length(trim(neighborhood_name)) between 2 and 80),
  travel_fee        numeric(10,2) not null default 0 check (travel_fee >= 0),
  allowed_days      int[] not null default '{0,1,2,3,4,5,6}',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint service_areas_days_check check (allowed_days <@ array[0,1,2,3,4,5,6])
);
create index if not exists service_areas_owner_idx on service_areas (owner_id);

drop trigger if exists service_areas_updated_at on service_areas;
create trigger service_areas_updated_at before update on service_areas
  for each row execute function set_updated_at();

alter table service_areas enable row level security;
drop policy if exists "service_areas: dono" on service_areas;
create policy "service_areas: dono" on service_areas
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
grant select, insert, update, delete on service_areas to authenticated;
revoke all on service_areas from anon;

-- ---------------------------------------------------------------------
-- 3. Endereço da cliente e local do atendimento
-- ---------------------------------------------------------------------
alter table clients
  add column if not exists address      text,
  add column if not exists neighborhood text;

alter table appointments
  add column if not exists location_type   text not null default 'fixed',
  add column if not exists service_address text,
  add column if not exists travel_fee      numeric(10,2) not null default 0;

do $$ begin
  alter table appointments add constraint appointments_location_type_check
    check (location_type in ('fixed', 'home_service'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table appointments add constraint appointments_travel_fee_check check (travel_fee >= 0);
exception when duplicate_object then null; end $$;

-- O total do atendimento = serviços + taxa de deslocamento.
--   * mudar só a taxa ajusta o total;
--   * recalcular o total pelos serviços (edição de serviços) soma a taxa de volta.
create or replace function appointments_keep_travel_fee()
returns trigger language plpgsql as $$
begin
  if new.travel_fee is distinct from old.travel_fee and new.total_price = old.total_price then
    new.total_price := new.total_price - old.travel_fee + new.travel_fee;
  elsif new.total_price is distinct from old.total_price and new.travel_fee = old.travel_fee
        and new.travel_fee > 0 then
    new.total_price := new.total_price + new.travel_fee;
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_travel_fee on appointments;
create trigger appointments_travel_fee
  before update of total_price, travel_fee on appointments
  for each row execute function appointments_keep_travel_fee();

-- Exclusão de conta: apaga também as regiões
create or replace function purge_account_data(p_owner uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from message_log          where owner_id = p_owner;
  delete from transactions         where owner_id = p_owner;
  delete from appointment_services where owner_id = p_owner;
  delete from appointments         where owner_id = p_owner;
  delete from client_packages      where owner_id = p_owner;
  delete from schedule_blocks      where owner_id = p_owner;
  delete from clients              where owner_id = p_owner;
  delete from services             where owner_id = p_owner;
  delete from business_hours       where owner_id = p_owner;
  delete from message_templates    where owner_id = p_owner;
  delete from service_areas        where owner_id = p_owner;
end;
$$;
revoke execute on function purge_account_data(uuid) from public, anon, authenticated;
grant execute on function purge_account_data(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 4. Página pública: modelo de atendimento e bairros atendidos
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
    'booking_enabled', plan_rank(effective_plan(p.id)) >= 2,
    'service_mode', p.service_mode,
    'travel_buffer_minutes', p.travel_buffer_minutes,
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'name', a.neighborhood_name,
               'travel_fee', a.travel_fee, 'allowed_days', a.allowed_days) order by a.neighborhood_name)
        from service_areas a where a.owner_id = p.id and a.is_active
    ), '[]'::jsonb),
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

-- Horários ocupados: atendimentos em domicílio ocupam também o tempo de deslocamento depois
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
    select a.starts_at,
           a.ends_at + case when a.location_type = 'home_service'
                            then make_interval(mins => prof.travel_buffer_minutes)
                            else interval '0' end
      from appointments a
     where a.owner_id = prof.id and a.status <> 'cancelado'
       and a.starts_at < t_to and a.ends_at > t_from - interval '3 hours'
    union all
    select b.starts_at, b.ends_at          -- folgas, feriados e bloqueios
      from schedule_blocks b
     where b.owner_id = prof.id
       and b.starts_at < t_to and b.ends_at > t_from;
end;
$$;

-- Reserva pela cliente: agora com local (estúdio ou domicílio), bairro e endereço
drop function if exists create_public_booking(text, uuid[], timestamptz, text, text, text);
drop function if exists create_public_booking(text, uuid[], timestamptz, text, text, text, text, uuid, text);
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

  -- Folgas/bloqueios e horário realmente livre (com o deslocamento dos atendimentos em domicílio)
  if exists (select 1 from schedule_blocks
              where owner_id = prof.id and starts_at < v_end and ends_at > p_starts_at)
     or exists (select 1 from appointments a
                 where a.owner_id = prof.id and a.status <> 'cancelado'
                   and a.starts_at < v_busy_end
                   and a.ends_at + case when a.location_type = 'home_service'
                                        then make_interval(mins => prof.travel_buffer_minutes)
                                        else interval '0' end > p_starts_at) then
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

-- Funções que visitantes podem chamar
revoke execute on function appointments_keep_travel_fee() from public, anon, authenticated;
grant execute on function public_studio(text) to anon, authenticated;
grant execute on function get_public_busy_slots(text, date, date) to anon, authenticated;
grant execute on function create_public_booking(text, uuid[], timestamptz, text, text, text, text, uuid, text)
  to anon, authenticated;
