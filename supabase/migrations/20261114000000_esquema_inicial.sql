-- =====================================================================
-- Agenda Beleza — esquema inicial (Supabase / PostgreSQL)
--
-- Cada profissional/estúdio é um usuário do Supabase Auth (e-mail/senha).
-- Todas as tabelas têm owner_id = auth.uid() e Row Level Security (RLS),
-- então cada conta enxerga apenas os próprios dados.
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar,
-- ou `npx supabase db push` com a CLI do Supabase.
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type appointment_status as enum ('pendente', 'confirmado', 'concluido', 'cancelado');
create type transaction_type   as enum ('receita', 'despesa');
create type payment_method     as enum ('pix', 'credito', 'debito', 'dinheiro');
create type message_channel    as enum ('whatsapp', 'email');
create type message_kind       as enum ('confirmacao', 'lembrete', 'recibo');

-- Atualiza updated_at automaticamente
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles: dados do profissional / estúdio (1 por usuário)
-- ---------------------------------------------------------------------
create table profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  business_name  text not null default '',
  owner_name     text not null default '',
  phone          text,
  email          text,
  address        text,
  timezone       text not null default 'America/Sao_Paulo',
  -- expediente padrão, usado para montar a linha do tempo da agenda
  work_start     time not null default '08:00',
  work_end       time not null default '20:00',
  slot_minutes   int  not null default 15 check (slot_minutes in (5, 10, 15, 20, 30, 60)),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Cria o perfil automaticamente quando a pessoa se cadastra
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- services: catálogo de serviços
-- ---------------------------------------------------------------------
create table services (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references profiles (id) on delete cascade,
  name          text not null,
  category      text,                         -- ex: Unhas, Sobrancelhas, Cílios
  price         numeric(10,2) not null check (price >= 0),
  duration_min  int not null check (duration_min > 0),
  color         text,                         -- cor do card na agenda (hex)
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index services_owner_idx on services (owner_id);
create trigger services_updated_at before update on services
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- clients: cadastro e ficha técnica
-- ---------------------------------------------------------------------
create table clients (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references profiles (id) on delete cascade,
  name            text not null,
  whatsapp        text,                       -- apenas dígitos, com DDD (ex: 11987654321)
  email           text,
  birth_date      date,
  technical_notes text,                       -- formato de unha, alergias, nº de henna...
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index clients_owner_idx on clients (owner_id);
create index clients_name_idx  on clients (owner_id, lower(name));
create trigger clients_updated_at before update on clients
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- appointments: agendamentos
-- ---------------------------------------------------------------------
create table appointments (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references profiles (id) on delete cascade,
  client_id    uuid not null references clients (id) on delete restrict,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       appointment_status not null default 'pendente',
  total_price  numeric(10,2) not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_at > starts_at),
  -- impede dois agendamentos ativos no mesmo horário
  exclude using gist (
    owner_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'cancelado')
);
create index appointments_owner_start_idx on appointments (owner_id, starts_at);
create index appointments_client_idx      on appointments (client_id);
create trigger appointments_updated_at before update on appointments
  for each row execute function set_updated_at();

-- Um agendamento pode ter vários serviços. Preço e duração são copiados
-- no momento do agendamento, para o histórico não mudar se o catálogo mudar.
create table appointment_services (
  appointment_id uuid not null references appointments (id) on delete cascade,
  service_id     uuid not null references services (id) on delete restrict,
  owner_id       uuid not null default auth.uid() references profiles (id) on delete cascade,
  name           text not null,
  price          numeric(10,2) not null,
  duration_min   int not null,
  position       int not null default 0,
  primary key (appointment_id, service_id)
);

-- ---------------------------------------------------------------------
-- schedule_blocks: horários bloqueados e folgas
-- ---------------------------------------------------------------------
create table schedule_blocks (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references profiles (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  all_day    boolean not null default false,
  reason     text,                            -- ex: Almoço, Folga, Curso
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index schedule_blocks_owner_idx on schedule_blocks (owner_id, starts_at);

-- ---------------------------------------------------------------------
-- transactions: entradas e saídas financeiras
-- ---------------------------------------------------------------------
create table transactions (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references profiles (id) on delete cascade,
  type            transaction_type not null,
  amount          numeric(10,2) not null check (amount > 0),
  category        text not null,              -- ex: Serviço, Materiais, Aluguel
  description     text,
  payment_method  payment_method,
  appointment_id  uuid unique references appointments (id) on delete set null,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index transactions_owner_date_idx on transactions (owner_id, occurred_at desc);

-- ---------------------------------------------------------------------
-- message_templates: modelos editáveis de WhatsApp e e-mail
-- Variáveis aceitas: {nome} {servico} {data} {hora} {valor} {estudio}
-- ---------------------------------------------------------------------
create table message_templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references profiles (id) on delete cascade,
  channel    message_channel not null,
  kind       message_kind not null,
  subject    text,                            -- só para e-mail
  body       text not null,
  updated_at timestamptz not null default now(),
  unique (owner_id, channel, kind)
);
create trigger message_templates_updated_at before update on message_templates
  for each row execute function set_updated_at();

-- Registro de mensagens enviadas (preparado para envio automático futuro:
-- Evolution API / WhatsApp Cloud API / Resend)
create table message_log (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references profiles (id) on delete cascade,
  appointment_id  uuid references appointments (id) on delete set null,
  client_id       uuid references clients (id) on delete set null,
  channel         message_channel not null,
  kind            message_kind not null,
  provider        text not null,              -- 'deeplink', 'evolution', 'cloud_api', 'resend'
  status          text not null default 'enviado',
  payload         jsonb,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Concluir agendamento e lançar a receita na mesma operação
-- Uso no app: supabase.rpc('complete_appointment', { p_appointment_id, p_payment_method })
-- ---------------------------------------------------------------------
create or replace function complete_appointment(p_appointment_id uuid, p_payment_method payment_method)
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
-- Row Level Security
-- ---------------------------------------------------------------------
alter table profiles             enable row level security;
alter table services             enable row level security;
alter table clients              enable row level security;
alter table appointments         enable row level security;
alter table appointment_services enable row level security;
alter table schedule_blocks      enable row level security;
alter table transactions         enable row level security;
alter table message_templates    enable row level security;
alter table message_log          enable row level security;

create policy "perfil próprio" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "dados próprios" on services
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dados próprios" on clients
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dados próprios" on appointments
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dados próprios" on appointment_services
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dados próprios" on schedule_blocks
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dados próprios" on transactions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dados próprios" on message_templates
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "dados próprios" on message_log
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
