-- =====================================================================
-- Bellaflow — Deslocamento: padrão "sem deslocamento" e aplicar aos já marcados
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
-- RODAR ANTES do deploy do app com a pergunta "Aplicar aos já marcados?".
--
-- 1. Contas novas começam com "Sem deslocamento" (0 min). As contas que já
--    existem continuam com o tempo que escolheram.
-- 2. apply_travel_buffer_to_upcoming(): usa o tempo de deslocamento configurado
--    agora nos atendimentos a domicílio futuros (pendentes ou confirmados).
--    Se aumentar o tempo fizer um atendimento encostar no seguinte, esse fica
--    como estava e entra na contagem de "pulados".
-- =====================================================================

alter table profiles alter column travel_buffer_minutes set default 0;

create or replace function apply_travel_buffer_to_upcoming()
returns jsonb
language plpgsql security invoker as $$
declare
  v_buffer  int;
  r         record;
  v_updated int := 0;
  v_skipped int := 0;
begin
  select travel_buffer_minutes into v_buffer from profiles where id = auth.uid();
  if v_buffer is null then
    raise exception 'Perfil não encontrado';
  end if;

  for r in
    select id, ends_at from appointments
     where owner_id = auth.uid()
       and location_type = 'home_service'
       and status in ('pendente', 'confirmado')
       and starts_at >= now()
       and busy_until is distinct from ends_at + make_interval(mins => v_buffer)
     order by starts_at
  loop
    begin
      update appointments set busy_until = r.ends_at + make_interval(mins => v_buffer) where id = r.id;
      v_updated := v_updated + 1;
    exception
      -- O deslocamento maior encostaria no próximo atendimento: deixa este como estava
      when exclusion_violation then
        v_skipped := v_skipped + 1;
    end;
  end loop;

  return jsonb_build_object('atualizados', v_updated, 'pulados', v_skipped);
end;
$$;

grant execute on function apply_travel_buffer_to_upcoming() to authenticated;
revoke execute on function apply_travel_buffer_to_upcoming() from anon, public;

notify pgrst, 'reload schema';
