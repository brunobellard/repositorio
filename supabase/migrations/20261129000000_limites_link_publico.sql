-- =====================================================================
-- Agenda Beleza — Limites contra excesso de pedidos pelo link público
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- O link de agendamento é público: sem limite, alguém podia encher a
-- agenda de pedidos falsos trocando o número de WhatsApp a cada vez.
-- Agora todo pedido feito pelo link (source = 'online') passa por:
--   1. Estúdio: no máximo 15 pedidos pelo link por hora
--   2. Estúdio: no máximo 40 pedidos aguardando confirmação (futuros)
--   3. Mesmo WhatsApp: no máximo 5 pedidos em 24 horas (mesmo cancelados)
--   4. Mesmo aparelho/rede (IP): no máximo 5 pedidos por hora, em
--      qualquer estúdio. O IP é guardado só como código (hash), por 1 dia.
-- Agendamentos feitos pela própria profissional no app não têm limite.
-- =====================================================================

-- Registro curto dos pedidos por IP (só o hash, apagado depois de 1 dia)
create table if not exists online_booking_log (
  id         bigserial primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists online_booking_log_ip_idx on online_booking_log (ip_hash, created_at);
alter table online_booking_log enable row level security;  -- sem políticas: ninguém lê pela API
revoke all on online_booking_log from anon, authenticated;

create index if not exists appointments_online_recent_idx
  on appointments (owner_id, created_at) where source = 'online';

create or replace function appointments_online_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_headers json;
  v_ip      text;
  v_hash    text;
begin
  if new.source is distinct from 'online' then
    return new;
  end if;
  -- A própria profissional (logada) não tem limite
  if auth.uid() is not null and auth.uid() = new.owner_id then
    return new;
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

drop trigger if exists appointments_online_limits on appointments;
create trigger appointments_online_limits
  before insert on appointments
  for each row execute function appointments_online_limits();
