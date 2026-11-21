-- =====================================================================
-- Agenda Beleza — Validação de dados e regras de negócio (QA)
--
-- Como usar: Supabase Dashboard > SQL Editor > colar e executar.
-- SOMENTE LEITURA: nenhuma consulta altera dados.
-- Cada consulta é uma regra; o resultado esperado está no comentário.
-- Rodar depois de cada deploy e de cada migração. Cole o resultado em docs/qa/bugs.md
-- quando alguma regra falhar (sem nomes, telefones ou e-mails de clientes reais).
-- =====================================================================

-- VAL-01 Resumo: todas as regras numa tabela só. Esperado: coluna "problemas" = 0 em todas as linhas.
with r as (
  -- Pacote: sessões usadas = atendimentos concluídos ligados a ele
  select 'VAL-02 pacote com sessões usadas diferente das concluídas' as regra, count(*) as problemas
    from client_packages p
   where p.used_sessions <> (select count(*) from appointments a
                              where a.client_package_id = p.id and a.status = 'concluido')
  union all
  -- Pacote não pode usar mais sessões do que vendeu
  select 'VAL-03 pacote acima do total de sessões', count(*)
    from client_packages where used_sessions > total_sessions
  union all
  -- Pacote cheio deve estar encerrado
  select 'VAL-04 pacote cheio ainda ativo', count(*)
    from client_packages where used_sessions >= total_sessions and status = 'active'
  union all
  -- Todo agendamento precisa ter pelo menos um serviço
  select 'VAL-05 agendamento sem serviços', count(*)
    from appointments a
   where not exists (select 1 from appointment_services s where s.appointment_id = a.id)
  union all
  -- "Ocupado até" sempre preenchido e nunca antes do fim
  select 'VAL-06 busy_until vazio ou antes do fim', count(*)
    from appointments where busy_until is null or busy_until < ends_at
  union all
  -- Fim depois do início
  select 'VAL-07 agendamento com fim antes do início', count(*)
    from appointments where ends_at <= starts_at
  union all
  -- Dois atendimentos não cancelados não podem se sobrepor (o banco já impede; confere)
  select 'VAL-08 atendimentos sobrepostos', count(*)
    from appointments a join appointments b
      on a.owner_id = b.owner_id and a.id < b.id
     and a.status <> 'cancelado' and b.status <> 'cancelado'
     and a.starts_at < b.busy_until and b.starts_at < a.busy_until
  union all
  -- Total = soma dos serviços + taxa de deslocamento
  select 'VAL-09 total diferente de serviços + deslocamento', count(*)
    from appointments a
   where a.total_price <> coalesce((select sum(s.price) from appointment_services s where s.appointment_id = a.id), 0)
                          + coalesce(a.travel_fee, 0)
  union all
  -- Concluído fora de pacote, com valor, precisa ter receita lançada
  select 'VAL-10 concluído sem receita (fora de pacote)', count(*)
    from appointments a
   where a.status = 'concluido' and a.client_package_id is null and a.total_price > 0
     and not exists (select 1 from transactions t where t.appointment_id = a.id)
  union all
  -- Receita automática só para atendimento concluído
  select 'VAL-11 receita de atendimento não concluído', count(*)
    from transactions t join appointments a on a.id = t.appointment_id
   where a.status <> 'concluido'
  union all
  -- Líquido = bruto − taxa
  select 'VAL-12 líquido diferente de bruto − taxa', count(*)
    from transactions
   where gross_amount is not null and net_amount is not null
     and net_amount <> gross_amount - coalesce(fee_amount, 0)
  union all
  -- Venda de pacote tem exatamente uma receita
  select 'VAL-13 pacote sem receita da venda', count(*)
    from client_packages p
   where p.total_paid > 0
     and not exists (select 1 from transactions t where t.client_package_id = p.id)
  union all
  -- Cliente removida (LGPD) não guarda dados pessoais
  select 'VAL-14 cliente removida com dados pessoais', count(*)
    from clients
   where removed_at is not null
     and (whatsapp is not null or email is not null or birth_date is not null
          or technical_notes is not null or address is not null or name <> 'Cliente removida')
  union all
  -- Endereço dos atendimentos de cliente removida apagado
  select 'VAL-15 atendimento de removida com endereço', count(*)
    from appointments a join clients c on c.id = a.client_id
   where c.removed_at is not null and a.service_address is not null
  union all
  -- Dados de dono diferente misturados (cliente de um estúdio no atendimento de outro)
  select 'VAL-16 atendimento com cliente de outro estúdio', count(*)
    from appointments a join clients c on c.id = a.client_id
   where c.owner_id <> a.owner_id
  union all
  -- Dados sem dono (conta excluída pela metade)
  select 'VAL-17 dados sem perfil (órfãos)', count(*)
    from (select owner_id from clients union all select owner_id from appointments
          union all select owner_id from transactions) x
   where not exists (select 1 from profiles p where p.id = x.owner_id)
  union all
  -- Login sem perfil ou perfil sem login
  select 'VAL-18 perfil sem login', count(*)
    from profiles p where not exists (select 1 from auth.users u where u.id = p.id)
  union all
  -- Plano Free: no máximo 10 clientes ativas
  select 'VAL-19 Free acima de 10 clientes', count(*)
    from (select c.owner_id from clients c
           where c.removed_at is null and effective_plan(c.owner_id) = 'free'
           group by c.owner_id having count(*) > 10) x
  union all
  -- Toda tabela do app com RLS ligada
  select 'VAL-20 tabela pública sem RLS', count(*)
    from pg_tables
   where schemaname = 'public' and not rowsecurity
)
select * from r order by regra;

-- VAL-21 Funções que qualquer pessoa (anon, sem login) pode executar.
-- Esperado: só as 4 do link público com veredito "ok" (log_public_event entrou em 21/11/2026, faab3b2: medição de uso do link); nenhuma linha "PROBLEMA".
-- Funções de gatilho ("gatilho") não podem ser chamadas diretamente: aceitáveis, mas o ideal é revogar.
-- Ignora funções de extensões (ex.: btree_gist, gbt_* e *_dist), que são internas do Postgres.
select p.proname as funcao,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       p.prosecdef as roda_como_dono,
       case
         when p.proname in ('public_studio', 'get_public_busy_slots', 'create_public_booking', 'log_public_event') then 'ok (link público)'
         when p.prorettype = 'trigger'::regtype then 'gatilho (aceitável)'
         else 'PROBLEMA'
       end as veredito
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
   and not exists (select 1 from pg_depend d
                    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
 order by veredito, 1;

-- VAL-22 Funções restritas ao servidor. Esperado: false nas duas colunas para as quatro linhas.
select f as funcao,
       has_function_privilege('anon', f::regprocedure, 'execute') as anon_executa,
       has_function_privilege('authenticated', f::regprocedure, 'execute') as logado_executa
  from unnest(array['delete_account(uuid)', 'purge_account_data(uuid)', 'appointments_online_limits()', 'purge_old_app_events()']) f;
