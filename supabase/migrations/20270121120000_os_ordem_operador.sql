-- =============================================================================
-- Ordem das OS escolhida pelo operador.
--
-- No Início do app o operador põe as OS dele na ordem em que vai fazer (sobe e
-- desce). A ordem fica guardada aqui (uma linha por operador, a lista de ids) para
-- valer também em outro celular. Concluir ou iniciar uma OS não muda a ordem: a
-- concluída fica no mesmo lugar, marcada como feita.
--
-- Quem vê e grava: só o próprio operador, a linha dele. Ids de OS que ele não vê
-- (ou que já saíram da lista) são só ignorados pela tela.
-- =============================================================================

create table public.os_ordem_operador (
  operador_id   uuid primary key references public.perfis (id) on delete cascade,
  os_ids        uuid[] not null default '{}',
  atualizado_em timestamptz not null default now(),
  -- Um operador com centenas de OS na tela não existe; o limite evita lixo.
  constraint os_ordem_operador_tamanho check (cardinality(os_ids) <= 500)
);

comment on table public.os_ordem_operador is
  'Ordem em que o operador quer ver as OS dele no Início do app.';

alter table public.os_ordem_operador enable row level security;

create policy "operador vê a ordem dele" on public.os_ordem_operador
  for select to authenticated using (operador_id = (select auth.uid()));
create policy "operador cria a ordem dele" on public.os_ordem_operador
  for insert to authenticated with check (operador_id = (select auth.uid()));
create policy "operador muda a ordem dele" on public.os_ordem_operador
  for update to authenticated
  using (operador_id = (select auth.uid()))
  with check (operador_id = (select auth.uid()));

grant select, insert, update on public.os_ordem_operador to authenticated;
