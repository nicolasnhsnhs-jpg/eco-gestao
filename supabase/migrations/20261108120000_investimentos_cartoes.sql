-- =============================================================================
-- Investimentos e cartões de crédito.
--
-- Investimentos: o dinheiro aplicado sai da conta (aporte) e fica guardado à parte.
-- Ele NÃO entra no saldo atual nem no saldo projetado: aparece separado, só para
-- saber quanto está investido. Resgate devolve o dinheiro para a conta; rendimento
-- só muda o valor investido.
--
-- Cartões: a compra no cartão é um lançamento de saída ligado ao cartão, que vence
-- junto com a fatura (o dia do vencimento é escolhido no cadastro do cartão).
-- Pagar a fatura confirma de uma vez todas as compras dela.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Investimentos
-- -----------------------------------------------------------------------------

create table public.investimentos (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null check (char_length(trim(nome)) between 2 and 80),
  instituicao        text,
  -- Valor que já estava aplicado no dia em que começou a ser controlado aqui.
  saldo_inicial      numeric(12, 2) not null default 0 check (saldo_inicial >= 0),
  data_saldo_inicial date not null default (now() at time zone 'America/Sao_Paulo')::date,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now(),
  criado_por         uuid references public.perfis (id),
  atualizado_em      timestamptz not null default now(),
  atualizado_por     uuid references public.perfis (id)
);

create type public.tipo_movimento_investimento as enum ('aporte', 'resgate', 'rendimento');

create table public.movimentos_investimento (
  id                uuid primary key default gen_random_uuid(),
  investimento_id   uuid not null references public.investimentos (id),
  tipo              public.tipo_movimento_investimento not null,
  data              date not null,
  -- Rendimento negativo = perda. Aporte e resgate são sempre positivos.
  valor             numeric(12, 2) not null check (valor <> 0),
  -- De onde saiu (aporte) ou para onde voltou (resgate) o dinheiro.
  conta_bancaria_id uuid references public.contas_bancarias (id),
  observacoes       text,
  -- Nada é apagado: um movimento lançado errado é cancelado e fica no histórico.
  cancelado         boolean not null default false,
  criado_em         timestamptz not null default now(),
  criado_por        uuid references public.perfis (id),
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid references public.perfis (id),

  constraint valor_positivo_no_caixa check (tipo = 'rendimento' or valor > 0),
  constraint conta_quando_mexe_no_caixa check ((tipo = 'rendimento') = (conta_bancaria_id is null))
);

create index movimentos_investimento_inv_idx on public.movimentos_investimento (investimento_id, data);
create index movimentos_investimento_conta_idx on public.movimentos_investimento (conta_bancaria_id);

create trigger carimbar before insert or update on public.investimentos
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.investimentos
  for each row execute function privado.registrar_auditoria();

create trigger carimbar before insert or update on public.movimentos_investimento
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.movimentos_investimento
  for each row execute function privado.registrar_auditoria();

-- -----------------------------------------------------------------------------
-- Cartões de crédito
-- -----------------------------------------------------------------------------

create table public.cartoes_credito (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null check (char_length(trim(nome)) between 2 and 80),
  -- Compras a partir do dia do fechamento já vão para a fatura seguinte.
  dia_fechamento    smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento    smallint not null check (dia_vencimento between 1 and 31),
  -- Conta de onde a fatura costuma ser paga.
  conta_bancaria_id uuid references public.contas_bancarias (id),
  limite            numeric(12, 2) check (limite >= 0),
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  criado_por        uuid references public.perfis (id),
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid references public.perfis (id)
);

create trigger carimbar before insert or update on public.cartoes_credito
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.cartoes_credito
  for each row execute function privado.registrar_auditoria();

-- A compra no cartão: o vencimento do lançamento é o vencimento da fatura.
alter table public.lancamentos
  add column cartao_credito_id uuid references public.cartoes_credito (id),
  add column data_compra date,
  add constraint cartao_so_em_compra check (
    cartao_credito_id is null or (tipo = 'saida' and forma_pagamento = 'cartao')
  );

create index lancamentos_fatura_idx on public.lancamentos (cartao_credito_id, vencimento)
  where cartao_credito_id is not null;

-- -----------------------------------------------------------------------------
-- Permissões: as mesmas do resto do financeiro (só Admin e Financeiro).
-- -----------------------------------------------------------------------------

alter table public.investimentos enable row level security;
alter table public.movimentos_investimento enable row level security;
alter table public.cartoes_credito enable row level security;

create policy "financeiro vê investimentos" on public.investimentos for select to authenticated
  using (privado.tem_acesso_total());
create policy "financeiro cadastra investimentos" on public.investimentos for insert to authenticated
  with check (privado.tem_acesso_total());
create policy "financeiro altera investimentos" on public.investimentos for update to authenticated
  using (privado.tem_acesso_total()) with check (privado.tem_acesso_total());

create policy "financeiro vê movimentos de investimento" on public.movimentos_investimento
  for select to authenticated using (privado.tem_acesso_total());
create policy "financeiro lança movimentos de investimento" on public.movimentos_investimento
  for insert to authenticated with check (privado.tem_acesso_total());
create policy "financeiro altera movimentos de investimento" on public.movimentos_investimento
  for update to authenticated
  using (privado.tem_acesso_total()) with check (privado.tem_acesso_total());

create policy "financeiro vê cartões" on public.cartoes_credito for select to authenticated
  using (privado.tem_acesso_total());
create policy "financeiro cadastra cartões" on public.cartoes_credito for insert to authenticated
  with check (privado.tem_acesso_total());
create policy "financeiro altera cartões" on public.cartoes_credito for update to authenticated
  using (privado.tem_acesso_total()) with check (privado.tem_acesso_total());

revoke all on public.investimentos, public.movimentos_investimento, public.cartoes_credito
  from anon, authenticated;
grant select, insert, update on public.investimentos, public.movimentos_investimento,
  public.cartoes_credito to authenticated;
grant all on public.investimentos, public.movimentos_investimento, public.cartoes_credito
  to service_role;

-- -----------------------------------------------------------------------------
-- Views
-- -----------------------------------------------------------------------------

-- v_lancamentos foi criada com "l.*": recriada para mostrar as colunas novas.
drop view public.v_lancamentos;
create view public.v_lancamentos
with (security_invoker = true)
as
select
  l.*,
  (l.status in ('pendente', 'agendado') and l.vencimento < privado.hoje()) as atrasado,
  case
    when l.status in ('pendente', 'agendado') and l.vencimento < privado.hoje() then 'atrasado'
    else l.status::text
  end as situacao
from public.lancamentos l;
revoke all on public.v_lancamentos from anon;
grant select on public.v_lancamentos to authenticated;

-- Movimentos que alteram o saldo das contas: os lançamentos realizados e, agora,
-- o dinheiro que vai para (aporte) ou volta de (resgate) um investimento.
create or replace view public.v_movimentos
with (security_invoker = true)
as
select
  l.id,
  l.conta_bancaria_id,
  l.data_pagamento,
  case when l.tipo = 'entrada' then l.valor_pago else -l.valor_pago end as valor_com_sinal,
  'lancamento'::text as origem
from public.lancamentos l
join public.contas_bancarias c on c.id = l.conta_bancaria_id
where l.status = 'realizado' and l.data_pagamento >= c.data_saldo_inicial
union all
select
  m.id,
  m.conta_bancaria_id,
  m.data,
  case when m.tipo = 'aporte' then -m.valor else m.valor end,
  'investimento'
from public.movimentos_investimento m
join public.contas_bancarias c on c.id = m.conta_bancaria_id
where not m.cancelado and m.tipo in ('aporte', 'resgate') and m.data >= c.data_saldo_inicial;

-- Quanto há em cada investimento.
create view public.v_saldos_investimentos
with (security_invoker = true)
as
select
  i.*,
  i.saldo_inicial + coalesce(sum(
    case when m.tipo = 'resgate' then -m.valor else m.valor end
  ), 0) as saldo_atual,
  coalesce(sum(m.valor) filter (where m.tipo = 'aporte'), 0) as total_aportado,
  coalesce(sum(m.valor) filter (where m.tipo = 'rendimento'), 0) as total_rendimento
from public.investimentos i
left join public.movimentos_investimento m
  on m.investimento_id = i.id and not m.cancelado and m.data >= i.data_saldo_inicial
group by i.id;

revoke all on public.v_saldos_investimentos from anon;
grant select on public.v_saldos_investimentos to authenticated;

-- -----------------------------------------------------------------------------
-- Painel: o total investido aparece à parte (fora do saldo e do projetado).
-- -----------------------------------------------------------------------------

create or replace function public.painel_financeiro()
returns jsonb
language sql stable
set search_path = ''
as $$
  with aberto as (
    select tipo, valor, vencimento
    from public.lancamentos
    where status in ('pendente', 'agendado')
  ), h as (select privado.hoje() as hoje)
  select jsonb_build_object(
    'saldo_atual',      (select coalesce(sum(saldo_atual), 0) from public.v_saldos_contas where ativo),
    'investido',        (select coalesce(sum(saldo_atual), 0) from public.v_saldos_investimentos where ativo),
    'a_receber',        coalesce(sum(valor) filter (where tipo = 'entrada'), 0),
    'a_pagar',          coalesce(sum(valor) filter (where tipo = 'saida'), 0),
    'receber_atrasado', coalesce(sum(valor) filter (where tipo = 'entrada' and vencimento < h.hoje), 0),
    'pagar_atrasado',   coalesce(sum(valor) filter (where tipo = 'saida' and vencimento < h.hoje), 0),
    'receber_hoje',     coalesce(sum(valor) filter (where tipo = 'entrada' and vencimento = h.hoje), 0),
    'pagar_hoje',       coalesce(sum(valor) filter (where tipo = 'saida' and vencimento = h.hoje), 0),
    'receber_30_dias',  coalesce(sum(valor) filter (where tipo = 'entrada' and vencimento between h.hoje and h.hoje + 30), 0),
    'pagar_30_dias',    coalesce(sum(valor) filter (where tipo = 'saida' and vencimento between h.hoje and h.hoje + 30), 0)
  )
  from h left join aberto on true
  group by h.hoje
$$;

-- Resumo mensal: recebido e pago continuam sendo só os lançamentos; o que foi
-- para os investimentos (aportes − resgates) ganha uma coluna própria, para que
-- recebido − pago − investido feche com a variação do saldo.
drop function public.resumo_mensal(integer, integer);
create function public.resumo_mensal(meses_antes integer default 5, meses_depois integer default 2)
returns table (
  mes             date,
  faturamento     numeric,
  despesas        numeric,
  resultado       numeric,
  recebido        numeric,
  pago            numeric,
  investido       numeric,
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
      sum(valor_com_sinal) filter (where origem = 'lancamento' and valor_com_sinal > 0) as recebido,
      -sum(valor_com_sinal) filter (where origem = 'lancamento' and valor_com_sinal < 0) as pago,
      -sum(valor_com_sinal) filter (where origem = 'investimento') as investido,
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
    coalesce(x.investido, 0),
    coalesce(x.fluxo, 0),
    -- Saldo no fim do mês: saldos iniciais das contas que já existiam
    -- + tudo o que mexeu nas contas até o último dia do mês.
    (select coalesce(sum(saldo_inicial), 0) from public.contas_bancarias
      where data_saldo_inicial < (m.mes + interval '1 month')::date)
    + (select coalesce(sum(valor_com_sinal), 0) from public.v_movimentos
        where data_pagamento < (m.mes + interval '1 month')::date)
  from meses m
  left join competencia c on c.mes = m.mes
  left join caixa x on x.mes = m.mes
  order by m.mes
$$;

revoke execute on function public.resumo_mensal(integer, integer) from public, anon;
grant execute on function public.resumo_mensal(integer, integer) to authenticated;
