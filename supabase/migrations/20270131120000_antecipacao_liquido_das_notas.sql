-- =============================================================================
-- Antecipação pelo valor líquido das notas.
--
-- A conta a receber guarda o valor bruto (o do serviço / do contrato), mas o que o cliente
-- paga — e o que o banco antecipa — é o boleto: o valor da nota menos as retenções (ISS
-- retido, PIS/COFINS/CSLL retidos, IRRF, INSS). Ex.: notas de 5.700,00 com 5.194,45 de
-- líquido. Antes a antecipação somava o bruto; agora cada conta ligada a uma nota emitida
-- entra pelo líquido dela. Conta sem nota continua pelo valor.
-- =============================================================================

-- Total retido pelo tomador numa nota: a mesma conta de retencoes() em notas.ts.
create or replace function privado.retido_da_nota(n public.notas_fiscais)
returns numeric
language sql
stable
set search_path = ''
as $$
  with t as (
    select coalesce(
             n.tp_ret_piscofins,
             case
               when not n.pis_cofins_retidos then 0
               when coalesce(n.valor_csll, 0) > 0 then 3
               else 1
             end
           ) as tipo
  )
  select round(
           case when n.iss_retido and n.aliquota_iss is not null and n.valor_servico > 0
                then round(n.valor_servico * n.aliquota_iss) / 100 else 0 end
         + case when t.tipo in (1, 3, 4, 5, 9) then coalesce(n.valor_pis, 0) else 0 end
         + case when t.tipo in (1, 3, 4, 6, 7) then coalesce(n.valor_cofins, 0) else 0 end
         + case when t.tipo in (3, 7, 8, 9) then coalesce(n.valor_csll, 0) else 0 end
         + coalesce(n.valor_irrf, 0)
         + coalesce(n.valor_inss, 0),
         2)
  from t
$$;

-- Quanto da conta a receber é antecipado: o valor menos o retido nas notas emitidas dela.
create or replace function privado.valor_a_antecipar(l public.lancamentos)
returns numeric
language sql
stable
set search_path = ''
as $$
  select greatest(
           l.valor - coalesce((
             select sum(privado.retido_da_nota(n))
               from public.notas_fiscais n
              where n.lancamento_id = l.id and n.status = 'emitida'
           ), 0),
           0)
$$;

grant execute on function privado.retido_da_nota(public.notas_fiscais),
  privado.valor_a_antecipar(public.lancamentos) to authenticated;

create or replace function public.antecipar_recebiveis(
  p_lancamentos uuid[],
  p_data        date,
  p_conta       uuid,
  p_instituicao text,
  p_desconto    numeric,
  p_observacoes text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_ids        uuid[];
  v_qtd        integer;
  v_bruto      numeric(12, 2);
  v_id         uuid;
begin
  if not privado.tem_acesso_total() then
    raise exception 'Só o financeiro pode antecipar recebíveis.' using errcode = '42501';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_lancamentos) x;
  if v_ids is null then
    raise exception 'Escolha ao menos uma conta a receber.' using errcode = '23514';
  end if;

  -- Trava as contas escolhidas: ninguém confirma nem antecipa duas vezes ao mesmo tempo.
  perform 1 from public.lancamentos where id = any (v_ids) for update;

  select count(*), sum(privado.valor_a_antecipar(l)) into v_qtd, v_bruto
  from public.lancamentos l
  where id = any (v_ids)
    and tipo = 'entrada'
    and status in ('pendente', 'agendado');

  if v_qtd <> cardinality(v_ids) then
    raise exception 'Só dá para antecipar contas a receber em aberto. Atualize a lista e escolha de novo.'
      using errcode = '23514';
  end if;

  p_desconto := round(coalesce(p_desconto, 0), 2);
  if p_desconto < 0 or p_desconto >= v_bruto then
    raise exception 'O desconto precisa ficar entre zero e o total antecipado.' using errcode = '23514';
  end if;

  insert into public.antecipacoes (data, conta_bancaria_id, instituicao, valor_bruto, desconto, observacoes)
  values (p_data, p_conta, trim(p_instituicao), v_bruto, p_desconto, nullif(trim(p_observacoes), ''))
  returning id into v_id;

  -- Cada conta paga uma parte do desconto, proporcional ao que ela antecipa (o líquido da
  -- nota). O arredondamento pode sobrar (ou faltar) centavos: vão para a maior conta, para
  -- que a soma recebida feche exatamente com o líquido. Um UPDATE só: depois de realizado,
  -- só o admin altera.
  with base as (
    select id, privado.valor_a_antecipar(l) as valor
    from public.lancamentos l
    where id = any (v_ids)
  ), parte as (
    select id,
           valor - round(p_desconto * valor / v_bruto, 2) as liquido,
           row_number() over (order by valor desc, id) as ordem
    from base
  ), sobra as (
    select v_bruto - p_desconto - sum(liquido) as centavos from parte
  )
  update public.lancamentos l
  set status = 'realizado',
      data_pagamento = p_data,
      conta_bancaria_id = p_conta,
      valor_pago = p.liquido + case when p.ordem = 1 then s.centavos else 0 end,
      antecipacao_id = v_id
  from parte p, sobra s
  where l.id = p.id;

  return v_id;
end
$$;

-- Para a tela: quanto cada conta escolhida antecipa (o líquido da nota, ou o valor).
create or replace function public.valores_a_antecipar(p_lancamentos uuid[])
returns table (id uuid, valor numeric)
language sql
stable
set search_path = ''
as $$
  select l.id, privado.valor_a_antecipar(l)
    from public.lancamentos l
   where l.id = any (p_lancamentos)
$$;

revoke execute on function public.valores_a_antecipar(uuid[]) from public, anon;
grant execute on function public.valores_a_antecipar(uuid[]) to authenticated;
