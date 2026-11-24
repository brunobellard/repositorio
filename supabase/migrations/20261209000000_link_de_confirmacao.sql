-- =====================================================================
-- Esmero — Link para a cliente confirmar ou cancelar o horário
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
-- RODAR ANTES do deploy do app que manda o link na mensagem.
--
-- Como funciona:
-- - Cada agendamento ganha um código secreto (confirm_token, aleatório e impossível de adivinhar).
-- - A mensagem de confirmação/lembrete no WhatsApp leva o link /confirmar/<código>.
-- - A cliente abre o link (sem login) e toca em "Confirmar" ou "Cancelar".
-- - O link só mostra o essencial: estúdio, primeiro nome, data, hora, serviços e local.
--   Nada de telefone, valores ou dados de outras clientes.
-- - Só vale para horários que ainda não começaram e que não foram concluídos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Código secreto de cada agendamento
-- ---------------------------------------------------------------------
alter table appointments add column if not exists confirm_token uuid not null default gen_random_uuid();
create unique index if not exists appointments_confirm_token_idx on appointments (confirm_token);

-- ---------------------------------------------------------------------
-- 2. Dados do agendamento para a página pública
-- ---------------------------------------------------------------------
create or replace function public_appointment(p_token uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'business_name', p.business_name,
    'logo_url', p.logo_url,
    'phone', p.phone,
    'theme_color', case when plan_rank(effective_plan(p.id)) >= 2 then p.theme_color else '#C08497' end,
    'timezone', p.timezone,
    'address_street', p.address_street,
    'address_number', p.address_number,
    'address_district', p.address_district,
    'address_city', p.address_city,
    'address_state', p.address_state,
    'client_first_name', split_part(c.name, ' ', 1),
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'status', a.status,
    'location_type', a.location_type,
    'service_address', a.service_address,
    'services', coalesce((
      select jsonb_agg(s.name order by s.position) from appointment_services s where s.appointment_id = a.id
    ), '[]'::jsonb)
  )
  from appointments a
  join profiles p on p.id = a.owner_id
  join clients c on c.id = a.client_id
  where a.confirm_token = p_token
$$;

-- ---------------------------------------------------------------------
-- 3. Confirmar / cancelar pelo link
--    Devolve a situação final: 'confirmado', 'cancelado' ou um código de motivo.
-- ---------------------------------------------------------------------
create or replace function respond_public_appointment(p_token uuid, p_action text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  a appointments;
begin
  if p_action not in ('confirmar', 'cancelar') then
    return 'acao_invalida';
  end if;

  select * into a from appointments where confirm_token = p_token for update;
  if a.id is null then
    return 'nao_encontrado';
  end if;
  if a.status = 'concluido' then
    return 'concluido';
  end if;
  if a.status = 'cancelado' then
    return 'cancelado';
  end if;
  if a.starts_at <= now() then
    return 'passou';
  end if;

  if p_action = 'confirmar' then
    if a.status <> 'confirmado' then
      update appointments set status = 'confirmado' where id = a.id;
    end if;
    return 'confirmado';
  end if;

  update appointments set status = 'cancelado' where id = a.id;
  return 'cancelado';
end;
$$;

revoke execute on function public_appointment(uuid) from public;
revoke execute on function respond_public_appointment(uuid, text) from public;
grant execute on function public_appointment(uuid) to anon, authenticated;
grant execute on function respond_public_appointment(uuid, text) to anon, authenticated;

-- Atualiza o cache do PostgREST (funções e coluna novas visíveis na hora)
notify pgrst, 'reload schema';
