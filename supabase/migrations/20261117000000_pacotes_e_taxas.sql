-- =====================================================================
-- Agenda Beleza — Pacotes pré-pagos e taxas de maquininha
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Taxas de pagamento (% descontado pela maquininha / banco)
-- ---------------------------------------------------------------------
alter table profiles
  add column if not exists payment_fees jsonb not null
    default '{"debit": 0, "credit": 0, "pix": 0, "cash": 0}'::jsonb;

-- Taxa (em R$) para um valor bruto e forma de pagamento, conforme o perfil do dono
create or replace function payment_fee(p_owner uuid, p_amount numeric, p_method payment_method)
returns numeric
language sql stable security invoker as $$
  select round(
    p_amount * coalesce((
      select (payment_fees ->> case p_method
                when 'debito'   then 'debit'
                when 'credito'  then 'credit'
                when 'pix'      then 'pix'
                when 'dinheiro' then 'cash'
              end)::numeric
        from profiles where id = p_owner
    ), 0) / 100, 2)
$$;

-- ---------------------------------------------------------------------
-- client_packages: pacotes pré-pagos (ex: "Combo 4 manutenções")
-- ---------------------------------------------------------------------
create table if not exists client_packages (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references profiles (id) on delete cascade,
  client_id       uuid not null references clients (id) on delete cascade,
  service_id      uuid not null references services (id) on delete restrict,
  name            text not null,
  total_sessions  int not null check (total_sessions > 0),
  used_sessions   int not null default 0,
  total_paid      numeric(10,2) not null check (total_paid >= 0),
  payment_method  payment_method not null,
  status          text not null default 'active' check (status in ('active', 'completed')),
  expires_at      date,
  created_at      timestamptz not null default now(),
  constraint client_packages_sessions_check check (used_sessions between 0 and total_sessions)
);
create index if not exists client_packages_client_idx on client_packages (owner_id, client_id);

alter table client_packages enable row level security;
drop policy if exists "dados próprios" on client_packages;
create policy "dados próprios" on client_packages
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update, delete on client_packages to authenticated;

-- Sessão agendada usando crédito de pacote
alter table appointments
  add column if not exists client_package_id uuid references client_packages (id) on delete set null;

-- ---------------------------------------------------------------------
-- transactions: valor bruto, taxa e líquido
-- (amount continua sendo o valor bruto, para não quebrar nada)
-- ---------------------------------------------------------------------
alter table transactions
  add column if not exists gross_amount      numeric(10,2),
  add column if not exists fee_amount        numeric(10,2),
  add column if not exists net_amount        numeric(10,2),
  add column if not exists client_package_id uuid references client_packages (id) on delete set null;

update transactions
   set gross_amount = amount, fee_amount = 0, net_amount = amount
 where gross_amount is null;

-- Calcula bruto, taxa e líquido em toda entrada/alteração de transação
create or replace function transactions_compute_fee()
returns trigger language plpgsql security invoker as $$
begin
  new.gross_amount := new.amount;
  new.fee_amount := case
    when new.type = 'receita' and new.payment_method is not null
      then payment_fee(new.owner_id, new.amount, new.payment_method)
    else 0
  end;
  new.net_amount := new.gross_amount - new.fee_amount;
  return new;
end;
$$;

drop trigger if exists transactions_fee on transactions;
create trigger transactions_fee
  before insert or update of amount, payment_method, type on transactions
  for each row execute function transactions_compute_fee();

-- ---------------------------------------------------------------------
-- Baixa automática: concluir uma sessão de pacote consome 1 crédito;
-- desfazer a conclusão devolve o crédito.
-- ---------------------------------------------------------------------
create or replace function appointments_package_usage()
returns trigger language plpgsql security invoker as $$
declare
  delta int := 0;
begin
  if new.client_package_id is null and old.client_package_id is null then
    return new;
  end if;
  if new.status = 'concluido' and old.status <> 'concluido' then
    delta := 1;
  elsif old.status = 'concluido' and new.status <> 'concluido' then
    delta := -1;
  end if;
  if delta <> 0 then
    update client_packages
       set used_sessions = used_sessions + delta,
           status = case when used_sessions + delta >= total_sessions then 'completed' else 'active' end
     where id = coalesce(new.client_package_id, old.client_package_id);
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_package on appointments;
create trigger appointments_package
  after update of status on appointments
  for each row execute function appointments_package_usage();

-- ---------------------------------------------------------------------
-- complete_appointment: sessão de pacote não gera nova cobrança
-- ---------------------------------------------------------------------
drop function if exists complete_appointment(uuid, payment_method);

create or replace function complete_appointment(p_appointment_id uuid, p_payment_method payment_method default null)
returns transactions
language plpgsql security invoker as $$
declare
  appt appointments;
  tx   transactions;
begin
  update appointments set status = 'concluido'
   where id = p_appointment_id and owner_id = auth.uid()
  returning * into appt;

  if appt.id is null then
    raise exception 'Agendamento não encontrado';
  end if;

  -- Já foi pago na venda do pacote: só dá baixa na sessão (feito pelo trigger)
  if appt.client_package_id is not null then
    return null;
  end if;

  if p_payment_method is null then
    raise exception 'Escolha a forma de pagamento';
  end if;

  insert into transactions (type, amount, category, description, payment_method, appointment_id, occurred_at)
  values ('receita', appt.total_price, 'Serviço',
          (select string_agg(name, ' + ' order by position) from appointment_services where appointment_id = appt.id),
          p_payment_method, appt.id, now())
  on conflict (appointment_id) do update
     set amount = excluded.amount, payment_method = excluded.payment_method
  returning * into tx;

  return tx;
end;
$$;

-- ---------------------------------------------------------------------
-- sell_package: cria o pacote e lança o valor recebido hoje no Financeiro
-- ---------------------------------------------------------------------
drop function if exists sell_package(uuid, uuid, text, int, numeric, payment_method, date);

create or replace function sell_package(
  p_client_id      uuid,
  p_service_id     uuid,
  p_name           text,
  p_total_sessions int,
  p_total_paid     numeric,
  p_payment_method payment_method,
  p_expires_at     date default null
)
returns client_packages
language plpgsql security invoker as $$
declare
  pkg client_packages;
begin
  insert into client_packages (client_id, service_id, name, total_sessions, total_paid, payment_method, expires_at)
  values (p_client_id, p_service_id, p_name, p_total_sessions, p_total_paid, p_payment_method, p_expires_at)
  returning * into pkg;

  if p_total_paid > 0 then
    insert into transactions (type, amount, category, description, payment_method, client_package_id, occurred_at)
    values ('receita', p_total_paid, 'Pacote',
            p_name || ' — ' || (select name from clients where id = p_client_id),
            p_payment_method, pkg.id, now());
  end if;

  return pkg;
end;
$$;

grant execute on function complete_appointment(uuid, payment_method) to authenticated;
grant execute on function sell_package(uuid, uuid, text, int, numeric, payment_method, date) to authenticated;
grant execute on function payment_fee(uuid, numeric, payment_method) to authenticated;
revoke execute on function complete_appointment(uuid, payment_method) from anon, public;
revoke execute on function sell_package(uuid, uuid, text, int, numeric, payment_method, date) from anon, public;
revoke execute on function payment_fee(uuid, numeric, payment_method) from anon, public;
