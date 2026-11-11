-- =============================================================================
-- Links de cadastro: o admin gera um link para um perfil (ex.: operadores), manda no
-- grupo da empresa, e cada pessoa cria o próprio login (nome, e-mail e senha). A conta
-- nasce bloqueada e só entra no sistema depois que o admin aprova a solicitação.
--
-- Quem cria a conta é a Edge Function "usuarios" (com a chave secreta), depois de
-- conferir o link. O navegador nunca grava direto nestas tabelas sem ser admin.
-- =============================================================================

create table public.links_cadastro (
  id         uuid primary key default gen_random_uuid(),
  -- O que vai no endereço. Aleatório e comprido, para ninguém adivinhar.
  codigo     text not null unique default replace(gen_random_uuid()::text, '-', ''),
  papel      public.papel not null check (papel <> 'admin'),
  expira_em  timestamptz not null,
  revogado   boolean not null default false,
  criado_em  timestamptz not null default now(),
  criado_por uuid references public.perfis (id) default auth.uid()
);

comment on table public.links_cadastro is
  'Links que o admin manda para a equipe se cadastrar. A conta só entra depois de aprovada.';

alter table public.links_cadastro enable row level security;

create policy "só o admin vê os links de cadastro"
  on public.links_cadastro for select to authenticated
  using (privado.e_admin());

create policy "só o admin cria links de cadastro"
  on public.links_cadastro for insert to authenticated
  with check (privado.e_admin());

create policy "só o admin revoga links de cadastro"
  on public.links_cadastro for update to authenticated
  using (privado.e_admin())
  with check (privado.e_admin());

revoke all on public.links_cadastro from anon, authenticated;
grant select on public.links_cadastro to authenticated;
grant insert (papel, expira_em) on public.links_cadastro to authenticated;
grant update (revogado) on public.links_cadastro to authenticated;
grant all on public.links_cadastro to service_role;

-- Quem se cadastrou pelo link e ainda espera a aprovação do admin (fica com ativo = false).
alter table public.perfis
  add column aguardando_aprovacao boolean not null default false,
  add column link_cadastro_id uuid references public.links_cadastro (id) on delete set null;

comment on column public.perfis.aguardando_aprovacao is
  'Cadastrou-se por um link de cadastro e ainda não foi aprovado pelo administrador.';
