-- =============================================================================
-- Propostas: catálogo de serviços, propostas com itens e numeração automática
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Catálogo de tipos de serviço (usado agora nas propostas e, na Fase 4,
-- nos serviços realizados e vencimentos)
-- -----------------------------------------------------------------------------

create type public.tipo_vencimento as enum ('certificado', 'recomendacao');

create table public.tipos_servico (
  id                             uuid primary key default gen_random_uuid(),
  nome                           text not null unique check (char_length(trim(nome)) between 2 and 80),
  -- Vazio = serviço sem repetição (ex.: desentupimento).
  periodicidade_meses_padrao     smallint check (periodicidade_meses_padrao between 1 and 60),
  antecedencia_aviso_dias_padrao smallint not null default 30 check (antecedencia_aviso_dias_padrao between 0 and 180),
  tipo_vencimento                public.tipo_vencimento,
  ativo                          boolean not null default true,
  criado_em                      timestamptz not null default now(),
  criado_por                     uuid references public.perfis (id),
  atualizado_em                  timestamptz not null default now(),
  atualizado_por                 uuid references public.perfis (id),

  constraint vencimento_coerente check (
    (periodicidade_meses_padrao is null) = (tipo_vencimento is null)
  )
);

create trigger carimbar before insert or update on public.tipos_servico
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.tipos_servico
  for each row execute function privado.registrar_auditoria();

alter table public.tipos_servico enable row level security;

-- Todos da equipe consultam o catálogo; só Admin/Financeiro alteram.
create policy "equipe vê tipos de serviço" on public.tipos_servico for select to authenticated
  using (privado.meu_papel() is not null);
create policy "acesso total cadastra tipos" on public.tipos_servico for insert to authenticated
  with check (privado.tem_acesso_total());
create policy "acesso total altera tipos" on public.tipos_servico for update to authenticated
  using (privado.tem_acesso_total()) with check (privado.tem_acesso_total());

revoke all on public.tipos_servico from anon, authenticated;
grant select, insert, update on public.tipos_servico to authenticated;
grant all on public.tipos_servico to service_role;

insert into public.tipos_servico (nome, periodicidade_meses_padrao, tipo_vencimento) values
  ('Controle de pragas',          3,    'certificado'),
  ('Limpeza de coifa',            6,    'certificado'),
  ('Limpeza de reservatórios',    6,    'certificado'),
  ('Sucção de fossa',             6,    'recomendacao'),
  ('Limpeza de caixa de gordura', 6,    'recomendacao'),
  ('Limpeza de placas solares',   6,    'recomendacao'),
  ('Desentupimento',              null, null);

-- -----------------------------------------------------------------------------
-- Numeração sequencial por ano (2026-0001, 2026-0002…)
-- -----------------------------------------------------------------------------

create table privado.contadores (
  chave text primary key,
  valor integer not null
);

-- O "on conflict … do update" trava a linha: dois cadastros ao mesmo tempo
-- nunca recebem o mesmo número.
create function privado.proximo_numero(chave_contador text)
returns integer
language sql
security definer
set search_path = ''
as $$
  insert into privado.contadores as c (chave, valor) values (chave_contador, 1)
  on conflict (chave) do update set valor = c.valor + 1
  returning valor
$$;

-- -----------------------------------------------------------------------------
-- Propostas e itens
-- -----------------------------------------------------------------------------

create type public.status_proposta as enum ('enviada', 'aprovada', 'recusada');

create table public.propostas (
  id                   uuid primary key default gen_random_uuid(),
  numero               text not null unique,
  cliente_id           uuid not null references public.clientes (id),
  endereco_id          uuid references public.enderecos (id) on delete set null,
  vendedor_id          uuid not null default auth.uid() references public.perfis (id),
  data_envio           date not null default (now() at time zone 'America/Sao_Paulo')::date,
  validade             date,
  status               public.status_proposta not null default 'enviada',
  data_resposta        date,
  -- Soma dos itens, mantida pelo banco.
  valor_total          numeric(12, 2) not null default 0,
  prazo_pagamento_dias smallint check (prazo_pagamento_dias between 0 and 365),
  condicao_pagamento   text,
  motivo_recusa        text,
  observacoes          text,
  criado_em            timestamptz not null default now(),
  criado_por           uuid references public.perfis (id),
  atualizado_em        timestamptz not null default now(),
  atualizado_por       uuid references public.perfis (id),

  constraint validade_depois_do_envio check (validade is null or validade >= data_envio)
);

create index propostas_cliente_idx on public.propostas (cliente_id, data_envio desc);
create index propostas_vendedor_idx on public.propostas (vendedor_id);
create index propostas_status_idx on public.propostas (status);

create table public.proposta_itens (
  id                  uuid primary key default gen_random_uuid(),
  proposta_id         uuid not null references public.propostas (id) on delete cascade,
  tipo_servico_id     uuid references public.tipos_servico (id),
  descricao           text not null check (char_length(trim(descricao)) between 2 and 300),
  quantidade          numeric(10, 2) not null default 1 check (quantidade > 0),
  valor_unitario      numeric(12, 2) not null check (valor_unitario >= 0),
  -- Quando a proposta combina uma periodicidade diferente da padrão do serviço.
  periodicidade_meses smallint check (periodicidade_meses between 1 and 60),
  ordem               smallint not null default 0
);

create index proposta_itens_proposta_idx on public.proposta_itens (proposta_id, ordem);

create function privado.antes_salvar_proposta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.numero := extract(year from new.data_envio)::text || '-'
      || lpad(privado.proximo_numero('proposta-' || extract(year from new.data_envio))::text, 4, '0');
    new.valor_total := 0;
  else
    new.numero := old.numero;
    -- O total só muda pelos itens.
    if current_setting('app.recalculando_proposta', true) is distinct from 'sim' then
      new.valor_total := old.valor_total;
    end if;
  end if;

  -- Data da resposta: preenchida ao aprovar/recusar; limpa ao voltar para "enviada".
  if new.status = 'enviada' then
    new.data_resposta := null;
    new.motivo_recusa := null;
  elsif tg_op = 'INSERT' then
    new.data_resposta := coalesce(new.data_resposta, privado.hoje());
  elsif new.status is distinct from old.status then
    -- Mudou a resposta (ex.: recusada → aprovada): vale a data informada ou hoje.
    new.data_resposta := case
      when new.data_resposta is distinct from old.data_resposta then new.data_resposta
      else privado.hoje()
    end;
  end if;
  if new.status <> 'recusada' then
    new.motivo_recusa := null;
  end if;

  -- O vendedor da proposta precisa ser da equipe comercial e estar ativo.
  if not exists (
    select 1 from public.perfis p
     where p.id = new.vendedor_id and p.ativo and p.papel <> 'recepcao'
  ) then
    raise exception 'O vendedor da proposta precisa ser um usuário ativo da equipe comercial.'
      using errcode = '23514';
  end if;

  if new.endereco_id is not null and not exists (
    select 1 from public.enderecos e where e.id = new.endereco_id and e.cliente_id = new.cliente_id
  ) then
    raise exception 'O endereço escolhido não é deste cliente.' using errcode = '23514';
  end if;

  return new;
end
$$;

-- Recalcula o total da proposta sempre que um item muda.
create function privado.recalcular_total_proposta()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_proposta uuid := coalesce(new.proposta_id, old.proposta_id);
begin
  perform set_config('app.recalculando_proposta', 'sim', true);
  update public.propostas p
     set valor_total = coalesce((
       select sum(round(i.quantidade * i.valor_unitario, 2))
         from public.proposta_itens i where i.proposta_id = v_proposta
     ), 0)
   where p.id = v_proposta;
  perform set_config('app.recalculando_proposta', '', true);
  return null;
end
$$;

grant execute on function privado.proximo_numero(text) to authenticated;
revoke execute on function privado.proximo_numero(text) from public;

create trigger carimbar before insert or update on public.propostas
  for each row execute function privado.carimbar();
create trigger antes_salvar before insert or update on public.propostas
  for each row execute function privado.antes_salvar_proposta();
create trigger auditoria after insert or update or delete on public.propostas
  for each row execute function privado.registrar_auditoria();

create trigger recalcular_total after insert or update or delete on public.proposta_itens
  for each row execute function privado.recalcular_total_proposta();

-- -----------------------------------------------------------------------------
-- Permissões
--   Admin e Financeiro: todas as propostas.
--   Vendedor: as próprias e as dos clientes dele.
--   Recepção: nenhuma (propostas têm valores).
-- -----------------------------------------------------------------------------

alter table public.propostas enable row level security;
alter table public.proposta_itens enable row level security;

create function privado.pode_ver_proposta_linha(vendedor_id uuid, cliente_id uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select privado.tem_acesso_total()
      or (privado.meu_papel() = 'vendedor'
          and (vendedor_id = (select auth.uid()) or privado.pode_ver_cliente(cliente_id)))
$$;

-- Para os itens e arquivos: aplica a regra da própria tabela de propostas.
create function privado.pode_ver_proposta(proposta uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from public.propostas p where p.id = proposta)
$$;

grant execute on function privado.pode_ver_proposta_linha(uuid, uuid),
  privado.pode_ver_proposta(uuid) to authenticated;

create policy "ver propostas" on public.propostas for select to authenticated
  using (privado.pode_ver_proposta_linha(vendedor_id, cliente_id));
-- O vendedor só cadastra proposta em nome dele e para cliente que ele enxerga.
create policy "cadastrar propostas" on public.propostas for insert to authenticated
  with check (
    privado.tem_acesso_total()
    or (privado.meu_papel() = 'vendedor'
        and vendedor_id = (select auth.uid())
        and privado.pode_ver_cliente(cliente_id))
  );
create policy "alterar propostas" on public.propostas for update to authenticated
  using (privado.pode_ver_proposta_linha(vendedor_id, cliente_id))
  with check (privado.pode_ver_proposta_linha(vendedor_id, cliente_id));
-- Sem DELETE: proposta fica no histórico (recusada, se for o caso).

create policy "ver itens" on public.proposta_itens for select to authenticated
  using (privado.pode_ver_proposta(proposta_id));
create policy "cadastrar itens" on public.proposta_itens for insert to authenticated
  with check (privado.pode_ver_proposta(proposta_id));
create policy "alterar itens" on public.proposta_itens for update to authenticated
  using (privado.pode_ver_proposta(proposta_id))
  with check (privado.pode_ver_proposta(proposta_id));
create policy "apagar itens" on public.proposta_itens for delete to authenticated
  using (privado.pode_ver_proposta(proposta_id));

revoke all on public.propostas, public.proposta_itens from anon, authenticated;
grant select, insert, update on public.propostas to authenticated;
grant select, insert, update, delete on public.proposta_itens to authenticated;
grant all on public.propostas, public.proposta_itens to service_role;

-- Proposta com a situação calculada: "expirada" = enviada, sem resposta, depois da validade.
create view public.v_propostas
with (security_invoker = true)
as
select
  p.*,
  case
    when p.status = 'enviada' and p.validade < privado.hoje() then 'expirada'
    else p.status::text
  end as situacao,
  case when p.status = 'enviada' then privado.hoje() - p.data_envio end as dias_sem_resposta
from public.propostas p;

revoke all on public.v_propostas from anon;
grant select on public.v_propostas to authenticated;
