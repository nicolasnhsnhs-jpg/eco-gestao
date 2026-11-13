-- Proposta: pagamento no cartão de crédito.
-- A forma de pagamento continua escrita à mão (condicao_pagamento). Quando é cartão:
--   cartao_parcelas  em quantas vezes (1 = à vista)
--   cartao_juros     se as parcelas têm juros
-- Com PIX ou cartão, o prazo de pagamento pode ficar em branco (pagamento na hora).

alter table public.propostas
  add column cartao_parcelas smallint check (cartao_parcelas between 1 and 24),
  add column cartao_juros boolean;

comment on column public.propostas.cartao_parcelas is 'Cartão de crédito: em quantas vezes (1 = à vista).';
comment on column public.propostas.cartao_juros is 'Cartão de crédito: parcelas com juros?';

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
