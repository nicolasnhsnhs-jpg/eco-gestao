-- =============================================================================
-- Descrição do contrato: o que o contrato assinado com o cliente contempla.
--
-- Um por cliente. Resume a minuta e os termos aditivos (o último aditivo vale):
-- vigência, reajuste, horário e taxa de atendimento fora do horário, e os
-- serviços do ano com quantidades (ex.: 150 porta-iscas; 2 reservatórios de
-- 10 mil litros, semestral; 8 bebedouros...).
--
-- Não guarda valor: o valor mensal fica no contrato recorrente (tabela
-- contratos), que o ADM e a recepção não veem. Esta descrição a recepção vê,
-- para saber o que o cliente tem direito e quanto se cobra fora do horário.
--
-- Itens (jsonb, lista em ordem):
--   { servico, detalhe, quantidade, unidade, frequencia, vezes_ano, locais }
-- =============================================================================

create table public.descricoes_contrato (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null unique references public.clientes (id) on delete cascade,
  numero_contrato     text,
  data_assinatura     date,
  vigencia_inicio     date,
  vigencia_fim        date,
  renovacao           text,
  reajuste            text,
  horario_atendimento text,
  taxa_fora_horario   text,
  itens               jsonb not null default '[]'::jsonb
                      check (jsonb_typeof(itens) = 'array'),
  servicos_extras     text,
  condicoes           text,
  pendencias          text,
  documentos          text[] not null default '{}',
  conferido_em        date,
  criado_em           timestamptz not null default now(),
  criado_por          uuid references public.perfis (id),
  atualizado_em       timestamptz not null default now(),
  atualizado_por      uuid references public.perfis (id),

  constraint vigencia_fim_depois_do_inicio
    check (vigencia_fim is null or vigencia_inicio is null or vigencia_fim >= vigencia_inicio)
);

comment on table public.descricoes_contrato is
  'O que o contrato assinado contempla (serviços do ano, quantidades, taxa fora do horário). Um por cliente.';

create trigger carimbar before insert or update on public.descricoes_contrato
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.descricoes_contrato
  for each row execute function privado.registrar_auditoria();

-- Ver: quem trabalha com o cliente (gestão e recepção: todos; vendedor: carteira).
-- Alterar: só a gestão (Admin, Financeiro e ADM).
alter table public.descricoes_contrato enable row level security;
create policy "ver descrição do contrato" on public.descricoes_contrato for select to authenticated
  using (privado.pode_ver_cliente(cliente_id));
create policy "cadastrar descrição do contrato" on public.descricoes_contrato for insert to authenticated
  with check ((select privado.tem_acesso_gestao()));
create policy "alterar descrição do contrato" on public.descricoes_contrato for update to authenticated
  using ((select privado.tem_acesso_gestao()))
  with check ((select privado.tem_acesso_gestao()));
create policy "apagar descrição do contrato" on public.descricoes_contrato for delete to authenticated
  using ((select privado.tem_acesso_gestao()));

revoke all on public.descricoes_contrato from anon, authenticated;
grant select, insert, update, delete on public.descricoes_contrato to authenticated;
grant all on public.descricoes_contrato to service_role;
