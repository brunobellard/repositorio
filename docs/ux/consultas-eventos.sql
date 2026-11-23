-- =====================================================================
-- Esmero — Consultas de análise dos eventos de uso (somente leitura)
-- Base: docs/ux/metricas.md · tabela app_events (migração 20261207000000_eventos_de_uso.sql)
--
-- Como usar: Supabase Dashboard > SQL Editor > colar UMA consulta por vez e executar.
-- Todas são SELECT: não alteram nada.
--
-- Contas de teste: cada consulta exclui os estúdios cujo link começa com "qa-"
-- (conta de QA). Se houver outras contas de teste, acrescente os ids na lista
-- `teste` do bloco "contas" — NÃO salve ids ou e-mails reais neste arquivo (repositório público).
--
-- Período: troque `interval '30 days'` conforme a análise.
-- Com poucas usuárias, olhe os números absolutos (n) antes das porcentagens.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Conferência: o que está chegando (últimos 7 dias)
-- ---------------------------------------------------------------------
with contas as (
  select id from profiles where slug like 'qa-%'
  -- union all select '00000000-0000-0000-0000-000000000000'::uuid  -- outras contas de teste
)
select name, is_public, platform, count(*) as n,
       count(distinct account_id) as contas, max(created_at) as ultimo
from app_events
where created_at > now() - interval '7 days'
  and (account_id is null or account_id not in (select id from contas))
group by 1, 2, 3
order by n desc;


-- ---------------------------------------------------------------------
-- 1. Novo agendamento: taxa de conclusão por origem (UX-03, UX-17)
--    Meta: salvos / abertos >= 85%
-- ---------------------------------------------------------------------
with contas as (select id from profiles where slug like 'qa-%'),
e as (
  select * from app_events
  where created_at > now() - interval '30 days' and not is_public
    and account_id not in (select id from contas)
)
select coalesce(props->>'origin', '?') as origem,
       count(*) filter (where name = 'appointment_form_opened')    as abertos,
       count(*) filter (where name = 'appointment_saved')          as salvos,
       count(*) filter (where name = 'appointment_form_abandoned') as abandonados,
       count(*) filter (where name = 'appointment_save_blocked')   as toques_bloqueados,
       round(100.0 * count(*) filter (where name = 'appointment_saved')
             / nullif(count(*) filter (where name = 'appointment_form_opened'), 0), 1) as pct_conclusao
from e
where name in ('appointment_form_opened', 'appointment_saved', 'appointment_form_abandoned', 'appointment_save_blocked')
group by 1
order by abertos desc;


-- ---------------------------------------------------------------------
-- 2. O que mais falta quando "Agendar" é tocado incompleto (UX-03)
--    missing vem como "cliente-servicos-…"
-- ---------------------------------------------------------------------
with contas as (select id from profiles where slug like 'qa-%')
select item as campo_faltando, count(*) as n
from app_events,
     lateral unnest(string_to_array(props->>'missing', '-')) as item
where name = 'appointment_save_blocked'
  and created_at > now() - interval '30 days'
  and account_id not in (select id from contas)
group by 1
order by n desc;


-- ---------------------------------------------------------------------
-- 3. Tempo para marcar um horário (eficiência, ISO 9241-11)
--    Meta do plano de teste: mediana <= 60 s
-- ---------------------------------------------------------------------
with contas as (select id from profiles where slug like 'qa-%')
select coalesce(props->>'origin', '?') as origem,
       count(*) as n,
       round(percentile_cont(0.5) within group (order by (props->>'duration_ms')::numeric) / 1000, 1) as mediana_s,
       round(percentile_cont(0.9) within group (order by (props->>'duration_ms')::numeric) / 1000, 1) as p90_s,
       round(100.0 * avg(((props->>'created_client_inline')::boolean)::int), 1) as pct_cliente_nova_na_hora,
       round(100.0 * avg(((props->>'outside_hours')::boolean)::int), 1)        as pct_fora_expediente
from app_events
where name = 'appointment_saved'
  and created_at > now() - interval '30 days'
  and account_id not in (select id from contas)
  and props ? 'duration_ms'
group by 1
order by n desc;


-- ---------------------------------------------------------------------
-- 4. Antecedência dos agendamentos (UX-05: a faixa de datas ia só até 21 dias)
-- ---------------------------------------------------------------------
with contas as (select id from profiles where slug like 'qa-%')
select case
         when (props->>'days_ahead')::int <= 0  then '0 (hoje)'
         when (props->>'days_ahead')::int <= 7  then '1–7'
         when (props->>'days_ahead')::int <= 21 then '8–21'
         when (props->>'days_ahead')::int <= 42 then '22–42'
         else '43+'
       end as dias_de_antecedencia,
       count(*) as n,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from app_events
where name = 'appointment_saved'
  and created_at > now() - interval '30 days'
  and account_id not in (select id from contas)
  and props ? 'days_ahead'
group by 1
order by min((props->>'days_ahead')::int);


-- ---------------------------------------------------------------------
-- 5. Concluir e receber: quanto tempo depois do fim do atendimento (UX-01)
--    Sinal de problema: mediana > 120 min
-- ---------------------------------------------------------------------
with contas as (select id from profiles where slug like 'qa-%')
select props->>'method' as forma,
       count(*) as n,
       round(percentile_cont(0.5) within group (order by (props->>'minutes_after_end')::numeric)) as mediana_min,
       count(*) filter (where (props->>'minutes_after_end')::numeric < 0) as concluidos_antes_do_fim
from app_events
where name = 'appointment_completed'
  and created_at > now() - interval '30 days'
  and account_id not in (select id from contas)
group by 1
order by n desc;


-- ---------------------------------------------------------------------
-- 6. Erros de status: quantas mudanças são desfeitas (UX-02)
--    Sinal de problema: > 3% dos cancelamentos desfeitos
-- ---------------------------------------------------------------------
with contas as (select id from profiles where slug like 'qa-%'),
e as (
  select * from app_events
  where created_at > now() - interval '30 days'
    and account_id not in (select id from contas)
)
select
  count(*) filter (where name = 'appointment_status_changed' and props->>'to' = 'cancelado') as cancelamentos,
  count(*) filter (where name = 'appointment_status_reverted' and props->>'from' = 'cancelado') as cancelamentos_desfeitos,
  round(100.0 * count(*) filter (where name = 'appointment_status_reverted' and props->>'from' = 'cancelado')
        / nullif(count(*) filter (where name = 'appointment_status_changed' and props->>'to' = 'cancelado'), 0), 1) as pct_desfeitos,
  count(*) filter (where name = 'appointment_status_reverted') as total_revertidos
from e;


-- ---------------------------------------------------------------------
-- 7. Pedidos do link online: tempo até responder (UX-07)
--    Sinal de problema: mediana > 240 min
-- ---------------------------------------------------------------------
with contas as (select id from profiles where slug like 'qa-%')
select name,
       count(*) as n,
       round(percentile_cont(0.5) within group (order by (props->>'minutes_since_request')::numeric)) as mediana_min,
       round(percentile_cont(0.9) within group (order by (props->>'minutes_since_request')::numeric)) as p90_min
from app_events
where name in ('online_booking_confirmed', 'online_booking_declined')
  and created_at > now() - interval '30 days'
  and account_id not in (select id from contas)
group by 1;


-- ---------------------------------------------------------------------
-- 8. Divulgação do link (UX-09): onde compartilham e % de contas novas que
--    compartilham em até 7 dias (meta: 40%)
-- ---------------------------------------------------------------------
with contas as (select id from profiles where slug like 'qa-%')
select props->>'place' as lugar, name, count(*) as n, count(distinct account_id) as contas
from app_events
where name in ('booking_link_shared', 'booking_link_copied')
  and created_at > now() - interval '30 days'
  and account_id not in (select id from contas)
group by 1, 2
order by n desc;

with contas as (select id from profiles where slug like 'qa-%'),
novas as (
  select u.id, u.created_at
  from auth.users u
  where u.created_at > now() - interval '60 days'
    and u.created_at < now() - interval '7 days'
    and u.id not in (select id from contas)
)
select count(*) as contas_novas,
       count(*) filter (where exists (
         select 1 from app_events e
         where e.account_id = n.id
           and e.name in ('booking_link_shared', 'booking_link_copied')
           and e.created_at < n.created_at + interval '7 days')) as compartilharam_7d,
       round(100.0 * count(*) filter (where exists (
         select 1 from app_events e
         where e.account_id = n.id
           and e.name in ('booking_link_shared', 'booking_link_copied')
           and e.created_at < n.created_at + interval '7 days')) / nullif(count(*), 0), 1) as pct
from novas n;


-- ---------------------------------------------------------------------
-- 9. Ativação (UX-10): 1º agendamento salvo em 24 h e 5 agendamentos em 7 dias
--    (contas criadas há 7–60 dias; usa appointment_saved, que não conta exemplos)
-- ---------------------------------------------------------------------
with contas as (select id from profiles where slug like 'qa-%'),
novas as (
  select u.id, u.created_at from auth.users u
  where u.created_at > now() - interval '60 days'
    and u.created_at < now() - interval '7 days'
    and u.id not in (select id from contas)
),
s as (
  select n.id,
         count(e.*) filter (where e.created_at < n.created_at + interval '24 hours') as em_24h,
         count(e.*) filter (where e.created_at < n.created_at + interval '7 days')   as em_7d
  from novas n
  left join app_events e on e.account_id = n.id and e.name = 'appointment_saved'
  group by n.id
)
select count(*) as contas_novas,
       count(*) filter (where em_24h >= 1) as primeiro_em_24h,
       count(*) filter (where em_7d >= 5)  as cinco_em_7d,
       round(100.0 * count(*) filter (where em_24h >= 1) / nullif(count(*), 0), 1) as pct_24h,
       round(100.0 * count(*) filter (where em_7d >= 5)  / nullif(count(*), 0), 1) as pct_7d
from s;


-- ---------------------------------------------------------------------
-- 10. Funil do link público (clientes das profissionais)
--     Cada visita (session_id) conta uma vez por etapa.
--     public_details_viewed não é disparado: "Seus dados" = public_datetime_selected.
-- ---------------------------------------------------------------------
with contas as (select id from profiles where slug like 'qa-%'),
v as (
  select session_id,
         bool_or(name = 'public_link_viewed')       as abriu,
         bool_or(name = 'public_services_selected') as servicos,
         bool_or(name = 'public_datetime_selected') as data_hora,
         bool_or(name = 'public_booking_submitted') as agendou,
         bool_or(name = 'public_booking_failed')    as falhou
  from app_events
  where is_public
    and created_at > now() - interval '30 days'
    and account_id not in (select id from contas)
  group by session_id
)
select count(*) filter (where abriu)     as abriram,
       count(*) filter (where servicos)  as escolheram_servico,
       count(*) filter (where data_hora) as escolheram_data_hora,
       count(*) filter (where agendou)   as agendaram,
       count(*) filter (where falhou)    as tiveram_erro,
       round(100.0 * count(*) filter (where agendou) / nullif(count(*) filter (where abriu), 0), 1) as conversao_pct
from v;

-- Erros no envio do link público, por tipo
with contas as (select id from profiles where slug like 'qa-%')
select props->>'error' as erro, count(*) as n
from app_events
where name = 'public_booking_failed'
  and created_at > now() - interval '30 days'
  and account_id not in (select id from contas)
group by 1
order by n desc;


-- ---------------------------------------------------------------------
-- 11. Uso semanal: profissionais ativas por semana (WAU)
-- ---------------------------------------------------------------------
with contas as (select id from profiles where slug like 'qa-%')
select date_trunc('week', created_at)::date as semana,
       count(distinct account_id) as profissionais_ativas,
       count(*) filter (where name = 'appointment_saved') as agendamentos_criados
from app_events
where not is_public
  and created_at > now() - interval '12 weeks'
  and account_id not in (select id from contas)
group by 1
order by 1;


-- ---------------------------------------------------------------------
-- 12. Uso sem internet: quantos eventos chegaram atrasados pela fila
-- ---------------------------------------------------------------------
with contas as (select id from profiles where slug like 'qa-%')
select platform,
       count(*) as n,
       count(*) filter (where (props->>'queued_s')::int > 300) as atrasados_mais_5min,
       round(100.0 * count(*) filter (where (props->>'queued_s')::int > 300) / nullif(count(*), 0), 1) as pct
from app_events
where not is_public
  and created_at > now() - interval '30 days'
  and account_id not in (select id from contas)
group by 1;

-- Manutenção (NÃO é leitura; rodar só quando decidir): apaga eventos com mais de 13 meses
-- select purge_old_app_events();
