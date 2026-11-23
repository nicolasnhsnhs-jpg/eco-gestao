-- =============================================================================
-- Pedido de compra "Aguardando" (pedido de 23/11/2026): no OK para o financeiro o
-- escritório pode responder Sim, Não ou Aguardando. Aguardando = o serviço precisa
-- de pedido de compra para a nota, mas o cliente ainda não mandou. A OS vai para
-- "A faturar" com o aviso de não emitir ainda; quando o número chegar, o escritório
-- (na conferência) ou o financeiro (no próprio cartão) preenche e o aviso some.
--
--   Sim         tem_pedido_compra = true,  aguardando = false, número obrigatório
--   Não         tem_pedido_compra = false, aguardando = false
--   Aguardando  tem_pedido_compra = true,  aguardando = true,  sem número
--
-- privado.conferir_os é igual ao de 20270104120100_os_pedido_compra.sql, só deixa
-- passar sem número quando está aguardando.
-- =============================================================================

alter table public.os_conferencia
  add column aguardando_pedido_compra boolean not null default false,
  add constraint aguardando_pedido_compra_coerente
    check (not aguardando_pedido_compra or tem_pedido_compra is true);

comment on column public.os_conferencia.aguardando_pedido_compra is
  'Precisa de pedido de compra para a nota, mas o cliente ainda não mandou o número.';

grant update (aguardando_pedido_compra) on public.os_conferencia to authenticated;

create or replace function privado.conferir_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.os_conferencia;
begin
  if not privado.pode_gerir_os() then
    raise exception 'Somente o escritório confere a OS.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.ordens_servico where id = p_os and status in ('concluida', 'conferida')
  ) then
    raise exception 'Só dá para conferir uma OS concluída pelo operador.' using errcode = '23514';
  end if;
  select * into c from public.os_conferencia where os_id = p_os;
  if c.tem_pedido_compra is null then
    raise exception 'Responda se o serviço tem pedido de compra.' using errcode = '23514';
  end if;
  if c.tem_pedido_compra and not c.aguardando_pedido_compra
     and nullif(trim(c.pedido_compra), '') is null then
    raise exception 'Informe o número do pedido de compra.' using errcode = '23514';
  end if;
  perform set_config('app.os_transicao', 'sim', true);
  update public.ordens_servico set status = 'conferida' where id = p_os and status = 'concluida';
  perform set_config('app.os_transicao', '', true);
  update public.os_conferencia
     set liberada_financeiro_em = coalesce(liberada_financeiro_em, now()),
         liberada_financeiro_por = coalesce(liberada_financeiro_por, (select auth.uid()))
   where os_id = p_os;
end
$$;
