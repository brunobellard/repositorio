-- =====================================================================
-- Agenda Beleza — Auditoria de segurança (RLS) e notificações push
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- Resultado da auditoria (antes desta migração):
--   [ok]    RLS ativo em todas as tabelas, cada uma com política owner_id = auth.uid()
--   [ok]    Nenhuma política pública: visitantes não leem nenhuma linha
--   [fix 1] business_hours e client_packages ainda tinham GRANT para "anon"
--           (RLS devolvia vazio, mas a permissão não deveria existir)
--   [fix 2] Políticas valiam para qualquer papel; agora só "authenticated"
--   [fix 3] Funções do schema public podiam ser chamadas por visitantes;
--           agora só as 3 funções públicas de agendamento
--   [fix 4] Era possível apontar um registro para dados de OUTRA conta
--           (ex: agendamento com client_id de outro estúdio). Agora chaves
--           estrangeiras compostas (id, owner_id) impedem isso no banco.
--   [fix 5] Funções públicas renomeadas e reforçadas (trava por estúdio
--           contra agendamentos simultâneos no mesmo horário)
--
-- Observações sobre os nomes pedidos:
--   * "profile_id" = coluna owner_id (padrão de todo o banco)
--   * "time_offs"  = tabela schedule_blocks (folgas/feriados com all_day)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Visitantes (anon) sem acesso a NENHUMA tabela, nem às futuras
-- ---------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------
-- 2. RLS ativo em todas as tabelas + políticas só para usuários logados
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- Tabelas com coluna owner_id (dono = usuário logado)
  foreach t in array array[
    'services', 'clients', 'appointments', 'appointment_services', 'schedule_blocks',
    'transactions', 'message_templates', 'message_log', 'business_hours', 'client_packages'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "dados próprios" on %I', t);
    execute format(
      'create policy "dados próprios" on %I as permissive for all to authenticated
         using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;

alter table profiles enable row level security;
drop policy if exists "perfil próprio" on profiles;
create policy "perfil próprio" on profiles as permissive for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- 3. Funções: nada executável por visitantes, exceto as públicas
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from anon, public;
alter default privileges in schema public revoke execute on functions from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Integridade entre contas: referências só para dados do mesmo dono
-- ---------------------------------------------------------------------
do $$
begin
  -- Chaves (id, owner_id) para servirem de referência
  begin alter table clients         add constraint clients_id_owner_key         unique (id, owner_id); exception when duplicate_table or duplicate_object then null; end;
  begin alter table services        add constraint services_id_owner_key        unique (id, owner_id); exception when duplicate_table or duplicate_object then null; end;
  begin alter table appointments    add constraint appointments_id_owner_key    unique (id, owner_id); exception when duplicate_table or duplicate_object then null; end;
  begin alter table client_packages add constraint client_packages_id_owner_key unique (id, owner_id); exception when duplicate_table or duplicate_object then null; end;

  -- Referências compostas (as chaves simples antigas continuam fazendo cascade/set null)
  begin alter table appointments add constraint appointments_client_same_owner
    foreign key (client_id, owner_id) references clients (id, owner_id); exception when duplicate_object then null; end;
  begin alter table appointments add constraint appointments_package_same_owner
    foreign key (client_package_id, owner_id) references client_packages (id, owner_id); exception when duplicate_object then null; end;
  begin alter table appointment_services add constraint appt_services_appt_same_owner
    foreign key (appointment_id, owner_id) references appointments (id, owner_id); exception when duplicate_object then null; end;
  begin alter table appointment_services add constraint appt_services_service_same_owner
    foreign key (service_id, owner_id) references services (id, owner_id); exception when duplicate_object then null; end;
  begin alter table transactions add constraint transactions_appt_same_owner
    foreign key (appointment_id, owner_id) references appointments (id, owner_id); exception when duplicate_object then null; end;
  begin alter table transactions add constraint transactions_package_same_owner
    foreign key (client_package_id, owner_id) references client_packages (id, owner_id); exception when duplicate_object then null; end;
  begin alter table client_packages add constraint packages_client_same_owner
    foreign key (client_id, owner_id) references clients (id, owner_id); exception when duplicate_object then null; end;
  begin alter table client_packages add constraint packages_service_same_owner
    foreign key (service_id, owner_id) references services (id, owner_id); exception when duplicate_object then null; end;
  begin alter table message_log add constraint message_log_appt_same_owner
    foreign key (appointment_id, owner_id) references appointments (id, owner_id); exception when duplicate_object then null; end;
  begin alter table message_log add constraint message_log_client_same_owner
    foreign key (client_id, owner_id) references clients (id, owner_id); exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------------
-- 5. Push e origem do agendamento
-- ---------------------------------------------------------------------
alter table profiles
  add column if not exists expo_push_token text,
  add column if not exists push_notifications_enabled boolean not null default true;

-- 'manual' = feito pela profissional no app; 'online' = pela cliente no link
alter table appointments alter column source set default 'manual';
update appointments set source = 'manual' where source = 'app';
do $$ begin
  alter table appointments add constraint appointments_source_check check (source in ('manual', 'online'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 6. Funções públicas da rota /agendar/[slug]
--    Identificam o estúdio pelo slug do link (não expõem o id da conta).
-- ---------------------------------------------------------------------

-- Só pares (início, fim) dos horários ocupados: nada de nome, telefone ou serviço
drop function if exists get_public_busy_slots(text, date, date);
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
    select a.starts_at, a.ends_at
      from appointments a
     where a.owner_id = prof.id and a.status <> 'cancelado'
       and a.starts_at < t_to and a.ends_at > t_from
    union all
    select b.starts_at, b.ends_at          -- folgas, feriados e bloqueios
      from schedule_blocks b
     where b.owner_id = prof.id
       and b.starts_at < t_to and b.ends_at > t_from;
end;
$$;

drop function if exists create_public_booking(text, uuid[], timestamptz, text, text, text);
create or replace function create_public_booking(
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

  -- Expediente (no fuso do estúdio), sem atravessar a pausa
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

  -- Folgas/bloqueios e horário realmente livre
  if exists (select 1 from schedule_blocks
              where owner_id = prof.id and starts_at < v_end and ends_at > p_starts_at)
     or exists (select 1 from appointments
                 where owner_id = prof.id and status <> 'cancelado'
                   and starts_at < v_end and ends_at > p_starts_at) then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
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

  if (select count(*) from appointments
       where owner_id = prof.id and client_id = cli_id and source = 'online'
         and status in ('pendente', 'confirmado') and starts_at > now()) >= 3 then
    raise exception 'Você já tem horários marcados. Fale com o estúdio pelo WhatsApp.';
  end if;

  insert into appointments (owner_id, client_id, starts_at, ends_at, status, total_price, notes, source)
  values (prof.id, cli_id, p_starts_at, v_end,
          case when prof.booking_auto_approve then 'confirmado' else 'pendente' end::appointment_status,
          v_price, nullif(trim(left(coalesce(p_notes, ''), 500)), ''), 'online')
  returning * into appt;

  insert into appointment_services (appointment_id, service_id, owner_id, name, price, duration_min, position)
  select appt.id, s.id, prof.id, s.name, s.price, s.duration_min, array_position(p_service_ids, s.id)
    from services s where s.id = any(p_service_ids) and s.owner_id = prof.id;

  return jsonb_build_object(
    'id', appt.id, 'starts_at', appt.starts_at, 'ends_at', appt.ends_at,
    'status', appt.status, 'total_price', appt.total_price
  );
exception
  when exclusion_violation then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
end;
$$;

-- As funções antigas foram substituídas pelas novas acima
drop function if exists public_busy(text, timestamptz, timestamptz);
drop function if exists public_book(text, uuid[], timestamptz, text, text, text);

-- Únicas funções que visitantes podem chamar
grant execute on function public_studio(text) to anon, authenticated;
grant execute on function get_public_busy_slots(text, date, date) to anon, authenticated;
grant execute on function create_public_booking(text, uuid[], timestamptz, text, text, text) to anon, authenticated;
