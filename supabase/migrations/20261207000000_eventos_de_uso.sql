-- =====================================================================
-- Agenda Beleza — Eventos de uso (medição de usabilidade, docs/ux/metricas.md, opção A)
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
-- RODAR ANTES do deploy do app que envia os eventos (se rodar depois, os eventos
-- só se perdem: o app nunca mostra erro por causa da medição).
--
-- Regras:
-- - Nada de dados das clientes: o app só manda nomes de evento e números/códigos curtos.
--   O banco reforça: nome com formato fixo, propriedades pequenas, só valores simples.
-- - O app logado só INSERE os próprios eventos; ninguém lê pelo app (análise via SQL Editor).
-- - O link público (sem login) só grava pela função log_public_event, com lista fixa de
--   eventos, limite por visita e por estúdio, e sem guardar IP.
-- - Excluir a conta apaga os eventos dela (cascata a partir do login).
-- - Retenção: 13 meses (purge_old_app_events; rode de vez em quando ou agende no pg_cron).
-- =====================================================================

create table if not exists app_events (
  id          bigint generated always as identity primary key,
  account_id  uuid default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (name ~ '^[a-z][a-z_]{2,47}$'),
  props       jsonb not null default '{}'::jsonb
              check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 1500),
  platform    text check (platform in ('ios', 'android', 'web')),
  app_version text check (char_length(app_version) <= 20),
  session_id  text check (char_length(session_id) <= 40),
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists app_events_name_created on app_events (name, created_at);
create index if not exists app_events_account_created on app_events (account_id, created_at);
create index if not exists app_events_session on app_events (session_id, created_at);

alter table app_events enable row level security;

-- Só inserir, e só em nome da própria conta (sem select/update/delete pelo app)
drop policy if exists "inserir os próprios eventos" on app_events;
create policy "inserir os próprios eventos" on app_events
  for insert to authenticated
  with check (account_id = auth.uid() and not is_public);

revoke all on app_events from anon, authenticated;
grant insert (account_id, name, props, platform, app_version, session_id) on app_events to authenticated;

-- ---------------------------------------------------------------------
-- Link público: eventos anônimos do funil de agendamento
-- ---------------------------------------------------------------------
create or replace function log_public_event(p_slug text, p_name text, p_props jsonb, p_session text, p_platform text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_props jsonb := '{}'::jsonb;
  k text;
  v jsonb;
begin
  -- Lista fixa: qualquer outro nome é ignorado em silêncio
  if p_name not in ('public_link_viewed', 'public_services_selected', 'public_datetime_selected',
                    'public_details_viewed', 'public_booking_submitted', 'public_booking_failed') then
    return;
  end if;
  if p_session is null or char_length(p_session) > 40 or char_length(p_session) < 8 then
    return;
  end if;

  select id into v_owner from profiles where slug = lower(p_slug);
  if v_owner is null then
    return;
  end if;

  -- Limites: 60 eventos por visita por hora e 2000 por estúdio por hora
  if (select count(*) from app_events where session_id = p_session and created_at > now() - interval '1 hour') >= 60
     or (select count(*) from app_events where account_id = v_owner and is_public and created_at > now() - interval '1 hour') >= 2000 then
    return;
  end if;

  -- Só as propriedades conhecidas, só números ou códigos curtos
  if jsonb_typeof(p_props) = 'object' then
    for k, v in select * from jsonb_each(p_props) loop
      if k in ('n_services', 'days_ahead', 'step', 'error')
         and (jsonb_typeof(v) = 'number' or (jsonb_typeof(v) = 'string' and char_length(v #>> '{}') <= 40)) then
        v_props := v_props || jsonb_build_object(k, v);
      end if;
    end loop;
  end if;

  insert into app_events (account_id, name, props, platform, session_id, is_public)
  values (v_owner, p_name, v_props,
          case when p_platform in ('ios', 'android', 'web') then p_platform else null end,
          p_session, true);
end;
$$;

revoke execute on function log_public_event(text, text, jsonb, text, text) from public;
grant execute on function log_public_event(text, text, jsonb, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Retenção de 13 meses (só o servidor/SQL Editor executa)
-- ---------------------------------------------------------------------
create or replace function purge_old_app_events()
returns integer
language sql security definer set search_path = public as $$
  with d as (delete from app_events where created_at < now() - interval '13 months' returning 1)
  select count(*)::integer from d;
$$;
revoke execute on function purge_old_app_events() from public, anon, authenticated;

notify pgrst, 'reload schema';
