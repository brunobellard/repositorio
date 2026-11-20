-- =====================================================================
-- Agenda Beleza — Funções internas fechadas para quem não está logado (BUG-005)
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- client_history_summary, delete_package e create_offline_appointment foram
-- liberadas para quem está logado, mas não fechadas para visitantes (o padrão
-- do Postgres libera para todos). plan_rank nunca foi fechada.
-- Nenhum dado ficava exposto (sem acesso às tabelas e com RLS), mas a camada
-- de permissão da própria função faltava.
--
-- plan_rank continua funcionando no link público e nos gatilhos: quem a chama
-- são funções que rodam com permissão de dono (security definer).
-- =====================================================================

revoke execute on function public.client_history_summary() from public, anon;
revoke execute on function public.delete_package(uuid) from public, anon;
revoke execute on function public.create_offline_appointment(jsonb, jsonb) from public, anon;
revoke execute on function public.plan_rank(text) from public, anon;

-- Quem está logado continua usando as quatro
grant execute on function public.client_history_summary() to authenticated;
grant execute on function public.delete_package(uuid) to authenticated;
grant execute on function public.create_offline_appointment(jsonb, jsonb) to authenticated;
grant execute on function public.plan_rank(text) to authenticated;
