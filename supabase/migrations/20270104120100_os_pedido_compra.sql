-- =============================================================================
-- OK para o financeiro com pedido de compra (pedido em 16/11/2026): ao dar o OK
-- o escritório é obrigado a dizer se o serviço tem pedido de compra e, se tiver,
-- o número. A aba "A faturar" mostra um aviso grande para emitir com o pedido.
-- privado.conferir_os é igual ao de 20270104120000_os_ajustes_campo_faturar.sql,
-- com a checagem do pedido.
-- =============================================================================

alter table public.os_conferencia
  add column tem_pedido_compra boolean,
  add column pedido_compra text check (char_length(pedido_compra) <= 60);

grant update (tem_pedido_compra, pedido_compra) on public.os_conferencia to authenticated;

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
  if c.tem_pedido_compra and nullif(trim(c.pedido_compra), '') is null then
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
