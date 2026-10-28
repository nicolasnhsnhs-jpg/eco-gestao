-- =============================================================================
-- Contratos recorrentes: mensalidade fixa cobrada no n-ésimo dia útil do mês.
-- O banco cria sozinho a conta a receber de cada mês (do mês atual e do próximo).
-- =============================================================================

create type public.status_contrato as enum ('ativo', 'suspenso', 'encerrado');

create table public.contratos (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.clientes (id),
  endereco_id       uuid references public.enderecos (id) on delete set null,
  vendedor_id       uuid references public.perfis (id),
  proposta_id       uuid references public.propostas (id) on delete set null,
  descricao         text not null check (char_length(trim(descricao)) between 2 and 200),
  valor_mensal      numeric(12, 2) not null check (valor_mensal > 0),
  -- Vazio = usa a configuração geral (hoje: 1º dia útil).
  dia_util_cobranca smallint check (dia_util_cobranca between 1 and 20),
  categoria_id      uuid not null references public.categorias_financeiras (id),
  conta_bancaria_id uuid references public.contas_bancarias (id),
  forma_pagamento   public.forma_pagamento,
  data_inicio       date not null,
  data_fim          date,
  status            public.status_contrato not null default 'ativo',
  observacoes       text,
  criado_em         timestamptz not null default now(),
  criado_por        uuid references public.perfis (id),
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid references public.perfis (id),

  constraint fim_depois_do_inicio check (data_fim is null or data_fim >= data_inicio)
);

create index contratos_cliente_idx on public.contratos (cliente_id);
create index contratos_status_idx on public.contratos (status);

-- Cada mensalidade gerada aponta para o contrato; uma por mês, nunca repetida
-- (nem se a de um mês for cancelada: aí ela simplesmente não é recriada).
alter table public.lancamentos add column contrato_id uuid references public.contratos (id);
create unique index lancamentos_uma_por_mes_contrato
  on public.lancamentos (contrato_id, competencia) where contrato_id is not null;

-- A view precisa ser recriada para mostrar a coluna nova.
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

create function privado.antes_salvar_contrato()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.endereco_id is not null and not exists (
    select 1 from public.enderecos e where e.id = new.endereco_id and e.cliente_id = new.cliente_id
  ) then
    raise exception 'O endereço escolhido não é deste cliente.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.categorias_financeiras c where c.id = new.categoria_id and c.tipo = 'receita'
  ) then
    raise exception 'A categoria do contrato precisa ser de receita.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and new.vendedor_id is null then
    select vendedor_responsavel_id into new.vendedor_id from public.clientes where id = new.cliente_id;
  end if;
  return new;
end
$$;

revoke execute on function privado.antes_salvar_contrato() from public, authenticated;

create trigger carimbar before insert or update on public.contratos
  for each row execute function privado.carimbar();
create trigger antes_salvar before insert or update on public.contratos
  for each row execute function privado.antes_salvar_contrato();
create trigger auditoria after insert or update or delete on public.contratos
  for each row execute function privado.registrar_auditoria();

-- Permissões: como os serviços (Admin/Financeiro: tudo; vendedor: clientes dele).
alter table public.contratos enable row level security;
create policy "ver contratos" on public.contratos for select to authenticated
  using (privado.pode_ver_servico_linha(cliente_id));
create policy "cadastrar contratos" on public.contratos for insert to authenticated
  with check (privado.pode_ver_servico_linha(cliente_id));
create policy "alterar contratos" on public.contratos for update to authenticated
  using (privado.pode_ver_servico_linha(cliente_id))
  with check (privado.pode_ver_servico_linha(cliente_id));

revoke all on public.contratos from anon, authenticated;
grant select, insert, update on public.contratos to authenticated;
grant all on public.contratos to service_role;

-- -----------------------------------------------------------------------------
-- Geração das mensalidades
-- -----------------------------------------------------------------------------

-- Cria as contas a receber de um mês para todos os contratos ativos naquele mês.
-- Pode rodar quantas vezes quiser: o que já existe não é duplicado.
create function privado.gerar_cobrancas_contratos(p_mes date)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_inicio date := date_trunc('month', p_mes)::date;
  v_fim    date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
  v_padrao int  := coalesce(privado.config('contrato_dia_util_cobranca')::int, 1);
  v_total  int;
begin
  insert into public.lancamentos
    (tipo, descricao, cliente_id, categoria_id, conta_bancaria_id, forma_pagamento,
     competencia, vencimento, valor, status, contrato_id)
  select
    'entrada',
    k.descricao || ' – ' || to_char(v_inicio, 'MM/YYYY'),
    k.cliente_id,
    k.categoria_id,
    k.conta_bancaria_id,
    k.forma_pagamento,
    v_inicio,
    public.dia_util(extract(year from v_inicio)::int, extract(month from v_inicio)::int,
                    coalesce(k.dia_util_cobranca, v_padrao)),
    k.valor_mensal,
    'pendente',
    k.id
  from public.contratos k
  where k.status = 'ativo'
    and k.data_inicio <= v_fim
    and (k.data_fim is null or k.data_fim >= v_inicio)
  on conflict (contrato_id, competencia) where contrato_id is not null do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end
$$;

revoke execute on function privado.gerar_cobrancas_contratos(date) from public;
grant execute on function privado.gerar_cobrancas_contratos(date) to authenticated;

-- Botão "Gerar cobranças agora" (só Admin/Financeiro): mês atual e o próximo.
create function public.gerar_cobrancas_contratos()
returns integer
language plpgsql
set search_path = ''
as $$
begin
  if not privado.tem_acesso_total() then
    raise exception 'Somente Admin e Financeiro geram cobranças.' using errcode = '42501';
  end if;
  return privado.gerar_cobrancas_contratos(privado.hoje())
       + privado.gerar_cobrancas_contratos((privado.hoje() + interval '1 month')::date);
end
$$;

revoke execute on function public.gerar_cobrancas_contratos() from public, anon;
grant execute on function public.gerar_cobrancas_contratos() to authenticated;

-- Contrato alterado: ajusta as mensalidades futuras ainda em aberto.
--   - suspenso/encerrado, ou com data de fim: cancela as que ficaram de fora;
--   - novo valor mensal: atualiza o valor das que ainda não venceram.
create function privado.ajustar_cobrancas_contrato()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_mes_atual date := date_trunc('month', privado.hoje())::date;
begin
  update public.lancamentos l
     set status = 'cancelado',
         observacoes = concat_ws(' ', l.observacoes, '(cancelada: contrato ' || new.status || ')')
   where l.contrato_id = new.id
     and l.status = 'pendente'
     and l.competencia >= v_mes_atual
     and (new.status <> 'ativo' or (new.data_fim is not null and l.competencia > new.data_fim));

  if new.valor_mensal is distinct from old.valor_mensal then
    update public.lancamentos l
       set valor = new.valor_mensal
     where l.contrato_id = new.id
       and l.status = 'pendente'
       and l.vencimento >= privado.hoje();
  end if;
  return null;
end
$$;

revoke execute on function privado.ajustar_cobrancas_contrato() from public, authenticated;

create trigger ajustar_cobrancas after update on public.contratos
  for each row execute function privado.ajustar_cobrancas_contrato();

-- Todo dia às 5h50 (antes dos avisos das 6h): garante as mensalidades do mês e do próximo,
-- para que apareçam no "a receber" com antecedência.
select cron.schedule(
  'gerar-cobrancas-contratos',
  '50 8 * * *',
  $$select privado.gerar_cobrancas_contratos(privado.hoje());
    select privado.gerar_cobrancas_contratos((privado.hoje() + interval '1 month')::date)$$
);
