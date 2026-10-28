-- =============================================================================
-- Base do sistema: extensões, perfis de acesso e funções de apoio às permissões
-- =============================================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Esquema "privado": funções internas. Ele não é exposto pela API do Supabase,
-- então ninguém consegue chamar essas funções diretamente pelo navegador.
create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated;

-- -----------------------------------------------------------------------------
-- Perfis (um por usuário do login)
-- -----------------------------------------------------------------------------

create type public.papel as enum ('admin', 'financeiro', 'vendedor', 'recepcao');

create table public.perfis (
  id                  uuid primary key references auth.users (id) on delete cascade,
  nome                text not null check (char_length(trim(nome)) between 2 and 120),
  email               text not null,
  telefone            text check (telefone ~ '^\d{10,11}$'),
  papel               public.papel not null default 'recepcao',
  comissao_percentual numeric(5, 2) check (comissao_percentual between 0 and 100),
  ativo               boolean not null default true,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  atualizado_por      uuid references public.perfis (id)
);

comment on table public.perfis is 'Usuários do sistema e seus perfis de acesso.';

-- -----------------------------------------------------------------------------
-- Funções usadas pelas regras de permissão (RLS)
-- "security definer" = roda com permissão do dono, para conseguir ler a tabela
-- de perfis sem cair na própria regra de RLS (evita um laço infinito).
-- -----------------------------------------------------------------------------

-- Papel do usuário logado. Retorna nulo se ele estiver desativado.
create function privado.meu_papel()
returns public.papel
language sql stable security definer
set search_path = ''
as $$
  select papel from public.perfis where id = (select auth.uid()) and ativo
$$;

-- Admin e Financeiro enxergam tudo.
create function privado.tem_acesso_total()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(privado.meu_papel() in ('admin', 'financeiro'), false)
$$;

create function privado.e_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(privado.meu_papel() = 'admin', false)
$$;

-- Texto em minúsculas e sem acentos, para buscas ("João" encontra "joao").
create function privado.sem_acento(texto text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, '')))
$$;

revoke execute on all functions in schema privado from public;
grant execute on all functions in schema privado to authenticated;

-- -----------------------------------------------------------------------------
-- Carimbo de criação e alteração: quem fez e quando.
-- Preenchido pelo banco, então ninguém consegue "fingir" ser outro usuário.
-- Serve para todas as tabelas que têm as colunas criado_*/atualizado_*.
-- -----------------------------------------------------------------------------

create function privado.carimbar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.criado_em := now();
    new.criado_por := auth.uid();
  else
    new.criado_em := old.criado_em;
    new.criado_por := old.criado_por;
  end if;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end
$$;

-- Perfis não têm criado_por (o próprio usuário ainda não existe na criação).
create function privado.antes_salvar_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Ninguém altera o próprio papel nem se desativa: evita ficar sem administrador.
  if new.id = auth.uid() and (new.papel <> old.papel or new.ativo <> old.ativo) then
    raise exception 'Você não pode alterar o seu próprio perfil de acesso nem se desativar.'
      using errcode = '42501';
  end if;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end
$$;

create trigger antes_salvar
  before update on public.perfis
  for each row execute function privado.antes_salvar_perfil();

-- -----------------------------------------------------------------------------
-- Ao criar um usuário no login, cria o perfil dele.
-- O primeiro usuário do sistema vira administrador; os demais recebem o papel
-- definido no convite (app_metadata, que só o servidor consegue gravar).
-- -----------------------------------------------------------------------------

create function privado.criar_perfil_novo_usuario()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_papel public.papel;
begin
  if not exists (select 1 from public.perfis) then
    v_papel := 'admin';
  else
    v_papel := coalesce((new.raw_app_meta_data ->> 'papel')::public.papel, 'recepcao');
  end if;

  insert into public.perfis (id, nome, email, papel)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    v_papel
  );
  return new;
end
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function privado.criar_perfil_novo_usuario();

-- -----------------------------------------------------------------------------
-- Permissões dos perfis
-- -----------------------------------------------------------------------------

alter table public.perfis enable row level security;

create policy "usuários ativos veem a equipe"
  on public.perfis for select to authenticated
  using (privado.meu_papel() is not null);

create policy "só o admin altera perfis"
  on public.perfis for update to authenticated
  using (privado.e_admin())
  with check (privado.e_admin());

revoke all on public.perfis from anon, authenticated;
grant select on public.perfis to authenticated;
grant update (nome, telefone, papel, comissao_percentual, ativo) on public.perfis to authenticated;

-- O servidor (Edge Functions) usa o papel service_role, que ignora o RLS.
grant all on public.perfis to service_role;
