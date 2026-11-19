-- =====================================================================
-- Agenda Beleza — Ao cair para um plano menor, recursos pagos param de valer
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- O que já estava salvo continua guardado (nada é apagado), mas deixa de valer:
--   1. Serviços: no Free, com mais de 3 serviços ativos (ex: o teste venceu),
--      novos agendamentos ficam bloqueados até desativar os excedentes.
--   2. Página pública: a cor paga e o modo a domicílio só aparecem quando o
--      plano em vigor tem esses recursos.
-- =====================================================================

-- 1. Serviços acima do limite do Free bloqueiam novos agendamentos
create or replace function enforce_free_active_services()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if effective_plan(new.owner_id) = 'free'
     and (select count(*) from services where owner_id = new.owner_id and active) > 3 then
    raise exception 'PLAN_LIMIT:services';
  end if;
  return new;
end;
$$;
revoke execute on function enforce_free_active_services() from public, anon, authenticated;

drop trigger if exists free_active_services on appointment_services;
create trigger free_active_services
  before insert on appointment_services
  for each row execute function enforce_free_active_services();

-- 2. Página pública: cor e modo de atendimento conforme o plano em vigor
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
    -- A cor no link é recurso do Intermediário; abaixo dele, a cor padrão
    'theme_color', case when plan_rank(effective_plan(p.id)) >= 2 then p.theme_color else '#C08497' end,
    -- Atendimento a domicílio a partir do Básico; abaixo dele, só no estúdio
    'service_mode', case when plan_rank(effective_plan(p.id)) >= 1 then p.service_mode else 'fixed' end,
    'travel_buffer_minutes', p.travel_buffer_minutes,
    'areas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'name', a.neighborhood_name,
               'travel_fee', a.travel_fee, 'allowed_days', a.allowed_days) order by a.neighborhood_name)
        from service_areas a
       where a.owner_id = p.id and a.is_active and plan_rank(effective_plan(p.id)) >= 1
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
grant execute on function public_studio(text) to anon, authenticated;
