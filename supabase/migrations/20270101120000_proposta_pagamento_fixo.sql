-- Proposta: pagamento fixo do cliente.
-- Marcada, o prazo/forma de pagamento desta proposta vira o padrão das próximas
-- propostas do mesmo cliente (vale a mais recente marcada). Desmarcada, o
-- pagamento vale só para esta proposta (ex.: prazo reduzido num serviço avulso).

alter table public.propostas
  add column pagamento_fixo boolean not null default false;

comment on column public.propostas.pagamento_fixo is
  'Prazo/forma de pagamento fixos para as próximas propostas do cliente.';

create index propostas_pagamento_fixo_idx
  on public.propostas (cliente_id, criado_em desc)
  where pagamento_fixo;

-- A view usa p.*: recria para pegar a coluna nova.
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
