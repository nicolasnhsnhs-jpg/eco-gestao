-- =============================================================================
-- Proposta: serviço avulso ou contrato.
--
-- Na proposta de contrato o PDF fala do valor anual do contrato, do que ele
-- contempla (os serviços da proposta, com a frequência) e das parcelas mensais:
--   "Valor anual do contrato: R$ 6.000,00 (...), contemplando: ..."
--   "Forma de pagamento: 12 parcelas mensais de R$ 500,00 (...), boleto bancário."
-- O valor anual é digitado (vazio = soma dos serviços).
-- =============================================================================

alter table public.propostas
  add column tipo text not null default 'avulsa'
    check (tipo in ('avulsa', 'contrato')),
  add column contrato_valor_anual numeric(12, 2) check (contrato_valor_anual >= 0),
  add column contrato_parcelas smallint check (contrato_parcelas between 1 and 60);

-- A view usa p.*: recria para pegar as colunas novas.
drop view public.v_propostas;
create view public.v_propostas
with (security_invoker = true)
as
select
  p.*,
  case
    when p.status = 'enviada' and p.validade < privado.hoje() then 'expirada'
    else p.status::text
  end as situacao,
  case when p.status = 'enviada' then privado.hoje() - p.data_envio end as dias_sem_resposta
from public.propostas p;

revoke all on public.v_propostas from anon;
grant select on public.v_propostas to authenticated;
