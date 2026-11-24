-- =====================================================================
-- Esmero — Repetição sem data para acabar
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
-- RODAR ANTES do deploy do app com a opção "Sem fim".
--
-- Como funciona:
-- - A série "sem fim" é salva com a regra sem COUNT/UNTIL e nasce com 1 ano de sessões.
-- - Quando a última sessão fica a menos de 6 meses, o app chama continue_series com as
--   próximas datas (até 1 ano à frente), usando a última sessão como modelo.
-- - Data que esbarra em outro compromisso ou no limite do plano é pulada (as outras entram).
-- - Para encerrar a série, a profissional cancela "este e os próximos": com a última
--   sessão cancelada, a série não é mais estendida.
-- =====================================================================

create or replace function continue_series(p_group uuid, p_starts_at timestamptz[])
returns setof appointments
language plpgsql security invoker as $$
declare
  last  appointments;
  v_ids uuid[];
  start timestamptz;
  appt  appointments;
  ids   uuid[] := '{}';
begin
  -- Modelo: a última sessão da série (a mais tarde)
  select * into last from appointments
   where recurrence_group_id = p_group and owner_id = auth.uid()
   order by starts_at desc
   limit 1;
  if last.id is null then
    raise exception 'Série não encontrada';
  end if;
  if last.status = 'cancelado' then
    raise exception 'Série encerrada';
  end if;
  if last.recurrence_rule is null or last.recurrence_rule ~ '(^|;)(COUNT|UNTIL)=' then
    raise exception 'Esta série tem data para acabar';
  end if;

  select array_agg(service_id order by position) into v_ids
    from appointment_services where appointment_id = last.id;

  foreach start in array p_starts_at loop
    -- Só datas depois da última sessão e no máximo ~1 ano e meio à frente
    continue when start <= last.starts_at or start > now() + interval '550 days';
    begin
      appt := create_appointment(last.client_id, start, v_ids, last.notes, 'pendente', p_group,
                                 last.recurrence_rule, null, last.location_type,
                                 last.service_address, last.travel_fee);
      ids := ids || appt.id;
    exception
      -- Horário já ocupado, limite do plano ou serviço desativado: pula esta data
      when exclusion_violation or raise_exception or check_violation then
        null;
    end;
  end loop;

  return query select * from appointments where id = any(ids) order by starts_at;
end;
$$;

grant execute on function continue_series(uuid, timestamptz[]) to authenticated;
revoke execute on function continue_series(uuid, timestamptz[]) from anon, public;

notify pgrst, 'reload schema';
