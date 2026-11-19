-- =====================================================================
-- Agenda Beleza — O banco também reserva o tempo de deslocamento
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- Antes, a regra "dois atendimentos não podem se sobrepor" olhava só
-- início e fim do atendimento. Um atendimento a domicílio podia ser
-- marcado colado ao seguinte, sem o tempo de deslocamento.
-- Agora cada atendimento guarda "ocupado até" (fim + deslocamento quando é
-- a domicílio), e a regra de sobreposição usa esse horário.
--
-- O deslocamento usado é o configurado no momento em que o atendimento é
-- criado ou alterado (mudar a configuração não altera os já marcados).
--
-- Se aparecer o aviso "Há atendimentos encavalados...", a regra nova não
-- foi ativada (a antiga continua valendo). Rode a consulta do fim deste
-- arquivo para ver quais são, ajuste no app e execute o arquivo de novo.
-- =====================================================================

-- 1. "Ocupado até": fim do atendimento + deslocamento, quando é a domicílio
alter table appointments add column if not exists busy_until timestamptz;

create or replace function appointments_set_busy_until()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.busy_until := new.ends_at + case
    when new.location_type = 'home_service' then make_interval(mins => coalesce(
      (select travel_buffer_minutes from profiles where id = new.owner_id), 0))
    else interval '0'
  end;
  return new;
end;
$$;
revoke execute on function appointments_set_busy_until() from public, anon, authenticated;

drop trigger if exists appointments_busy_until on appointments;
create trigger appointments_busy_until
  before insert or update of starts_at, ends_at, location_type on appointments
  for each row execute function appointments_set_busy_until();

-- Preenche os atendimentos que já existem
update appointments a
   set busy_until = a.ends_at + case
     when a.location_type = 'home_service' then make_interval(mins => p.travel_buffer_minutes)
     else interval '0' end
  from profiles p
 where p.id = a.owner_id
   and a.busy_until is distinct from a.ends_at + case
     when a.location_type = 'home_service' then make_interval(mins => p.travel_buffer_minutes)
     else interval '0' end;
update appointments set busy_until = ends_at where busy_until is null;
alter table appointments alter column busy_until set not null;

-- 2. Troca a regra de sobreposição (só se nenhum atendimento atual já estiver encavalado)
do $$
declare
  old_name text;
begin
  begin
    alter table appointments add constraint appointments_no_overlap_travel
      exclude using gist (owner_id with =, tstzrange(starts_at, busy_until) with &&)
      where (status <> 'cancelado');
  exception
    when duplicate_table or duplicate_object then
      null; -- já existe (arquivo executado antes)
    when exclusion_violation then
      raise notice 'Há atendimentos encavalados com o deslocamento. A regra nova não foi ativada; veja a consulta no fim do arquivo.';
      return;
  end;

  -- A regra antiga (só início e fim) fica redundante: remove
  for old_name in
    select conname from pg_constraint
     where conrelid = 'appointments'::regclass and contype = 'x'
       and conname <> 'appointments_no_overlap_travel'
  loop
    execute format('alter table appointments drop constraint %I', old_name);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Consulta de apoio (opcional): atendimentos que encostam no deslocamento
-- de outro. Selecione só estas linhas e execute para ver a lista.
-- ---------------------------------------------------------------------
-- select a.starts_at, a.ends_at, a.busy_until, b.starts_at as proximo_inicio
--   from appointments a
--   join appointments b on b.owner_id = a.owner_id and b.id <> a.id
--  where a.status <> 'cancelado' and b.status <> 'cancelado'
--    and tstzrange(a.starts_at, a.busy_until) && tstzrange(b.starts_at, b.busy_until)
--    and a.starts_at <= b.starts_at
--  order by a.starts_at;
