-- =====================================================================
-- Agenda Beleza — Atendimento a domicílio a partir do plano Básico
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- O app mostra o aviso de upgrade; o banco garante a regra:
--   * ativar o modo A domicílio / Híbrido
--   * cadastrar bairros
--   * criar atendimento em domicílio
-- exigem o plano Básico ou superior (ou o período de teste).
-- Mensagem "PLAN_LIMIT:homeService" vira o aviso de upgrade no app.
-- Agendamento online (inclusive a domicílio) continua exigindo o Intermediário.
-- =====================================================================

create or replace function enforce_home_service_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  if tg_table_name = 'profiles' then
    if new.service_mode = 'fixed' or new.service_mode is not distinct from old.service_mode then
      return new;
    end if;
    v_owner := new.id;
  elsif tg_table_name = 'service_areas' then
    v_owner := new.owner_id;
  elsif tg_table_name = 'appointments' then
    if new.location_type <> 'home_service'
       or (tg_op = 'UPDATE' and old.location_type = 'home_service') then
      return new;
    end if;
    v_owner := new.owner_id;
  end if;

  if plan_rank(effective_plan(v_owner)) < 1 then
    raise exception 'PLAN_LIMIT:homeService';
  end if;
  return new;
end;
$$;

drop trigger if exists home_service_plan on profiles;
create trigger home_service_plan before update of service_mode on profiles
  for each row execute function enforce_home_service_plan();

drop trigger if exists home_service_plan on service_areas;
create trigger home_service_plan before insert on service_areas
  for each row execute function enforce_home_service_plan();

drop trigger if exists home_service_plan on appointments;
create trigger home_service_plan before insert or update of location_type on appointments
  for each row execute function enforce_home_service_plan();

revoke execute on function enforce_home_service_plan() from public, anon, authenticated;
