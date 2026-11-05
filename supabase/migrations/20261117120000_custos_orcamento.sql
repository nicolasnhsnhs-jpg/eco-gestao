-- =============================================================================
-- Calculadora de orçamentos: custos e margens de lucro de cada serviço.
--
-- Cada linha é um número (chave "servico.item", ex.: "desinsetizacao.produto_m2").
-- Quais itens existem e como entram na conta fica na tela (src/features/orcamentos).
-- Valor vazio (null) = custo ainda não definido.
--
-- Quem vê: Admin e Vendedor (o vendedor usa a calculadora). O Financeiro não vê.
-- Quem altera: só o Admin.
-- =============================================================================

create table public.custos_orcamento (
  chave          text primary key check (chave ~ '^[a-z0-9_]+\.[a-z0-9_]+$'),
  valor          numeric(14, 4) check (valor >= 0),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id)
);

comment on table public.custos_orcamento is
  'Custos e margens de lucro usados na calculadora de orçamentos. Só o Admin altera.';

create function privado.antes_salvar_custo_orcamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.chave ~ '\.margem_' and new.valor >= 100 then
    raise exception 'A margem de lucro precisa ser menor que 100%%.' using errcode = '23514';
  end if;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end
$$;

create trigger antes_salvar before insert or update on public.custos_orcamento
  for each row execute function privado.antes_salvar_custo_orcamento();

-- Auditoria (a chave não é uuid: grava o registro sem id, como nas configurações).
create function privado.auditar_custo_orcamento()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.auditoria (tabela, acao, dados_antes, dados_depois, usuario_id)
  values ('custos_orcamento', lower(tg_op), to_jsonb(old), to_jsonb(new), auth.uid());
  return null;
end
$$;

revoke execute on function privado.auditar_custo_orcamento() from public, authenticated;

create trigger auditoria after insert or update on public.custos_orcamento
  for each row execute function privado.auditar_custo_orcamento();

alter table public.custos_orcamento enable row level security;

create policy "admin e vendedor veem custos" on public.custos_orcamento for select to authenticated
  using (coalesce(privado.meu_papel() in ('admin', 'vendedor'), false));
create policy "admin cadastra custos" on public.custos_orcamento for insert to authenticated
  with check (privado.e_admin());
create policy "admin altera custos" on public.custos_orcamento for update to authenticated
  using (privado.e_admin()) with check (privado.e_admin());

revoke all on public.custos_orcamento from anon, authenticated;
grant select, insert, update (chave, valor) on public.custos_orcamento to authenticated;
grant all on public.custos_orcamento to service_role;
