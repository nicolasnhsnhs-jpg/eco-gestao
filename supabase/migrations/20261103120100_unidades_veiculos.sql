-- =============================================================================
-- Ordens de Serviço (OS-1): unidades com CNPJ, veículos e regras do operador
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Unidade = endereço do cliente. Cada unidade pode ter CNPJ próprio; vazio usa o
-- do cliente. O mesmo CNPJ pode se repetir em várias unidades (ex.: dois depósitos
-- da mesma empresa na mesma cidade), então não há regra de "CNPJ único".
-- -----------------------------------------------------------------------------

alter table public.enderecos
  add column cnpj               text check (cnpj is null or privado.cnpj_valido(cnpj)),
  add column razao_social       text,
  add column inscricao_estadual text;

-- Contato de uma unidade específica. Vazio = vale para todas as unidades.
alter table public.contatos_cliente
  add column endereco_id uuid references public.enderecos (id) on delete set null;

create index contatos_endereco_idx on public.contatos_cliente (endereco_id);

create function privado.antes_salvar_contato()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.endereco_id is not null and not exists (
    select 1 from public.enderecos e where e.id = new.endereco_id and e.cliente_id = new.cliente_id
  ) then
    raise exception 'A unidade escolhida não é deste cliente.' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger antes_salvar_unidade before insert or update on public.contatos_cliente
  for each row execute function privado.antes_salvar_contato();

-- -----------------------------------------------------------------------------
-- O operador não faz parte da equipe comercial: não pode ser vendedor de um
-- cliente nem de uma proposta. O nome da coluna vem como argumento do gatilho.
-- -----------------------------------------------------------------------------

create function privado.vendedor_nao_operador()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_vendedor uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
begin
  if exists (select 1 from public.perfis p where p.id = v_vendedor and p.papel = 'operador') then
    raise exception 'Um operador não pode ser o vendedor responsável.' using errcode = '23514';
  end if;
  return new;
end
$$;

revoke execute on function privado.vendedor_nao_operador() from public, authenticated;

create trigger vendedor_nao_operador before insert or update of vendedor_responsavel_id
  on public.clientes
  for each row execute function privado.vendedor_nao_operador('vendedor_responsavel_id');
create trigger vendedor_nao_operador before insert or update of vendedor_id
  on public.propostas
  for each row execute function privado.vendedor_nao_operador('vendedor_id');

-- -----------------------------------------------------------------------------
-- Veículos da empresa
-- -----------------------------------------------------------------------------

create table public.veiculos (
  id             uuid primary key default gen_random_uuid(),
  placa          text not null unique check (placa ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  descricao      text not null check (char_length(trim(descricao)) between 2 and 80),
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references public.perfis (id),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id)
);

comment on table public.veiculos is 'Veículos usados nas ordens de serviço.';

create trigger carimbar before insert or update on public.veiculos
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.veiculos
  for each row execute function privado.registrar_auditoria();

alter table public.veiculos enable row level security;

-- Toda a equipe vê (o operador escolhe o veículo na OS); só Admin e Financeiro cadastram.
create policy "equipe vê veículos" on public.veiculos for select to authenticated
  using (privado.meu_papel() is not null);
create policy "acesso total cadastra veículos" on public.veiculos for insert to authenticated
  with check (privado.tem_acesso_total());
create policy "acesso total altera veículos" on public.veiculos for update to authenticated
  using (privado.tem_acesso_total())
  with check (privado.tem_acesso_total());

revoke all on public.veiculos from anon, authenticated;
grant select, insert, update on public.veiculos to authenticated;
grant all on public.veiculos to service_role;

-- -----------------------------------------------------------------------------
-- Qual formulário de OS cada tipo de serviço usa. Um tipo novo e simples
-- (ex.: hidrojateamento) só precisa ser cadastrado como "generico".
-- -----------------------------------------------------------------------------

create type public.formulario_os as enum ('generico', 'pragas', 'coifa');

alter table public.tipos_servico
  add column formulario_os public.formulario_os not null default 'generico';

update public.tipos_servico set formulario_os = 'pragas' where nome = 'Controle de pragas';
update public.tipos_servico set formulario_os = 'coifa' where nome = 'Limpeza de coifa';

insert into public.tipos_servico (nome, periodicidade_meses_padrao, tipo_vencimento)
values ('Hidrojateamento', null, null)
on conflict (nome) do nothing;
