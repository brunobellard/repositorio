-- =====================================================================
-- Criação atômica de agendamento + permissões da API
-- =====================================================================

-- Cria o agendamento com um ou mais serviços numa única operação.
-- Preço, duração e horário de término são calculados no banco a partir do catálogo.
-- Uso no app: supabase.rpc('create_appointment', { p_client_id, p_starts_at, p_service_ids, p_notes, p_status })
create or replace function create_appointment(
  p_client_id   uuid,
  p_starts_at   timestamptz,
  p_service_ids uuid[],
  p_notes       text default null,
  p_status      appointment_status default 'pendente'
)
returns appointments
language plpgsql security invoker as $$
declare
  total_min   int;
  total_price numeric(10,2);
  appt        appointments;
begin
  if coalesce(array_length(p_service_ids, 1), 0) = 0 then
    raise exception 'Escolha pelo menos um serviço';
  end if;

  select sum(s.duration_min), sum(s.price)
    into total_min, total_price
    from services s
   where s.id = any(p_service_ids) and s.owner_id = auth.uid();

  if total_min is null then
    raise exception 'Serviços não encontrados';
  end if;

  insert into appointments (client_id, starts_at, ends_at, status, total_price, notes)
  values (p_client_id, p_starts_at, p_starts_at + make_interval(mins => total_min), p_status, total_price, p_notes)
  returning * into appt;

  insert into appointment_services (appointment_id, service_id, name, price, duration_min, position)
  select appt.id, s.id, s.name, s.price, s.duration_min, array_position(p_service_ids, s.id)
    from services s
   where s.id = any(p_service_ids) and s.owner_id = auth.uid();

  return appt;
end;
$$;

-- Permissões explícitas para usuários logados (o RLS continua filtrando por dono)
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on function create_appointment(uuid, timestamptz, uuid[], text, appointment_status) to authenticated;
grant execute on function complete_appointment(uuid, payment_method) to authenticated;

-- Visitantes não logados não acessam nada
revoke all on all tables in schema public from anon;
