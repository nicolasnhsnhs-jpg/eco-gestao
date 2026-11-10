-- =============================================================================
-- Agenda do dia: cadastro fixo de técnicos e veículos da unidade.
--
--   agenda_tecnicos  número do técnico (o que aparece no quadro), nome e CNH
--   agenda_veiculos  código (ex.: GO6), placa e se tem Sem Parar
--
-- A lista "Veículos sem Sem Parar" do quadro sai daqui (tem_sem_parar = false),
-- então deixa de ser guardada em cada dia.
-- Quem tem a aba vê; quem cuida da gestão (admin, financeiro e ADM) altera.
-- =============================================================================

create table public.agenda_tecnicos (
  numero          int primary key check (numero > 0),
  nome            text not null check (btrim(nome) <> ''),
  -- Categoria da CNH (AB, AD, B, D...), como na lista da empresa.
  cnh             text not null default '',
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references public.perfis (id),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.perfis (id)
);

create table public.agenda_veiculos (
  codigo          text primary key check (codigo = upper(btrim(codigo)) and codigo <> ''),
  placa           text not null default '',
  tem_sem_parar   boolean not null default true,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references public.perfis (id),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.perfis (id)
);

create trigger carimbar before insert or update on public.agenda_tecnicos
  for each row execute function privado.carimbar();
create trigger carimbar before insert or update on public.agenda_veiculos
  for each row execute function privado.carimbar();

alter table public.agenda_tecnicos enable row level security;
alter table public.agenda_veiculos enable row level security;
revoke all on public.agenda_tecnicos, public.agenda_veiculos from anon, authenticated;
grant select, insert, update, delete on public.agenda_tecnicos, public.agenda_veiculos to authenticated;
grant all on public.agenda_tecnicos, public.agenda_veiculos to service_role;

create policy "agenda: quem tem a aba vê os técnicos" on public.agenda_tecnicos for select to authenticated
  using (privado.pode_usar_agenda());
create policy "agenda: gestão cadastra técnicos" on public.agenda_tecnicos for insert to authenticated
  with check (privado.tem_acesso_gestao());
create policy "agenda: gestão altera técnicos" on public.agenda_tecnicos for update to authenticated
  using (privado.tem_acesso_gestao()) with check (privado.tem_acesso_gestao());
create policy "agenda: gestão apaga técnicos" on public.agenda_tecnicos for delete to authenticated
  using (privado.tem_acesso_gestao());

create policy "agenda: quem tem a aba vê os veículos" on public.agenda_veiculos for select to authenticated
  using (privado.pode_usar_agenda());
create policy "agenda: gestão cadastra veículos" on public.agenda_veiculos for insert to authenticated
  with check (privado.tem_acesso_gestao());
create policy "agenda: gestão altera veículos" on public.agenda_veiculos for update to authenticated
  using (privado.tem_acesso_gestao()) with check (privado.tem_acesso_gestao());
create policy "agenda: gestão apaga veículos" on public.agenda_veiculos for delete to authenticated
  using (privado.tem_acesso_gestao());

alter publication supabase_realtime add table public.agenda_tecnicos, public.agenda_veiculos;

-- A lista do dia sai do cadastro de veículos.
alter table public.agenda_dias drop column sem_sem_parar;
