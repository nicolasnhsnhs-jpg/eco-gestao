-- =============================================================================
-- Comunicação de serviço (pedido de 26/11/2026).
--
-- O escritório emite em Documentos > Comunicação de serviço o aviso que vai ao
-- cliente antes do serviço: data e horário, local, técnicos autorizados (nome, RG,
-- CPF), veículo, preparação do ambiente, cuidados depois do serviço etc. Os
-- modelos (desinsetização em loja, em condomínio, limpeza de reservatório, de
-- coifa, controle de insetos…) só preenchem o formulário: tudo é editável e o
-- texto final fica gravado aqui (jsonb "conteudo"). O PDF sai no navegador.
-- Sem assinatura e sem envio automático: baixa o PDF e manda ao cliente.
-- =============================================================================

create table public.comunicacoes_servico (
  id             uuid primary key default gen_random_uuid(),
  modelo         text not null check (char_length(modelo) between 1 and 60),
  titulo         text not null check (char_length(btrim(titulo)) between 3 and 200),
  cliente_id     uuid not null references public.clientes (id) on delete restrict,
  endereco_id    uuid references public.enderecos (id) on delete set null,
  -- Copiado na emissão (é o nome que sai no PDF).
  cliente_nome   text not null check (char_length(cliente_nome) <= 300),
  data           date not null,
  -- {subtitulo, horario, local, contato, abertura, secoes[], tecnicos[], veiculo, fechamento, contatos}
  conteudo       jsonb not null check (jsonb_typeof(conteudo) = 'object' and octet_length(conteudo::text) <= 60000),
  criado_em      timestamptz not null default now(),
  criado_por     uuid references public.perfis (id),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id)
);

comment on table public.comunicacoes_servico is 'Comunicação de serviço ao cliente (aviso antes da visita), emitida pelo escritório.';

create index comunicacoes_servico_cliente_idx on public.comunicacoes_servico (cliente_id, data desc);
create index comunicacoes_servico_data_idx on public.comunicacoes_servico (data desc);
create index comunicacoes_servico_endereco_idx on public.comunicacoes_servico (endereco_id);
create index comunicacoes_servico_criado_por_idx on public.comunicacoes_servico (criado_por);
create index comunicacoes_servico_atualizado_por_idx on public.comunicacoes_servico (atualizado_por);

create trigger carimbar before insert or update on public.comunicacoes_servico
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.comunicacoes_servico
  for each row execute function privado.registrar_auditoria();

alter table public.comunicacoes_servico enable row level security;

create policy "escritório vê comunicações" on public.comunicacoes_servico for select to authenticated
  using (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id));
create policy "escritório emite comunicações" on public.comunicacoes_servico for insert to authenticated
  with check (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id));
create policy "escritório altera comunicações" on public.comunicacoes_servico for update to authenticated
  using (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id))
  with check (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id));
create policy "escritório apaga comunicações" on public.comunicacoes_servico for delete to authenticated
  using (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id));

revoke all on public.comunicacoes_servico from anon, authenticated;
grant select, insert, delete on public.comunicacoes_servico to authenticated;
grant update (modelo, titulo, endereco_id, cliente_nome, data, conteudo) on public.comunicacoes_servico to authenticated;
grant all on public.comunicacoes_servico to service_role;
