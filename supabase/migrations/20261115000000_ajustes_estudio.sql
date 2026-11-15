-- =====================================================================
-- Agenda Beleza — Ajustes: dados do estúdio, expediente semanal e logo
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- Folgas e feriados continuam na tabela schedule_blocks (all_day = true),
-- que já aceita períodos (ex: férias de 10/12 a 15/12) e já aparece na agenda.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles: identidade do negócio (cabeçalho de recibos, {estudio}, {endereco})
-- ---------------------------------------------------------------------
alter table profiles
  add column if not exists trade_name       text,   -- nome fantasia / razão social
  add column if not exists document         text,   -- CPF ou CNPJ, só dígitos
  add column if not exists instagram        text,   -- sem @
  add column if not exists logo_url         text,
  add column if not exists address_zip      text,   -- CEP, só dígitos
  add column if not exists address_street   text,
  add column if not exists address_number   text,
  add column if not exists address_district text,
  add column if not exists address_city     text,
  add column if not exists address_state    text;   -- UF

-- ---------------------------------------------------------------------
-- business_hours: expediente semanal padrão (0 = domingo ... 6 = sábado)
-- ---------------------------------------------------------------------
create table if not exists business_hours (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references profiles (id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),
  is_open      boolean not null default true,
  open_time    time not null default '09:00',
  break_start  time,
  break_end    time,
  close_time   time not null default '19:00',
  updated_at   timestamptz not null default now(),
  unique (owner_id, day_of_week),
  check (close_time > open_time),
  -- intervalo é opcional, mas se existir precisa ter início e fim dentro do expediente
  check (
    (break_start is null and break_end is null)
    or (break_start is not null and break_end is not null
        and break_end > break_start
        and break_start >= open_time and break_end <= close_time)
  )
);

drop trigger if exists business_hours_updated_at on business_hours;
create trigger business_hours_updated_at before update on business_hours
  for each row execute function set_updated_at();

alter table business_hours enable row level security;
drop policy if exists "dados próprios" on business_hours;
create policy "dados próprios" on business_hours
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- Storage: bucket público "logos". Cada conta só grava na própria pasta
-- (logos/<id do usuário>/arquivo). A leitura é pública, para o logo
-- aparecer em recibos e e-mails.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "logo próprio: enviar" on storage.objects;
create policy "logo próprio: enviar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "logo próprio: alterar" on storage.objects;
create policy "logo próprio: alterar" on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "logo próprio: remover" on storage.objects;
create policy "logo próprio: remover" on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

-- O Storage também exige permissão de leitura para substituir/remover arquivos
drop policy if exists "logo próprio: ler" on storage.objects;
create policy "logo próprio: ler" on storage.objects
  for select to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);
