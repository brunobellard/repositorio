-- =====================================================================
-- Agenda Beleza — Personalização de cores (tema)
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- Planos: Free usa a cor padrão (Rosé Antigo); as 6 paletas prontas a partir
-- do Básico; cor personalizada (HEX livre) a partir do Intermediário.
-- =====================================================================

alter table profiles add column if not exists theme_color text not null default '#C08497';

do $$ begin
  alter table profiles add constraint profiles_theme_color_check check (theme_color ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null; end $$;

-- Confere o plano ao trocar a cor ("PLAN_LIMIT:<recurso>" vira o aviso de upgrade no app)
create or replace function enforce_theme_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rank int;
  v_preset boolean := upper(new.theme_color) in ('#C08497', '#B56555', '#6B8E78', '#8B7AA8', '#A68A64', '#27272A');
begin
  if new.theme_color is not distinct from old.theme_color or upper(new.theme_color) = '#C08497' then
    return new;
  end if;
  v_rank := plan_rank(effective_plan(new.id));
  if v_preset and v_rank < 1 then
    raise exception 'PLAN_LIMIT:themes';
  end if;
  if not v_preset and v_rank < 2 then
    raise exception 'PLAN_LIMIT:customTheme';
  end if;
  return new;
end;
$$;

drop trigger if exists theme_plan on profiles;
create trigger theme_plan before update of theme_color on profiles
  for each row execute function enforce_theme_plan();
revoke execute on function enforce_theme_plan() from public, anon, authenticated;

-- Página pública: devolve também a cor do estúdio
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
    'theme_color', p.theme_color,
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
grant execute on function public_studio(text) to anon, authenticated;
