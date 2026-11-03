-- =============================================================================
-- Contas fixas (lançamentos recorrentes): aluguel, internet, mensalidades…
-- Cadastra-se uma vez, com o dia do vencimento; o banco cria sozinho o lançamento
-- pendente de cada mês (do mês atual e do próximo). No dia, é só confirmar.
-- =============================================================================

create table public.lancamentos_recorrentes (
  id                uuid primary key default gen_random_uuid(),
  tipo              public.tipo_lancamento not null,
  descricao         text not null check (char_length(trim(descricao)) between 2 and 280),
  cliente_id        uuid references public.clientes (id),
  fornecedor_id     uuid references public.fornecedores (id),
  categoria_id      uuid not null references public.categorias_financeiras (id),
  conta_bancaria_id uuid references public.contas_bancarias (id),
  forma_pagamento   public.forma_pagamento,
  valor             numeric(12, 2) not null check (valor > 0),
  -- Dia do mês em que vence. 29, 30 ou 31: nos meses mais curtos, vence no último dia.
  dia_vencimento    smallint not null check (dia_vencimento between 1 and 31),
  -- Primeiro vencimento: os meses anteriores a ele não são lançados.
  data_inicio       date not null,
  ativo             boolean not null default true,
  observacoes       text,
  criado_em         timestamptz not null default now(),
  criado_por        uuid references public.perfis (id),
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid references public.perfis (id),

  constraint cliente_ou_fornecedor check (cliente_id is null or fornecedor_id is null)
);

-- Cada lançamento gerado aponta para a conta fixa; um por mês, nunca repetido
-- (nem se o de um mês for cancelado: aí ele simplesmente não é recriado).
alter table public.lancamentos
  add column recorrente_id uuid references public.lancamentos_recorrentes (id);
create unique index lancamentos_uma_por_mes_recorrente
  on public.lancamentos (recorrente_id, competencia) where recorrente_id is not null;

-- v_lancamentos foi criada com "l.*": recriada para mostrar a coluna nova.
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

-- -----------------------------------------------------------------------------
-- Regras
-- -----------------------------------------------------------------------------

create function privado.antes_salvar_recorrente()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo_categoria public.tipo_categoria;
begin
  if tg_op = 'UPDATE' and new.tipo <> old.tipo then
    raise exception 'Uma conta fixa não muda de “a receber” para “a pagar”. Encerre e cadastre outra.'
      using errcode = '23514';
  end if;

  -- Conferido aqui para não travar a geração automática de todos os meses depois.
  select tipo into v_tipo_categoria from public.categorias_financeiras where id = new.categoria_id;
  if (new.tipo = 'entrada') <> (v_tipo_categoria = 'receita') then
    raise exception 'A categoria escolhida não combina com o tipo do lançamento (entrada/saída).'
      using errcode = '23514';
  end if;

  if new.tipo = 'entrada' then new.fornecedor_id := null; else new.cliente_id := null; end if;
  return new;
end
$$;

-- Vencimento da conta fixa num mês: o dia escolhido ou, se o mês for curto, o último dia.
create function privado.vencimento_recorrente(p_mes date, p_dia smallint)
returns date
language sql immutable
set search_path = ''
as $$
  select least(
    date_trunc('month', p_mes)::date + (p_dia - 1),
    (date_trunc('month', p_mes) + interval '1 month - 1 day')::date
  )
$$;

-- Cria os lançamentos de um mês para as contas fixas ativas (todas, ou só uma).
-- Pode rodar quantas vezes quiser: o que já existe não é duplicado.
create function privado.gerar_lancamentos_recorrentes(p_mes date, p_recorrente uuid default null)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_inicio date := date_trunc('month', p_mes)::date;
  v_total  int;
begin
  insert into public.lancamentos
    (tipo, descricao, cliente_id, fornecedor_id, categoria_id, conta_bancaria_id, forma_pagamento,
     competencia, vencimento, valor, status, observacoes, recorrente_id)
  select
    r.tipo,
    r.descricao || ' – ' || to_char(v_inicio, 'MM/YYYY'),
    r.cliente_id,
    r.fornecedor_id,
    r.categoria_id,
    r.conta_bancaria_id,
    r.forma_pagamento,
    v_inicio,
    privado.vencimento_recorrente(v_inicio, r.dia_vencimento),
    r.valor,
    'pendente',
    r.observacoes,
    r.id
  from public.lancamentos_recorrentes r
  where r.ativo
    and (p_recorrente is null or r.id = p_recorrente)
    and date_trunc('month', r.data_inicio) <= v_inicio
  on conflict (recorrente_id, competencia) where recorrente_id is not null do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end
$$;

revoke execute on function privado.gerar_lancamentos_recorrentes(date, uuid) from public, authenticated;

-- Conta fixa cadastrada ou alterada:
--   - encerrada: cancela as dos próximos meses ainda em aberto (a do mês atual fica);
--   - valor, dia, categoria… mudaram: atualiza as em aberto que ainda não venceram;
--   - ativa: garante os lançamentos desde o primeiro vencimento até o mês que vem.
create function privado.depois_salvar_recorrente()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_hoje      date := privado.hoje();
  v_mes_atual date := date_trunc('month', privado.hoje())::date;
  v_mes       date;
begin
  if tg_op = 'UPDATE' then
    if not new.ativo then
      update public.lancamentos l
         set status = 'cancelado',
             observacoes = concat_ws(' ', l.observacoes, '(cancelado: conta fixa encerrada)')
       where l.recorrente_id = new.id
         and l.status in ('pendente', 'agendado')
         and l.competencia > v_mes_atual;
    else
      update public.lancamentos l
         set descricao = case when new.descricao is distinct from old.descricao
                              then new.descricao || ' – ' || to_char(l.competencia, 'MM/YYYY')
                              else l.descricao end,
             valor = case when new.valor is distinct from old.valor
                          then new.valor else l.valor end,
             vencimento = case when new.dia_vencimento is distinct from old.dia_vencimento
                               then privado.vencimento_recorrente(l.competencia, new.dia_vencimento)
                               else l.vencimento end,
             categoria_id = case when new.categoria_id is distinct from old.categoria_id
                                 then new.categoria_id else l.categoria_id end,
             conta_bancaria_id = case when new.conta_bancaria_id is distinct from old.conta_bancaria_id
                                      then new.conta_bancaria_id else l.conta_bancaria_id end,
             forma_pagamento = case when new.forma_pagamento is distinct from old.forma_pagamento
                                    then new.forma_pagamento else l.forma_pagamento end,
             cliente_id = case when new.cliente_id is distinct from old.cliente_id
                               then new.cliente_id else l.cliente_id end,
             fornecedor_id = case when new.fornecedor_id is distinct from old.fornecedor_id
                                  then new.fornecedor_id else l.fornecedor_id end
       where l.recorrente_id = new.id
         and l.status in ('pendente', 'agendado')
         and l.vencimento >= v_hoje;
    end if;
  end if;

  if new.ativo then
    -- Primeiro vencimento no passado: lança a partir dele (no máximo um ano para trás).
    v_mes := greatest(date_trunc('month', new.data_inicio)::date,
                      (v_mes_atual - interval '12 months')::date);
    while v_mes <= (v_mes_atual + interval '1 month')::date loop
      perform privado.gerar_lancamentos_recorrentes(v_mes, new.id);
      v_mes := (v_mes + interval '1 month')::date;
    end loop;
  end if;
  return null;
end
$$;

revoke execute on function privado.antes_salvar_recorrente() from public, authenticated;
revoke execute on function privado.depois_salvar_recorrente() from public, authenticated;

create trigger carimbar before insert or update on public.lancamentos_recorrentes
  for each row execute function privado.carimbar();
create trigger antes_salvar before insert or update on public.lancamentos_recorrentes
  for each row execute function privado.antes_salvar_recorrente();
create trigger depois_salvar after insert or update on public.lancamentos_recorrentes
  for each row execute function privado.depois_salvar_recorrente();
create trigger auditoria after insert or update or delete on public.lancamentos_recorrentes
  for each row execute function privado.registrar_auditoria();

-- -----------------------------------------------------------------------------
-- Permissões: como os lançamentos (só Admin e Financeiro). Nada é apagado: encerra-se.
-- -----------------------------------------------------------------------------

alter table public.lancamentos_recorrentes enable row level security;

create policy "financeiro vê contas fixas" on public.lancamentos_recorrentes
  for select to authenticated using (privado.tem_acesso_total());
create policy "financeiro cadastra contas fixas" on public.lancamentos_recorrentes
  for insert to authenticated with check (privado.tem_acesso_total());
create policy "financeiro altera contas fixas" on public.lancamentos_recorrentes
  for update to authenticated
  using (privado.tem_acesso_total()) with check (privado.tem_acesso_total());

revoke all on public.lancamentos_recorrentes from anon, authenticated;
grant select, insert, update on public.lancamentos_recorrentes to authenticated;
grant all on public.lancamentos_recorrentes to service_role;

-- Todo dia às 5h52 (antes dos avisos das 6h): garante os lançamentos do mês e do próximo.
select cron.schedule(
  'gerar-lancamentos-recorrentes',
  '52 8 * * *',
  $$select privado.gerar_lancamentos_recorrentes(privado.hoje());
    select privado.gerar_lancamentos_recorrentes((privado.hoje() + interval '1 month')::date)$$
);
