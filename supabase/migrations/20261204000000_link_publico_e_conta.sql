-- =====================================================================
-- Agenda Beleza — Link público mais protegido e exclusão de conta de uma vez
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- 1. get_public_busy_slots: só responde para estúdios com o link liberado no
--    plano, e só para o período que dá para agendar (antes devolvia os horários
--    ocupados de qualquer estúdio, em qualquer período, até 120 dias por vez).
-- 2. Limites do link: com "aprovar automaticamente", os pedidos já entram
--    confirmados e o limite de 40 pedidos aguardando não valia. Agora os
--    confirmados automaticamente pelo link também contam. E o banco recusa
--    pedidos pelo link de estúdio sem o link no plano.
-- 3. delete_account: apaga os dados do estúdio e o login numa única operação.
--    Antes eram duas etapas: se a segunda falhasse, a conta ficava vazia mas
--    continuava existindo.
-- =====================================================================

-- 1. Horários ocupados --------------------------------------------------
create or replace function get_public_busy_slots(p_slug text, p_start_date date, p_end_date date)
returns table (start_time timestamptz, end_time timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  prof    profiles;
  v_today date;
  v_from  date;
  v_to    date;
  t_from  timestamptz;
  t_to    timestamptz;
begin
  select * into prof from profiles where slug = lower(p_slug);
  -- Estúdio inexistente ou sem o link no plano: nada a mostrar
  if prof.id is null or plan_rank(effective_plan(prof.id)) < 2 then
    return;
  end if;
  if p_end_date < p_start_date then
    raise exception 'Período inválido';
  end if;
  -- Só o período que a cliente pode agendar (com folga de fuso): de anteontem a 95 dias
  v_today := (now() at time zone prof.timezone)::date;
  v_from  := greatest(p_start_date, v_today - 2);
  v_to    := least(p_end_date, v_today + 95);
  if v_to < v_from then
    return;
  end if;
  t_from := v_from::timestamp at time zone prof.timezone;
  t_to   := (v_to + 1)::timestamp at time zone prof.timezone;

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
grant execute on function get_public_busy_slots(text, date, date) to anon, authenticated;

-- 2. Limites dos pedidos pelo link ---------------------------------------
create or replace function appointments_online_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_headers json;
  v_ip      text;
  v_hash    text;
  v_auto    boolean;
begin
  if new.source is distinct from 'online' then
    return new;
  end if;
  -- A própria profissional (logada) não tem limite
  if auth.uid() is not null and auth.uid() = new.owner_id then
    return new;
  end if;

  -- Link de agendamento só nos planos que o incluem
  if plan_rank(effective_plan(new.owner_id)) < 2 then
    raise exception 'O estúdio não está recebendo agendamentos pelo link agora. Fale com o estúdio pelo WhatsApp.';
  end if;

  if (select count(*) from appointments
       where owner_id = new.owner_id and source = 'online'
         and created_at > now() - interval '1 hour') >= 15 then
    raise exception 'O estúdio recebeu muitos pedidos agora. Tente de novo mais tarde ou fale com o estúdio pelo WhatsApp.';
  end if;

  if (select count(*) from appointments
       where owner_id = new.owner_id and source = 'online'
         and status = 'pendente' and starts_at > now()) >= 40 then
    raise exception 'O estúdio tem muitos pedidos aguardando confirmação. Fale com o estúdio pelo WhatsApp.';
  end if;

  -- Aprovação automática: os pedidos entram confirmados. Conta os confirmados pelo link
  -- na última semana, para ninguém encher a agenda de pedidos falsos
  select booking_auto_approve into v_auto from profiles where id = new.owner_id;
  if coalesce(v_auto, false) and (select count(*) from appointments
       where owner_id = new.owner_id and source = 'online'
         and status in ('pendente', 'confirmado') and starts_at > now()
         and created_at > now() - interval '7 days') >= 40 then
    raise exception 'O estúdio recebeu muitos agendamentos pelo link nos últimos dias. Fale com o estúdio pelo WhatsApp.';
  end if;

  if (select count(*) from appointments
       where owner_id = new.owner_id and client_id = new.client_id and source = 'online'
         and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Muitos pedidos com este WhatsApp hoje. Fale com o estúdio pelo WhatsApp.';
  end if;

  -- IP de quem fez o pedido (cabeçalhos da requisição à API)
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;
  v_ip := nullif(trim(coalesce(v_headers ->> 'cf-connecting-ip',
                               split_part(v_headers ->> 'x-forwarded-for', ',', 1))), '');
  if v_ip is not null then
    v_hash := md5('agenda-beleza:' || v_ip);
    delete from online_booking_log where created_at < now() - interval '1 day';
    if (select count(*) from online_booking_log
         where ip_hash = v_hash and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'Muitos agendamentos feitos deste aparelho em pouco tempo. Tente de novo mais tarde.';
    end if;
    insert into online_booking_log (ip_hash) values (v_hash);
  end if;

  return new;
end;
$$;
revoke execute on function appointments_online_limits() from public, anon, authenticated;

-- 3. Excluir a conta (dados + login, tudo ou nada) -----------------------
create or replace function delete_account(p_owner uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform purge_account_data(p_owner);
  -- O login; o perfil sai em cascata
  delete from auth.users where id = p_owner;
end;
$$;
revoke execute on function delete_account(uuid) from public, anon, authenticated;
grant execute on function delete_account(uuid) to service_role;

notify pgrst, 'reload schema';
