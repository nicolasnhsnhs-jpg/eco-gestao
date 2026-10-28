-- =============================================================================
-- Serviços realizados e vencimentos ("quando volta")
-- =============================================================================

create type public.status_servico as enum ('agendado', 'realizado', 'cancelado');

create table public.servicos (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null references public.clientes (id),
  endereco_id         uuid references public.enderecos (id) on delete set null,
  tipo_servico_id     uuid not null references public.tipos_servico (id),
  -- Vendedor no momento do serviço (base da comissão na Fase 5).
  vendedor_id         uuid references public.perfis (id),
  proposta_id         uuid references public.propostas (id) on delete set null,
  data_execucao       date not null,
  status              public.status_servico not null default 'agendado',
  valor               numeric(12, 2) check (valor >= 0),
  -- Periodicidade combinada com o cliente (vazio = a padrão do tipo de serviço).
  periodicidade_meses smallint check (periodicidade_meses between 1 and 60),
  numero_certificado  text,
  tecnicos            text,
  observacoes         text,
  criado_em           timestamptz not null default now(),
  criado_por          uuid references public.perfis (id),
  atualizado_em       timestamptz not null default now(),
  atualizado_por      uuid references public.perfis (id)
);

create index servicos_cliente_idx on public.servicos (cliente_id, data_execucao desc);
create index servicos_data_idx on public.servicos (data_execucao, status);
create index servicos_proposta_idx on public.servicos (proposta_id);

-- Um registro por cliente + endereço + tipo de serviço: "a coifa da Loja Centro vence em…".
create table public.vencimentos_servico (
  id                      uuid primary key default gen_random_uuid(),
  cliente_id              uuid not null references public.clientes (id) on delete cascade,
  endereco_id             uuid references public.enderecos (id) on delete cascade,
  tipo_servico_id         uuid not null references public.tipos_servico (id),
  periodicidade_meses     smallint not null check (periodicidade_meses between 1 and 60),
  antecedencia_aviso_dias smallint not null default 30 check (antecedencia_aviso_dias between 0 and 180),
  ultimo_servico_id       uuid references public.servicos (id) on delete set null,
  data_ultimo_servico     date,
  -- Calculada pelo banco: data do último serviço + periodicidade.
  proxima_data            date generated always as (
    (data_ultimo_servico + make_interval(months => periodicidade_meses::int))::date
  ) stored,
  ativo                   boolean not null default true,
  criado_em               timestamptz not null default now(),
  criado_por              uuid references public.perfis (id),
  atualizado_em           timestamptz not null default now(),
  atualizado_por          uuid references public.perfis (id),

  -- "nulls not distinct": cliente sem endereço também tem um único vencimento por tipo.
  constraint um_vencimento_por_local unique nulls not distinct (cliente_id, endereco_id, tipo_servico_id)
);

create index vencimentos_proxima_idx on public.vencimentos_servico (proxima_data) where ativo;

-- Ligações com o que já existe
alter table public.lancamentos add column servico_id uuid references public.servicos (id);
create index lancamentos_servico_idx on public.lancamentos (servico_id);

alter table public.arquivos add column servico_id uuid references public.servicos (id) on delete cascade;
create index arquivos_servico_idx on public.arquivos (servico_id);
alter table public.arquivos drop constraint no_maximo_um_vinculo;
alter table public.arquivos add constraint no_maximo_um_vinculo
  check (num_nonnulls(proposta_id, lancamento_id, servico_id) <= 1);

alter table public.avisos
  add column servico_id uuid references public.servicos (id) on delete cascade,
  add column vencimento_id uuid references public.vencimentos_servico (id) on delete cascade;

-- -----------------------------------------------------------------------------
-- Regras automáticas
-- -----------------------------------------------------------------------------

create function privado.antes_salvar_servico()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.endereco_id is not null and not exists (
    select 1 from public.enderecos e where e.id = new.endereco_id and e.cliente_id = new.cliente_id
  ) then
    raise exception 'O endereço escolhido não é deste cliente.' using errcode = '23514';
  end if;
  if new.proposta_id is not null and not exists (
    select 1 from public.propostas p where p.id = new.proposta_id and p.cliente_id = new.cliente_id
  ) then
    raise exception 'A proposta não é deste cliente.' using errcode = '23514';
  end if;
  -- Sem vendedor informado: o responsável pelo cliente naquele momento.
  if tg_op = 'INSERT' and new.vendedor_id is null then
    select vendedor_responsavel_id into new.vendedor_id
      from public.clientes where id = new.cliente_id;
  end if;
  return new;
end
$$;

-- Recalcula o vencimento de um local a partir do serviço realizado mais recente.
-- "security definer": ninguém grava vencimentos diretamente, só por aqui.
create function privado.recalcular_vencimento(p_cliente uuid, p_endereco uuid, p_tipo uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tipo   public.tipos_servico;
  v_ultimo public.servicos;
begin
  select * into v_tipo from public.tipos_servico where id = p_tipo;
  -- Serviço sem repetição (ex.: desentupimento): não gera vencimento.
  if v_tipo.periodicidade_meses_padrao is null then
    return;
  end if;

  select * into v_ultimo
    from public.servicos s
   where s.cliente_id = p_cliente
     and s.endereco_id is not distinct from p_endereco
     and s.tipo_servico_id = p_tipo
     and s.status = 'realizado'
   order by s.data_execucao desc, s.criado_em desc
   limit 1;

  if v_ultimo.id is null then
    -- Nenhum serviço realizado (ex.: o único foi cancelado): mantém a configuração, sem data.
    update public.vencimentos_servico
       set ultimo_servico_id = null, data_ultimo_servico = null
     where cliente_id = p_cliente and endereco_id is not distinct from p_endereco
       and tipo_servico_id = p_tipo;
    return;
  end if;

  insert into public.vencimentos_servico
    (cliente_id, endereco_id, tipo_servico_id, periodicidade_meses, antecedencia_aviso_dias,
     ultimo_servico_id, data_ultimo_servico)
  values
    (p_cliente, p_endereco, p_tipo,
     coalesce(v_ultimo.periodicidade_meses, v_tipo.periodicidade_meses_padrao),
     v_tipo.antecedencia_aviso_dias_padrao, v_ultimo.id, v_ultimo.data_execucao)
  on conflict (cliente_id, endereco_id, tipo_servico_id) do update
    set ultimo_servico_id = excluded.ultimo_servico_id,
        data_ultimo_servico = excluded.data_ultimo_servico,
        -- Periodicidade combinada no serviço mais recente prevalece; senão, mantém a do cliente.
        periodicidade_meses = coalesce(v_ultimo.periodicidade_meses,
                                       public.vencimentos_servico.periodicidade_meses),
        ativo = true;
end
$$;

create function privado.depois_salvar_servico()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform privado.recalcular_vencimento(old.cliente_id, old.endereco_id, old.tipo_servico_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform privado.recalcular_vencimento(new.cliente_id, new.endereco_id, new.tipo_servico_id);
  end if;
  return null;
end
$$;

revoke execute on function privado.recalcular_vencimento(uuid, uuid, uuid),
  privado.depois_salvar_servico() from public, authenticated;

create trigger carimbar before insert or update on public.servicos
  for each row execute function privado.carimbar();
create trigger antes_salvar before insert or update on public.servicos
  for each row execute function privado.antes_salvar_servico();
create trigger depois_salvar after insert or update or delete on public.servicos
  for each row execute function privado.depois_salvar_servico();
create trigger auditoria after insert or update or delete on public.servicos
  for each row execute function privado.registrar_auditoria();

create trigger carimbar before insert or update on public.vencimentos_servico
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.vencimentos_servico
  for each row execute function privado.registrar_auditoria();

-- -----------------------------------------------------------------------------
-- Permissões
--   Admin/Financeiro: tudo. Vendedor: serviços e vencimentos dos clientes dele.
--   Recepção: por enquanto não acessa (o serviço tem valor); na Fase 6 ganha
--   uma consulta sem valores.
-- -----------------------------------------------------------------------------

alter table public.servicos enable row level security;
alter table public.vencimentos_servico enable row level security;

create function privado.pode_ver_servico_linha(cliente_id uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select privado.tem_acesso_total()
      or (privado.meu_papel() = 'vendedor' and privado.pode_ver_cliente(cliente_id))
$$;

create function privado.pode_ver_servico(servico uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from public.servicos s where s.id = servico)
$$;

grant execute on function privado.pode_ver_servico_linha(uuid), privado.pode_ver_servico(uuid)
  to authenticated;

create policy "ver serviços" on public.servicos for select to authenticated
  using (privado.pode_ver_servico_linha(cliente_id));
create policy "registrar serviços" on public.servicos for insert to authenticated
  with check (privado.pode_ver_servico_linha(cliente_id));
create policy "alterar serviços" on public.servicos for update to authenticated
  using (privado.pode_ver_servico_linha(cliente_id))
  with check (privado.pode_ver_servico_linha(cliente_id));
-- Sem DELETE: serviço errado é cancelado.

create policy "ver vencimentos" on public.vencimentos_servico for select to authenticated
  using (privado.pode_ver_servico_linha(cliente_id));
-- Ajustar periodicidade/antecedência/ativo; criar e apagar só pelo banco.
create policy "ajustar vencimentos" on public.vencimentos_servico for update to authenticated
  using (privado.pode_ver_servico_linha(cliente_id))
  with check (privado.pode_ver_servico_linha(cliente_id));

revoke all on public.servicos, public.vencimentos_servico from anon, authenticated;
grant select, insert, update on public.servicos to authenticated;
grant select on public.vencimentos_servico to authenticated;
grant update (periodicidade_meses, antecedencia_aviso_dias, ativo) on public.vencimentos_servico
  to authenticated;
grant all on public.servicos, public.vencimentos_servico to service_role;

-- Arquivos do serviço seguem a regra dos serviços.
create function privado.pode_ver_arquivo_servico(servico_id uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select servico_id is null or privado.pode_ver_servico(servico_id)
$$;

grant execute on function privado.pode_ver_arquivo_servico(uuid) to authenticated;

drop policy "ver arquivos" on public.arquivos;
drop policy "enviar arquivos" on public.arquivos;
drop policy "apagar arquivos" on public.arquivos;
drop policy "descrever arquivos" on public.arquivos;

create policy "ver arquivos" on public.arquivos for select to authenticated
  using (privado.pode_ver_arquivo(cliente_id, proposta_id, lancamento_id)
         and privado.pode_ver_arquivo_servico(servico_id));
create policy "enviar arquivos" on public.arquivos for insert to authenticated
  with check (privado.pode_ver_arquivo(cliente_id, proposta_id, lancamento_id)
              and privado.pode_ver_arquivo_servico(servico_id));
create policy "apagar arquivos" on public.arquivos for delete to authenticated
  using (
    privado.pode_ver_arquivo(cliente_id, proposta_id, lancamento_id)
    and privado.pode_ver_arquivo_servico(servico_id)
    and (enviado_por = (select auth.uid()) or privado.tem_acesso_total())
  );
create policy "descrever arquivos" on public.arquivos for update to authenticated
  using (privado.pode_ver_arquivo(cliente_id, proposta_id, lancamento_id)
         and privado.pode_ver_arquivo_servico(servico_id))
  with check (privado.pode_ver_arquivo(cliente_id, proposta_id, lancamento_id)
              and privado.pode_ver_arquivo_servico(servico_id));

-- O arquivo do serviço é do mesmo cliente do serviço.
create or replace function privado.antes_salvar_arquivo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.enviado_por := auth.uid();
  new.criado_em := now();
  if new.proposta_id is not null and not exists (
    select 1 from public.propostas p where p.id = new.proposta_id and p.cliente_id = new.cliente_id
  ) then
    raise exception 'A proposta não é deste cliente.' using errcode = '23514';
  end if;
  if new.servico_id is not null and not exists (
    select 1 from public.servicos s where s.id = new.servico_id and s.cliente_id = new.cliente_id
  ) then
    raise exception 'O serviço não é deste cliente.' using errcode = '23514';
  end if;
  return new;
end
$$;

-- -----------------------------------------------------------------------------
-- Consultas prontas
-- -----------------------------------------------------------------------------

-- Vencimentos com a situação calculada: em dia, perto de vencer ("avisar"), vencido.
create view public.v_vencimentos
with (security_invoker = true)
as
select
  v.*,
  v.proxima_data - privado.hoje() as dias_para_vencer,
  case
    when not v.ativo then 'desativado'
    when v.proxima_data is null then 'sem_data'
    when v.proxima_data < privado.hoje() then 'vencido'
    when v.proxima_data - v.antecedencia_aviso_dias <= privado.hoje() then 'vencendo'
    else 'em_dia'
  end as situacao
from public.vencimentos_servico v;

revoke all on public.v_vencimentos from anon;
grant select on public.v_vencimentos to authenticated;
