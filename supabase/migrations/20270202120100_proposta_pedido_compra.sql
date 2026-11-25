-- =============================================================================
-- Pedido de compra na proposta (pedido de 25/11/2026).
--
-- O vendedor responde, ao salvar a proposta, se o cliente tem pedido de compra:
--
--   Não         tem_pedido_compra = false, aguardando = false
--   Sim         tem_pedido_compra = true,  aguardando = false, número obrigatório
--   Aguardando  tem_pedido_compra = true,  aguardando = true,  sem número
--
-- A O.S feita a partir da proposta já nasce com a resposta na conferência
-- (os_conferencia), igual à do OK para o financeiro (20270127120000). Quando o
-- vendedor põe o número numa proposta que estava "Aguardando", as O.S dela que
-- ainda aguardavam recebem o número e o aviso do "A faturar" some.
-- =============================================================================

alter table public.propostas
  add column tem_pedido_compra boolean,
  add column pedido_compra text check (char_length(pedido_compra) <= 60),
  add column aguardando_pedido_compra boolean not null default false,
  add constraint proposta_pedido_compra_coerente check (
    (not aguardando_pedido_compra or tem_pedido_compra is true)
    and (tem_pedido_compra is not true or aguardando_pedido_compra
         or nullif(btrim(pedido_compra), '') is not null)
  );

comment on column public.propostas.tem_pedido_compra is
  'O cliente trabalha com pedido de compra (null = vendedor ainda não respondeu).';
comment on column public.propostas.aguardando_pedido_compra is
  'Tem pedido de compra, mas o cliente ainda não mandou o número.';

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

-- O.S ligada à proposta: a conferência que ainda não foi respondida pega a resposta.
create or replace function privado.pedido_compra_da_proposta()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.proposta_id is null then
    return null;
  end if;
  update public.os_conferencia c
     set tem_pedido_compra = p.tem_pedido_compra,
         aguardando_pedido_compra = p.aguardando_pedido_compra,
         pedido_compra = case when p.aguardando_pedido_compra then null else p.pedido_compra end
    from public.propostas p
   where c.os_id = new.id and p.id = new.proposta_id
     and p.tem_pedido_compra is not null
     and c.tem_pedido_compra is null;
  return null;
end
$$;

-- "pedido_da_proposta" roda depois de "depois_criar" (que cria a conferência).
create trigger pedido_da_proposta after insert or update of proposta_id on public.ordens_servico
  for each row execute function privado.pedido_compra_da_proposta();

-- O número chegou: as O.S da proposta que aguardavam recebem o número.
create or replace function privado.pedido_compra_chegou()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.tem_pedido_compra and not new.aguardando_pedido_compra
     and nullif(btrim(new.pedido_compra), '') is not null then
    update public.os_conferencia c
       set aguardando_pedido_compra = false,
           pedido_compra = btrim(new.pedido_compra)
      from public.ordens_servico s
     where s.id = c.os_id and s.proposta_id = new.id
       and c.tem_pedido_compra and c.aguardando_pedido_compra;
  end if;
  return null;
end
$$;

create trigger pedido_compra_chegou
  after update of tem_pedido_compra, pedido_compra, aguardando_pedido_compra on public.propostas
  for each row execute function privado.pedido_compra_chegou();
