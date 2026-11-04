-- =============================================================================
-- Notas fiscais de serviço (NFS-e) e vencimento em dia fixo nos contratos.
--
-- A nota é emitida fora do sistema (hoje no Safenota) e registrada aqui, como
-- nota de contrato (a mensalidade) ou avulsa (serviço pontual). Ela guarda o
-- valor e os impostos, para que a do mês seguinte possa ser copiada da última.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Contratos: vencimento em dia fixo do mês (ex.: todo dia 10), no mesmo mês da
-- competência ou no seguinte (nota de novembro com boleto para 10/12).
-- Vazio = continua valendo o dia útil (dia_util_cobranca ou o padrão da empresa).
-- -----------------------------------------------------------------------------

alter table public.contratos
  add column dia_vencimento     smallint check (dia_vencimento between 1 and 31),
  add column vence_mes_seguinte boolean not null default false;

-- Vencimento da mensalidade de um mês. Dia 29, 30 ou 31 em mês mais curto: último dia.
create function privado.vencimento_contrato(
  p_competencia date, p_dia_vencimento smallint, p_mes_seguinte boolean, p_dia_util smallint
)
returns date
language plpgsql stable
set search_path = ''
as $$
declare
  v_mes date;
begin
  if p_dia_vencimento is null then
    return public.dia_util(
      extract(year from p_competencia)::int, extract(month from p_competencia)::int,
      coalesce(p_dia_util, privado.config('contrato_dia_util_cobranca')::int, 1)
    );
  end if;
  v_mes := (date_trunc('month', p_competencia)
            + make_interval(months => case when p_mes_seguinte then 1 else 0 end))::date;
  return v_mes + (least(p_dia_vencimento,
                        extract(day from v_mes + interval '1 month - 1 day')::int) - 1);
end
$$;

revoke execute on function privado.vencimento_contrato(date, smallint, boolean, smallint) from public;
grant execute on function privado.vencimento_contrato(date, smallint, boolean, smallint) to authenticated;

create or replace function privado.gerar_cobrancas_contratos(p_mes date)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_inicio date := date_trunc('month', p_mes)::date;
  v_fim    date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
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
    privado.vencimento_contrato(v_inicio, k.dia_vencimento, k.vence_mes_seguinte, k.dia_util_cobranca),
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

-- Contrato alterado: além do que já fazia (cancelar as que ficaram de fora e
-- atualizar o valor), recalcula o vencimento das mensalidades em aberto quando
-- a regra de vencimento muda.
create or replace function privado.ajustar_cobrancas_contrato()
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

  if (new.dia_vencimento, new.vence_mes_seguinte, new.dia_util_cobranca)
     is distinct from (old.dia_vencimento, old.vence_mes_seguinte, old.dia_util_cobranca) then
    update public.lancamentos l
       set vencimento = privado.vencimento_contrato(
             l.competencia, new.dia_vencimento, new.vence_mes_seguinte, new.dia_util_cobranca)
     where l.contrato_id = new.id
       and l.status = 'pendente'
       and l.competencia >= v_mes_atual;
  end if;
  return null;
end
$$;

-- -----------------------------------------------------------------------------
-- Notas fiscais
-- -----------------------------------------------------------------------------

create type public.tipo_nota_fiscal as enum ('contrato', 'avulsa');
create type public.status_nota_fiscal as enum ('emitida', 'cancelada');

create table public.notas_fiscais (
  id                 uuid primary key default gen_random_uuid(),
  tipo               public.tipo_nota_fiscal not null,
  status             public.status_nota_fiscal not null default 'emitida',
  cliente_id         uuid not null references public.clientes (id),
  contrato_id        uuid references public.contratos (id),
  -- Conta a receber desta nota (a mensalidade do contrato, ou um lançamento avulso).
  lancamento_id      uuid references public.lancamentos (id) on delete set null,
  numero             text,
  numero_dps         text unique,
  chave_acesso       text unique,
  data_emissao       date not null,
  -- Mês a que o serviço pertence. Sempre o dia 1 do mês.
  competencia        date not null,
  vencimento         date,
  forma_pagamento    public.forma_pagamento,
  descricao          text not null check (char_length(trim(descricao)) between 2 and 2000),
  -- Código de tributação nacional (ex.: 071301) e NBS, como na nota.
  codigo_tributacao  text,
  codigo_nbs         text,
  valor_servico      numeric(12, 2) not null check (valor_servico > 0),
  iss_retido         boolean not null default false,
  aliquota_iss       numeric(5, 2) check (aliquota_iss >= 0),
  pis_cofins_retidos boolean not null default false,
  aliquota_pis       numeric(5, 2) check (aliquota_pis >= 0),
  aliquota_cofins    numeric(5, 2) check (aliquota_cofins >= 0),
  valor_pis          numeric(12, 2) check (valor_pis >= 0),
  valor_cofins       numeric(12, 2) check (valor_cofins >= 0),
  valor_irrf         numeric(12, 2) check (valor_irrf >= 0),
  valor_csll         numeric(12, 2) check (valor_csll >= 0),
  valor_inss         numeric(12, 2) check (valor_inss >= 0),
  -- De onde veio o registro (ex.: "Safenota"). Vazio = cadastrada à mão.
  importada_de       text,
  observacoes        text,
  criado_em          timestamptz not null default now(),
  criado_por         uuid references public.perfis (id),
  atualizado_em      timestamptz not null default now(),
  atualizado_por     uuid references public.perfis (id),

  constraint competencia_dia_1 check (extract(day from competencia) = 1),
  constraint avulsa_sem_contrato check (tipo = 'contrato' or contrato_id is null),
  -- A de contrato precisa dizer qual. Só a cancelada pode ficar sem.
  constraint contrato_informado check (tipo = 'avulsa' or status = 'cancelada' or contrato_id is not null)
);

create index notas_fiscais_cliente_idx on public.notas_fiscais (cliente_id);
create index notas_fiscais_contrato_idx on public.notas_fiscais (contrato_id, competencia desc);
create index notas_fiscais_competencia_idx on public.notas_fiscais (competencia desc);
create index notas_fiscais_lancamento_idx on public.notas_fiscais (lancamento_id);

create function privado.antes_salvar_nota_fiscal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.competencia := date_trunc('month', new.competencia)::date;
  if new.contrato_id is not null and not exists (
    select 1 from public.contratos k where k.id = new.contrato_id and k.cliente_id = new.cliente_id
  ) then
    raise exception 'O contrato escolhido não é deste cliente.' using errcode = '23514';
  end if;
  if new.lancamento_id is not null and not exists (
    select 1 from public.lancamentos l
     where l.id = new.lancamento_id and l.cliente_id = new.cliente_id and l.tipo = 'entrada'
  ) then
    raise exception 'A conta a receber escolhida não é deste cliente.' using errcode = '23514';
  end if;
  return new;
end
$$;

-- O número da nota aparece também na conta a receber ligada a ela.
create function privado.depois_salvar_nota_fiscal()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.lancamento_id is not null and new.status = 'emitida' and new.numero is not null then
    update public.lancamentos
       set numero_nota_fiscal = new.numero
     where id = new.lancamento_id
       and numero_nota_fiscal is distinct from new.numero;
  end if;
  return null;
end
$$;

revoke execute on function privado.depois_salvar_nota_fiscal() from public, authenticated;

create trigger carimbar before insert or update on public.notas_fiscais
  for each row execute function privado.carimbar();
create trigger antes_salvar before insert or update on public.notas_fiscais
  for each row execute function privado.antes_salvar_nota_fiscal();
create trigger depois_salvar after insert or update on public.notas_fiscais
  for each row execute function privado.depois_salvar_nota_fiscal();
create trigger auditoria after insert or update or delete on public.notas_fiscais
  for each row execute function privado.registrar_auditoria();

-- Permissões: como os lançamentos (só Admin e Financeiro). Nota não se apaga: cancela-se.
alter table public.notas_fiscais enable row level security;
create policy "financeiro vê notas" on public.notas_fiscais for select to authenticated
  using (privado.tem_acesso_total());
create policy "financeiro cadastra notas" on public.notas_fiscais for insert to authenticated
  with check (privado.tem_acesso_total());
create policy "financeiro altera notas" on public.notas_fiscais for update to authenticated
  using (privado.tem_acesso_total()) with check (privado.tem_acesso_total());

revoke all on public.notas_fiscais from anon, authenticated;
grant select, insert, update on public.notas_fiscais to authenticated;
grant all on public.notas_fiscais to service_role;
