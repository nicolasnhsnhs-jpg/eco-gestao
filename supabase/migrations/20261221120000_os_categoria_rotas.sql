-- =============================================================================
-- O.S de contrato x O.S avulsa, e rotas.
--
-- - os_modelos.categoria: quem emite escolhe se a OS é de contrato ou avulsa.
--   Antes, toda OS criava um modelo e todos apareciam em "O.S de contrato".
--   Agora cada aba mostra só a sua categoria, e um mesmo local pode ter um
--   modelo de contrato e um avulso para o mesmo serviço.
-- - os_rotas / os_rota_modelos: rotas de visita (ex.: "Gravataí A") com os
--   modelos de contrato em ordem, para agendar a rota inteira de uma vez.
-- =============================================================================

create type public.categoria_os as enum ('contrato', 'avulsa');

alter table public.os_modelos add column categoria public.categoria_os;

-- Modelos que já existem: contrato se o cliente tem contrato ativo; senão avulsa.
-- (A tela permite trocar a categoria de um modelo, caso algum fique errado.)
update public.os_modelos m
set categoria = case
  when exists (
    select 1 from public.contratos c where c.cliente_id = m.cliente_id and c.status = 'ativo'
  ) then 'contrato'::public.categoria_os
  else 'avulsa'::public.categoria_os
end;

-- O padrão "contrato" mantém o comportamento antigo para quem ainda estiver com o
-- site anterior aberto; o site novo sempre manda a categoria escolhida.
alter table public.os_modelos alter column categoria set not null;
alter table public.os_modelos alter column categoria set default 'contrato';

alter table public.os_modelos drop constraint um_modelo_por_local;
alter table public.os_modelos add constraint um_modelo_por_local
  unique nulls not distinct (cliente_id, endereco_id, tipo_servico_id, categoria);

create index os_modelos_categoria_idx on public.os_modelos (categoria) where ativo;

-- -----------------------------------------------------------------------------
-- Rotas
-- -----------------------------------------------------------------------------

create table public.os_rotas (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null unique check (char_length(trim(nome)) between 1 and 80),
  observacoes    text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references public.perfis (id),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id)
);

create table public.os_rota_modelos (
  id             uuid primary key default gen_random_uuid(),
  rota_id        uuid not null references public.os_rotas (id) on delete cascade,
  modelo_id      uuid not null references public.os_modelos (id) on delete cascade,
  ordem          integer not null default 0,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references public.perfis (id),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id),

  constraint modelo_uma_vez_na_rota unique (rota_id, modelo_id)
);

create index os_rota_modelos_modelo_idx on public.os_rota_modelos (modelo_id);

create trigger carimbar before insert or update on public.os_rotas
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.os_rotas
  for each row execute function privado.registrar_auditoria();
create trigger carimbar before insert or update on public.os_rota_modelos
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.os_rota_modelos
  for each row execute function privado.registrar_auditoria();

alter table public.os_rotas enable row level security;
alter table public.os_rota_modelos enable row level security;

-- Só o escritório (quem agenda OS) vê e mexe nas rotas.
create policy "escritório vê rotas" on public.os_rotas for select to authenticated
  using (privado.pode_gerir_os());
create policy "escritório cria rotas" on public.os_rotas for insert to authenticated
  with check (privado.pode_gerir_os());
create policy "escritório altera rotas" on public.os_rotas for update to authenticated
  using (privado.pode_gerir_os()) with check (privado.pode_gerir_os());
create policy "escritório apaga rotas" on public.os_rotas for delete to authenticated
  using (privado.pode_gerir_os());

create policy "escritório vê itens da rota" on public.os_rota_modelos for select to authenticated
  using (privado.pode_gerir_os());
create policy "escritório põe itens na rota" on public.os_rota_modelos for insert to authenticated
  with check (privado.pode_gerir_os());
create policy "escritório altera itens da rota" on public.os_rota_modelos for update to authenticated
  using (privado.pode_gerir_os()) with check (privado.pode_gerir_os());
create policy "escritório tira itens da rota" on public.os_rota_modelos for delete to authenticated
  using (privado.pode_gerir_os());

revoke all on public.os_rotas, public.os_rota_modelos from anon, authenticated;
grant select, insert, update, delete on public.os_rotas, public.os_rota_modelos to authenticated;
grant all on public.os_rotas, public.os_rota_modelos to service_role;
