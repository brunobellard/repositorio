-- =====================================================================
-- Agenda Beleza — Taxas de cartão só valem no plano que tem o recurso
--
-- Como aplicar: Supabase Dashboard > SQL Editor > colar e executar.
-- Pode ser executado mais de uma vez sem problema.
--
-- "Taxas de cartão" é do plano Básico em diante. Antes, quem baixava para
-- o Free continuava com as taxas descontadas (e a tela de Taxas bloqueada,
-- sem como zerar). Agora, sem o plano, a taxa é sempre R$ 0.
-- As taxas cadastradas ficam guardadas e voltam a valer se o plano voltar.
-- Lançamentos antigos não mudam.
-- =====================================================================

create or replace function payment_fee(p_owner uuid, p_amount numeric, p_method payment_method)
returns numeric
language sql stable security invoker as $$
  select case
    when plan_rank(effective_plan(p_owner)) < plan_rank('basic') then 0
    else round(
      p_amount * coalesce((
        select (payment_fees ->> case p_method
                  when 'debito'   then 'debit'
                  when 'credito'  then 'credit'
                  when 'pix'      then 'pix'
                  when 'dinheiro' then 'cash'
                end)::numeric
          from profiles where id = p_owner
      ), 0) / 100, 2)
  end
$$;

revoke execute on function payment_fee(uuid, numeric, payment_method) from anon, public;
grant execute on function payment_fee(uuid, numeric, payment_method) to authenticated;
