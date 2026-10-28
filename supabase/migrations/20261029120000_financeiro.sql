-- =============================================================================
-- Financeiro: contas bancárias, categorias, fornecedores e lançamentos
-- (equivalente às abas Configurações e Lançamentos da planilha antiga)
-- =============================================================================

-- Data de hoje no horário de Brasília (o servidor do banco usa UTC).
create function privado.hoje()
returns date
language sql stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

grant execute on function privado.hoje() to authenticated;

-- -----------------------------------------------------------------------------
-- Cadastros de apoio
-- -----------------------------------------------------------------------------

create type public.tipo_conta as enum ('corrente', 'poupanca', 'caixa', 'outro');

create table public.contas_bancarias (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null check (char_length(trim(nome)) between 2 and 80),
  banco              text,
  tipo               public.tipo_conta not null default 'corrente',
  saldo_inicial      numeric(12, 2) not null default 0,
  -- Lançamentos realizados antes desta data não entram no saldo (já estão no saldo inicial).
  data_saldo_inicial date not null default (now() at time zone 'America/Sao_Paulo')::date,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now(),
  criado_por         uuid references public.perfis (id),
  atualizado_em      timestamptz not null default now(),
  atualizado_por     uuid references public.perfis (id)
);

create type public.tipo_categoria as enum ('receita', 'despesa');

create table public.categorias_financeiras (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (char_length(trim(nome)) between 2 and 80),
  tipo           public.tipo_categoria not null,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references public.perfis (id),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id),
  unique (tipo, nome)
);

create table public.fornecedores (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (char_length(trim(nome)) between 2 and 200),
  cpf_cnpj       text unique check (
    cpf_cnpj is null or privado.cpf_valido(cpf_cnpj) or privado.cnpj_valido(cpf_cnpj)
  ),
  telefone       text check (telefone ~ '^\d{10,11}$'),
  email          text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  observacoes    text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references public.perfis (id),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id)
);

-- -----------------------------------------------------------------------------
-- Lançamentos (contas a pagar e a receber)
-- -----------------------------------------------------------------------------

create type public.tipo_lancamento as enum ('entrada', 'saida');
create type public.status_lancamento as enum ('pendente', 'agendado', 'realizado', 'cancelado');
create type public.forma_pagamento as enum (
  'pix', 'boleto', 'transferencia', 'cartao', 'dinheiro', 'debito_automatico', 'outro'
);

create table public.lancamentos (
  id                    uuid primary key default gen_random_uuid(),
  tipo                  public.tipo_lancamento not null,
  descricao             text not null check (char_length(trim(descricao)) between 2 and 300),
  cliente_id            uuid references public.clientes (id),
  fornecedor_id         uuid references public.fornecedores (id),
  categoria_id          uuid not null references public.categorias_financeiras (id),
  conta_bancaria_id     uuid references public.contas_bancarias (id),
  -- Mês a que o valor pertence (faturamento). Sempre o dia 1 do mês.
  competencia           date not null,
  -- Quando deveria entrar/sair.
  vencimento            date not null,
  -- Quando de fato entrou/saiu (fluxo de caixa).
  data_pagamento        date,
  valor                 numeric(12, 2) not null check (valor > 0),
  valor_pago            numeric(12, 2) check (valor_pago >= 0),
  status                public.status_lancamento not null default 'pendente',
  forma_pagamento       public.forma_pagamento,
  numero_nota_fiscal    text,
  parcela_numero        smallint,
  parcela_total         smallint,
  grupo_parcelamento_id uuid,
  observacoes           text,
  confirmado_por        uuid references public.perfis (id),
  confirmado_em         timestamptz,
  criado_em             timestamptz not null default now(),
  criado_por            uuid references public.perfis (id),
  atualizado_em         timestamptz not null default now(),
  atualizado_por        uuid references public.perfis (id),

  constraint cliente_ou_fornecedor check (cliente_id is null or fornecedor_id is null),
  constraint realizado_completo check (
    status <> 'realizado'
    or (data_pagamento is not null and valor_pago is not null and conta_bancaria_id is not null)
  ),
  constraint parcelas_coerentes check (
    (parcela_numero is null and parcela_total is null)
    or (parcela_numero between 1 and parcela_total and parcela_total between 2 and 120)
  )
);

create index lancamentos_vencimento_idx on public.lancamentos (vencimento);
create index lancamentos_status_idx on public.lancamentos (status, tipo);
create index lancamentos_cliente_idx on public.lancamentos (cliente_id);
create index lancamentos_fornecedor_idx on public.lancamentos (fornecedor_id);
create index lancamentos_grupo_idx on public.lancamentos (grupo_parcelamento_id);

-- -----------------------------------------------------------------------------
-- Regras automáticas
-- -----------------------------------------------------------------------------

create function privado.antes_salvar_lancamento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo_categoria public.tipo_categoria;
begin
  -- Lançamento já realizado: só o administrador mexe (evita alterar o caixa sem querer).
  if tg_op = 'UPDATE' and old.status = 'realizado' and not privado.e_admin() then
    raise exception 'Este lançamento já foi confirmado. Só o administrador pode alterá-lo.'
      using errcode = '42501';
  end if;

  new.competencia := date_trunc('month', new.competencia)::date;

  select tipo into v_tipo_categoria from public.categorias_financeiras where id = new.categoria_id;
  if (new.tipo = 'entrada') <> (v_tipo_categoria = 'receita') then
    raise exception 'A categoria escolhida não combina com o tipo do lançamento (entrada/saída).'
      using errcode = '23514';
  end if;

  if new.status = 'realizado' then
    new.valor_pago := coalesce(new.valor_pago, new.valor);
    if tg_op = 'INSERT' or old.status <> 'realizado' then
      new.confirmado_por := auth.uid();
      new.confirmado_em := now();
    end if;
  else
    -- Voltou a ficar em aberto (ou foi cancelado): limpa os dados do pagamento.
    new.data_pagamento := null;
    new.valor_pago := null;
    new.confirmado_por := null;
    new.confirmado_em := null;
  end if;

  return new;
end
$$;

create trigger carimbar before insert or update on public.contas_bancarias
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.contas_bancarias
  for each row execute function privado.registrar_auditoria();

create trigger carimbar before insert or update on public.categorias_financeiras
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.categorias_financeiras
  for each row execute function privado.registrar_auditoria();

create trigger carimbar before insert or update on public.fornecedores
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.fornecedores
  for each row execute function privado.registrar_auditoria();

create trigger carimbar before insert or update on public.lancamentos
  for each row execute function privado.carimbar();
create trigger antes_salvar before insert or update on public.lancamentos
  for each row execute function privado.antes_salvar_lancamento();
create trigger auditoria after insert or update or delete on public.lancamentos
  for each row execute function privado.registrar_auditoria();

-- -----------------------------------------------------------------------------
-- Permissões: só Admin e Financeiro enxergam qualquer coisa do financeiro.
-- Nada é apagado: lançamentos são cancelados; cadastros, desativados.
-- -----------------------------------------------------------------------------

alter table public.contas_bancarias enable row level security;
alter table public.categorias_financeiras enable row level security;
alter table public.fornecedores enable row level security;
alter table public.lancamentos enable row level security;

create policy "financeiro vê contas" on public.contas_bancarias for select to authenticated
  using (privado.tem_acesso_total());
create policy "financeiro cadastra contas" on public.contas_bancarias for insert to authenticated
  with check (privado.tem_acesso_total());
create policy "financeiro altera contas" on public.contas_bancarias for update to authenticated
  using (privado.tem_acesso_total()) with check (privado.tem_acesso_total());

create policy "financeiro vê categorias" on public.categorias_financeiras for select to authenticated
  using (privado.tem_acesso_total());
create policy "financeiro cadastra categorias" on public.categorias_financeiras for insert to authenticated
  with check (privado.tem_acesso_total());
create policy "financeiro altera categorias" on public.categorias_financeiras for update to authenticated
  using (privado.tem_acesso_total()) with check (privado.tem_acesso_total());

create policy "financeiro vê fornecedores" on public.fornecedores for select to authenticated
  using (privado.tem_acesso_total());
create policy "financeiro cadastra fornecedores" on public.fornecedores for insert to authenticated
  with check (privado.tem_acesso_total());
create policy "financeiro altera fornecedores" on public.fornecedores for update to authenticated
  using (privado.tem_acesso_total()) with check (privado.tem_acesso_total());

create policy "financeiro vê lançamentos" on public.lancamentos for select to authenticated
  using (privado.tem_acesso_total());
create policy "financeiro cadastra lançamentos" on public.lancamentos for insert to authenticated
  with check (privado.tem_acesso_total());
create policy "financeiro altera lançamentos" on public.lancamentos for update to authenticated
  using (privado.tem_acesso_total()) with check (privado.tem_acesso_total());

revoke all on public.contas_bancarias, public.categorias_financeiras, public.fornecedores,
  public.lancamentos from anon, authenticated;
grant select, insert, update on public.contas_bancarias, public.categorias_financeiras,
  public.fornecedores, public.lancamentos to authenticated;
grant all on public.contas_bancarias, public.categorias_financeiras, public.fornecedores,
  public.lancamentos to service_role;

-- -----------------------------------------------------------------------------
-- Consultas prontas (views). "security_invoker" = respeitam o RLS de quem consulta.
-- -----------------------------------------------------------------------------

-- Lançamentos com a situação calculada: "atrasado" não é digitado, é calculado.
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

-- Movimentos que alteram o saldo: realizados, a partir da data do saldo inicial da conta.
create view public.v_movimentos
with (security_invoker = true)
as
select
  l.id,
  l.conta_bancaria_id,
  l.data_pagamento,
  case when l.tipo = 'entrada' then l.valor_pago else -l.valor_pago end as valor_com_sinal
from public.lancamentos l
join public.contas_bancarias c on c.id = l.conta_bancaria_id
where l.status = 'realizado' and l.data_pagamento >= c.data_saldo_inicial;

create view public.v_saldos_contas
with (security_invoker = true)
as
select
  c.*,
  c.saldo_inicial + coalesce(sum(m.valor_com_sinal), 0) as saldo_atual
from public.contas_bancarias c
left join public.v_movimentos m on m.conta_bancaria_id = c.id
group by c.id;

revoke all on public.v_lancamentos, public.v_movimentos, public.v_saldos_contas from anon;
grant select on public.v_lancamentos, public.v_movimentos, public.v_saldos_contas to authenticated;

-- -----------------------------------------------------------------------------
-- Funções do painel
-- -----------------------------------------------------------------------------

-- Números do topo do painel (equivalente à aba Painel da planilha).
create function public.painel_financeiro()
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

-- Resumo mês a mês (equivalente à aba Resumo Mensal da planilha).
create function public.resumo_mensal(meses_antes integer default 5, meses_depois integer default 2)
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
  ),
  base as (
    -- Saldo antes do primeiro mês mostrado: saldos iniciais + tudo o que foi realizado antes.
    select
      (select coalesce(sum(saldo_inicial), 0) from public.contas_bancarias)
      + (select coalesce(sum(valor_com_sinal), 0) from public.v_movimentos
          where data_pagamento < (select min(mes) from meses)) as saldo
  )
  select
    m.mes,
    coalesce(c.faturamento, 0),
    coalesce(c.despesas, 0),
    coalesce(c.faturamento, 0) - coalesce(c.despesas, 0),
    coalesce(x.recebido, 0),
    coalesce(x.pago, 0),
    coalesce(x.fluxo, 0),
    (select saldo from base) + sum(coalesce(x.fluxo, 0)) over (order by m.mes)
  from meses m
  left join competencia c on c.mes = m.mes
  left join caixa x on x.mes = m.mes
  order by m.mes
$$;

revoke execute on function public.painel_financeiro(), public.resumo_mensal(integer, integer)
  from public, anon;
grant execute on function public.painel_financeiro(), public.resumo_mensal(integer, integer)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Dados iniciais: as categorias da planilha
-- -----------------------------------------------------------------------------

insert into public.categorias_financeiras (tipo, nome) values
  ('receita', 'Serviços prestados'),
  ('receita', 'Contrato recorrente'),
  ('receita', 'Outras receitas'),
  ('despesa', 'Folha / Pró-labore'),
  ('despesa', 'Combustível'),
  ('despesa', 'Descarte de resíduos'),
  ('despesa', 'Fornecedores'),
  ('despesa', 'Impostos e taxas'),
  ('despesa', 'Aluguel'),
  ('despesa', 'Energia / Água / Internet'),
  ('despesa', 'Manutenção'),
  ('despesa', 'Equipamentos'),
  ('despesa', 'Marketing'),
  ('despesa', 'Contabilidade'),
  ('despesa', 'Outras despesas');
