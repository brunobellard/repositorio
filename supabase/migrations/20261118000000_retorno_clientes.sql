-- =====================================================================
-- Agenda Beleza — Retorno de clientes e aniversariantes
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
-- =====================================================================

-- Depois de quantos dias sem voltar a cliente entra em "Para chamar de volta"
alter table profiles
  add column if not exists recall_days int not null default 20 check (recall_days between 5 and 365);

-- Novos modelos de mensagem editáveis em Ajustes > Modelos de mensagem
alter type message_kind add value if not exists 'reativacao';
alter type message_kind add value if not exists 'aniversario';
