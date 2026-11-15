-- =====================================================================
-- Agenda Beleza — Planos de assinatura (Free, Básico, Intermediário, Empresarial)
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- Segurança: o app mostra o paywall, mas o BANCO é quem garante as regras:
--   * a profissional não consegue mudar o próprio plano pelo app (só o sistema de pagamento)
--   * limites do Free e recursos que gravam dados são conferidos aqui
--     (recorrência, link público, pacotes e quantidades)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas do plano (contas atuais e novas ganham 14 dias do Intermediário)
-- ---------------------------------------------------------------------
alter table profiles
  add column if not exists plan_tier text not null default 'pro',
  add column if not exists subscription_status text not null default 'trialing',
  add column if not exists trial_ends_at timestamptz default (now() + interval '14 days'),
  add column if not exists billing_cycle text not null default 'monthly';

do $$ begin
  alter table profiles add constraint profiles_plan_tier_check
    check (plan_tier in ('free', 'basic', 'pro', 'enterprise'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table profiles add constraint profiles_subscription_status_check
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table profiles add constraint profiles_billing_cycle_check
    check (billing_cycle in ('monthly', 'yearly'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Plano em vigor: teste vencido sem assinatura ativa vale como Free
-- ---------------------------------------------------------------------
create or replace function plan_rank(p_tier text)
returns int language sql immutable as $$
  select case p_tier when 'basic' then 1 when 'pro' then 2 when 'enterprise' then 3 else 0 end
$$;

create or replace function effective_plan(p_owner uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
           when p.subscription_status = 'active' then p.plan_tier
           when p.subscription_status = 'trialing' and p.trial_ends_at > now() then p.plan_tier
           else 'free'
         end
    from profiles p
   where p.id = p_owner
$$;

-- ---------------------------------------------------------------------
-- 3. Só o sistema de pagamento (service_role) muda o plano
-- ---------------------------------------------------------------------
create or replace function profiles_protect_plan()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon')
     and (new.plan_tier, new.subscription_status, new.trial_ends_at, new.billing_cycle)
         is distinct from (old.plan_tier, old.subscription_status, old.trial_ends_at, old.billing_cycle) then
    raise exception 'O plano só pode ser alterado pela assinatura.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_plan on profiles;
create trigger profiles_protect_plan
  before update on profiles
  for each row execute function profiles_protect_plan();

-- ---------------------------------------------------------------------
-- 4. Limites e recursos por plano (conferidos a cada gravação)
--    Mensagens "PLAN_LIMIT:<recurso>" viram o aviso de upgrade no app.
-- ---------------------------------------------------------------------
create or replace function enforce_plan_limits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  plan text := effective_plan(new.owner_id);
  n    int;
  tz   text;
begin
  if tg_table_name = 'clients' then
    if plan = 'free' then
      select count(*) into n from clients where owner_id = new.owner_id;
      if n >= 10 then raise exception 'PLAN_LIMIT:clients'; end if;
    end if;

  elsif tg_table_name = 'services' then
    if plan = 'free' and new.active and (tg_op = 'INSERT' or not old.active) then
      select count(*) into n from services where owner_id = new.owner_id and active and id <> new.id;
      if n >= 3 then raise exception 'PLAN_LIMIT:services'; end if;
    end if;

  elsif tg_table_name = 'appointments' then
    if new.recurrence_group_id is not null and plan_rank(plan) < 1 then
      raise exception 'PLAN_LIMIT:recurrence';
    end if;
    if new.source = 'online' and plan_rank(plan) < 2 then
      raise exception 'O agendamento online deste estúdio está desativado.';
    end if;
    if plan = 'free' then
      select timezone into tz from profiles where id = new.owner_id;
      select count(*) into n from appointments
       where owner_id = new.owner_id and status <> 'cancelado'
         and date_trunc('month', starts_at at time zone tz) = date_trunc('month', new.starts_at at time zone tz);
      if n >= 20 then raise exception 'PLAN_LIMIT:appointments'; end if;
    end if;

  elsif tg_table_name = 'client_packages' then
    if plan_rank(plan) < 2 then raise exception 'PLAN_LIMIT:packages'; end if;
  end if;

  return new;
end;
$$;

drop trigger if exists plan_limits on clients;
create trigger plan_limits before insert on clients
  for each row execute function enforce_plan_limits();

drop trigger if exists plan_limits on services;
create trigger plan_limits before insert or update of active on services
  for each row execute function enforce_plan_limits();

drop trigger if exists plan_limits on appointments;
create trigger plan_limits before insert on appointments
  for each row execute function enforce_plan_limits();

drop trigger if exists plan_limits on client_packages;
create trigger plan_limits before insert on client_packages
  for each row execute function enforce_plan_limits();

-- ---------------------------------------------------------------------
-- 5. Página pública: informa se o agendamento online está liberado
--    (a gravação já é barrada pelo gatilho acima)
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

grant execute on function public_studio(text) to anon, authenticated;
-- Funções internas: não chamáveis pela API
revoke execute on function effective_plan(uuid) from public, anon;
revoke execute on function enforce_plan_limits() from public, anon, authenticated;
revoke execute on function profiles_protect_plan() from public, anon, authenticated;
