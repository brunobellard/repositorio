-- =====================================================================
-- Agenda Beleza — Onboarding e exclusão de conta
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Onboarding: contas novas passam pelos 3 passos iniciais.
--    Contas que já existiam quando a coluna foi criada ficam como concluídas.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'onboarding_completed'
  ) then
    alter table profiles add column onboarding_completed boolean not null default false;
    update profiles set onboarding_completed = true;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. Exclusão permanente da conta (exigência da App Store e do Google Play)
--
-- Todas as tabelas já usam owner_id ... references profiles (id) ON DELETE CASCADE,
-- e profiles.id references auth.users ON DELETE CASCADE.
-- Algumas ligações internas são RESTRICT de propósito (ex.: não apagar uma cliente
-- que tem agendamentos). Para a exclusão total não esbarrar nelas, esta função
-- apaga os dados na ordem certa antes de a conta ser removida.
--
-- Só a Edge Function delete-account (service role) pode chamar.
-- ---------------------------------------------------------------------
create or replace function purge_account_data(p_owner uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from message_log          where owner_id = p_owner;
  delete from transactions         where owner_id = p_owner;
  delete from appointment_services where owner_id = p_owner;
  delete from appointments         where owner_id = p_owner;
  delete from client_packages      where owner_id = p_owner;
  delete from schedule_blocks      where owner_id = p_owner;
  delete from clients              where owner_id = p_owner;
  delete from services             where owner_id = p_owner;
  delete from business_hours       where owner_id = p_owner;
  delete from message_templates    where owner_id = p_owner;
end;
$$;

revoke execute on function purge_account_data(uuid) from public, anon, authenticated;
grant execute on function purge_account_data(uuid) to service_role;
