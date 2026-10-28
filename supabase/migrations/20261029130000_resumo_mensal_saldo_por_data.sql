-- =============================================================================
-- Resumo mensal: o saldo inicial de cada conta só entra a partir do mês em que
-- a conta passou a ser controlada (antes, aparecia também nos meses anteriores).
-- =============================================================================

create or replace function public.resumo_mensal(meses_antes integer default 5, meses_depois integer default 2)
returns table (
  mes             date,
  faturamento     numeric,
  despesas        numeric,
  resultado       numeric,
  recebido        numeric,
  pago            numeric,
  fluxo           numeric,
  saldo_acumulado numeric
)
language sql stable
set search_path = ''
as $$
  with meses as (
    select generate_series(
      date_trunc('month', privado.hoje()) - make_interval(months => meses_antes),
      date_trunc('month', privado.hoje()) + make_interval(months => meses_depois),
      interval '1 month'
    )::date as mes
  ),
  competencia as (
    select
      competencia as mes,
      sum(valor) filter (where tipo = 'entrada') as faturamento,
      sum(valor) filter (where tipo = 'saida') as despesas
    from public.lancamentos
    where status <> 'cancelado'
    group by competencia
  ),
  caixa as (
    select
      date_trunc('month', data_pagamento)::date as mes,
      sum(valor_com_sinal) filter (where valor_com_sinal > 0) as recebido,
      -sum(valor_com_sinal) filter (where valor_com_sinal < 0) as pago,
      sum(valor_com_sinal) as fluxo
    from public.v_movimentos
    group by 1
  )
  select
    m.mes,
    coalesce(c.faturamento, 0),
    coalesce(c.despesas, 0),
    coalesce(c.faturamento, 0) - coalesce(c.despesas, 0),
    coalesce(x.recebido, 0),
    coalesce(x.pago, 0),
    coalesce(x.fluxo, 0),
    -- Saldo no fim do mês: saldos iniciais das contas que já existiam
    -- + tudo o que foi realizado até o último dia do mês.
    (select coalesce(sum(saldo_inicial), 0) from public.contas_bancarias
      where data_saldo_inicial < (m.mes + interval '1 month')::date)
    + (select coalesce(sum(valor_com_sinal), 0) from public.v_movimentos
        where data_pagamento < (m.mes + interval '1 month')::date)
  from meses m
  left join competencia c on c.mes = m.mes
  left join caixa x on x.mes = m.mes
  order by m.mes
$$;
