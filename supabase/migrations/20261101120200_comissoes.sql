-- =============================================================================
-- Comissões
--   - 8% (configurável; cada vendedor pode ter o seu) sobre cada parcela a receber
--     de uma venda do vendedor (serviço ou contrato). Contrato de 12 meses = 12 comissões.
--   - Conta pela competência da parcela e NÃO depende de o cliente pagar.
--   - Paga no mês seguinte: o "fechamento" junta as comissões em aberto do vendedor
--     e cria a saída no financeiro. Quando a saída é paga, as comissões ficam pagas.
-- =============================================================================

create type public.status_comissao as enum ('prevista', 'paga', 'cancelada');
create type public.status_fechamento as enum ('aberto', 'pago');

create table public.fechamentos_comissao (
  id                      uuid primary key default gen_random_uuid(),
  vendedor_id             uuid not null references public.perfis (id),
  -- Mês fechado (as comissões até este mês entram nele).
  competencia             date not null,
  valor_total             numeric(12, 2) not null default 0,
  status                  public.status_fechamento not null default 'aberto',
  lancamento_pagamento_id uuid references public.lancamentos (id),
  criado_em               timestamptz not null default now(),
  criado_por              uuid references public.perfis (id),
  atualizado_em           timestamptz not null default now(),
  atualizado_por          uuid references public.perfis (id),
  unique (vendedor_id, competencia)
);

create table public.comissoes (
  id                   uuid primary key default gen_random_uuid(),
  vendedor_id          uuid not null references public.perfis (id),
  lancamento_origem_id uuid not null unique references public.lancamentos (id),
  cliente_id           uuid references public.clientes (id),
  competencia          date not null,
  base                 numeric(12, 2) not null,
  percentual           numeric(5, 2) not null,
  valor                numeric(12, 2) not null,
  status               public.status_comissao not null default 'prevista',
  fechamento_id        uuid references public.fechamentos_comissao (id) on delete set null,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

create index comissoes_vendedor_idx on public.comissoes (vendedor_id, competencia);
create index comissoes_fechamento_idx on public.comissoes (fechamento_id);

-- -----------------------------------------------------------------------------
-- Cálculo automático: cada lançamento de entrada ligado a um serviço ou contrato
-- -----------------------------------------------------------------------------

create function privado.calcular_comissao()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_vendedor   uuid;
  v_percentual numeric;
  v_papel      public.papel;
  v_proprio    numeric;
begin
  if new.tipo <> 'entrada' then
    return null;
  end if;

  -- De quem é a venda?
  if new.servico_id is not null then
    select vendedor_id into v_vendedor from public.servicos where id = new.servico_id;
  elsif new.contrato_id is not null then
    select vendedor_id into v_vendedor from public.contratos where id = new.contrato_id;
  end if;

  if v_vendedor is not null then
    select papel, comissao_percentual into v_papel, v_proprio from public.perfis where id = v_vendedor;
    -- Vendedores recebem o % deles (ou o padrão). Outros perfis (ex.: o dono) só se tiverem % próprio.
    v_percentual := case
      when v_proprio is not null then v_proprio
      when v_papel = 'vendedor' then coalesce(privado.config('comissao_percentual_padrao')::numeric, 0)
    end;
  end if;

  -- Sem comissão (venda sem vendedor ou sem percentual) ou lançamento cancelado.
  if v_percentual is null or v_percentual = 0 or new.status = 'cancelado' then
    update public.comissoes
       set status = 'cancelada', atualizado_em = now()
     where lancamento_origem_id = new.id and status = 'prevista' and fechamento_id is null;
    return null;
  end if;

  insert into public.comissoes
    (vendedor_id, lancamento_origem_id, cliente_id, competencia, base, percentual, valor)
  values
    (v_vendedor, new.id, new.cliente_id, new.competencia, new.valor, v_percentual,
     round(new.valor * v_percentual / 100, 2))
  on conflict (lancamento_origem_id) do update
    set vendedor_id = excluded.vendedor_id,
        competencia = excluded.competencia,
        base = excluded.base,
        percentual = excluded.percentual,
        valor = excluded.valor,
        status = 'prevista',
        atualizado_em = now()
    -- Comissão já fechada ou paga não muda mais.
    where public.comissoes.fechamento_id is null and public.comissoes.status <> 'paga';

  return null;
end
$$;

revoke execute on function privado.calcular_comissao() from public, authenticated;

create trigger calcular_comissao after insert or update on public.lancamentos
  for each row execute function privado.calcular_comissao();

-- Pagamento da comissão: quando a saída do fechamento é paga (ou cancelada).
create function privado.acompanhar_pagamento_comissao()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_fechamento uuid;
begin
  select id into v_fechamento from public.fechamentos_comissao where lancamento_pagamento_id = new.id;
  if v_fechamento is null then
    return null;
  end if;

  if new.status = 'realizado' then
    update public.fechamentos_comissao set status = 'pago', atualizado_em = now() where id = v_fechamento;
    update public.comissoes set status = 'paga', atualizado_em = now() where fechamento_id = v_fechamento;
  elsif new.status = 'cancelado' then
    -- Pagamento cancelado: desfaz o fechamento; as comissões voltam a ficar em aberto.
    update public.comissoes set status = 'prevista', fechamento_id = null, atualizado_em = now()
     where fechamento_id = v_fechamento;
    delete from public.fechamentos_comissao where id = v_fechamento;
  else
    update public.fechamentos_comissao set status = 'aberto', atualizado_em = now() where id = v_fechamento;
    update public.comissoes set status = 'prevista', atualizado_em = now() where fechamento_id = v_fechamento;
  end if;
  return null;
end
$$;

revoke execute on function privado.acompanhar_pagamento_comissao() from public, authenticated;

create trigger acompanhar_pagamento_comissao after update of status on public.lancamentos
  for each row execute function privado.acompanhar_pagamento_comissao();

-- -----------------------------------------------------------------------------
-- Fechamento do mês
-- -----------------------------------------------------------------------------

-- Junta as comissões em aberto do vendedor até o mês escolhido e cria a saída
-- no financeiro (a pagar). Retorna o id do fechamento.
create function public.fechar_comissoes(
  vendedor uuid,
  mes date,
  vencimento date,
  conta uuid default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_competencia date := date_trunc('month', mes)::date;
  v_total       numeric;
  v_fechamento  uuid;
  v_lancamento  uuid;
  v_nome        text;
  v_categoria   uuid;
begin
  if not privado.tem_acesso_total() then
    raise exception 'Somente Admin e Financeiro fecham comissões.' using errcode = '42501';
  end if;

  select coalesce(sum(valor), 0) into v_total
    from public.comissoes
   where vendedor_id = vendedor and status = 'prevista' and fechamento_id is null
     and competencia <= v_competencia;
  if v_total <= 0 then
    raise exception 'Não há comissões em aberto para este vendedor até este mês.' using errcode = 'P0002';
  end if;

  select nome into v_nome from public.perfis where id = vendedor;
  select id into v_categoria from public.categorias_financeiras
   where tipo = 'despesa' and nome = 'Folha / Pró-labore';

  insert into public.fechamentos_comissao (vendedor_id, competencia, valor_total, criado_por, atualizado_por)
  values (vendedor, v_competencia, v_total, auth.uid(), auth.uid())
  returning id into v_fechamento;

  update public.comissoes
     set fechamento_id = v_fechamento, atualizado_em = now()
   where vendedor_id = vendedor and status = 'prevista' and fechamento_id is null
     and competencia <= v_competencia;

  insert into public.lancamentos
    (tipo, descricao, categoria_id, conta_bancaria_id, competencia, vencimento, valor, status)
  values
    ('saida', 'Comissão ' || v_nome || ' – ' || to_char(v_competencia, 'MM/YYYY'),
     v_categoria, conta, v_competencia, vencimento, v_total, 'pendente')
  returning id into v_lancamento;

  update public.fechamentos_comissao set lancamento_pagamento_id = v_lancamento where id = v_fechamento;
  return v_fechamento;
end
$$;

revoke execute on function public.fechar_comissoes(uuid, date, date, uuid) from public, anon;
grant execute on function public.fechar_comissoes(uuid, date, date, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Permissões: Admin/Financeiro veem tudo; o vendedor vê só as dele.
-- Ninguém grava direto: só pelos cálculos e pela função de fechamento.
-- -----------------------------------------------------------------------------

alter table public.comissoes enable row level security;
alter table public.fechamentos_comissao enable row level security;

create policy "ver comissões" on public.comissoes for select to authenticated
  using (privado.tem_acesso_total() or vendedor_id = (select auth.uid()));
create policy "ver fechamentos" on public.fechamentos_comissao for select to authenticated
  using (privado.tem_acesso_total() or vendedor_id = (select auth.uid()));

revoke all on public.comissoes, public.fechamentos_comissao from anon, authenticated;
grant select on public.comissoes, public.fechamentos_comissao to authenticated;
grant all on public.comissoes, public.fechamentos_comissao to service_role;

-- Aviso no começo do mês: fechar as comissões do mês anterior.
create function privado.gerar_avisos_comissoes()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_mes_passado date := (date_trunc('month', privado.hoje()) - interval '1 month')::date;
  v_total int;
begin
  insert into public.avisos (papel_destino, tipo, titulo, mensagem, link, chave_unica)
  select 'financeiro', 'fechar_comissoes',
         'Fechar as comissões de ' || to_char(v_mes_passado, 'MM/YYYY'),
         'Há comissões em aberto de ' || count(distinct vendedor_id) || ' vendedor(es).',
         '/financeiro/comissoes',
         'comissoes:' || to_char(v_mes_passado, 'YYYY-MM')
    from public.comissoes
   where status = 'prevista' and fechamento_id is null and competencia <= v_mes_passado
  having count(*) > 0
  on conflict (chave_unica) do nothing;
  get diagnostics v_total = row_count;
  return v_total;
end
$$;

revoke execute on function privado.gerar_avisos_comissoes() from public;
grant execute on function privado.gerar_avisos_comissoes() to authenticated;

create or replace function public.atualizar_avisos()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_total integer := 0;
begin
  if privado.meu_papel() is null then
    return 0;
  end if;
  if privado.tem_acesso_total() then
    v_total := privado.gerar_avisos_financeiro() + privado.gerar_avisos_comissoes();
  end if;
  return v_total + privado.gerar_avisos_propostas() + privado.gerar_avisos_servicos();
end
$$;

select cron.schedule(
  'gerar-avisos-comissoes',
  '15 9 * * *',
  $$select privado.gerar_avisos_comissoes()$$
);
