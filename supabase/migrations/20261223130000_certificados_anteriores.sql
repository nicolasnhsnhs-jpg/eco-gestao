-- =============================================================================
-- Certificados de contrato emitidos ANTES do sistema (vinham de uma planilha).
--
-- Só servem para o aviso de renovação: 14 dias antes da validade o ADM recebe o
-- aviso para agendar o serviço e emitir o novo certificado, igual aos certificados
-- de contrato emitidos no sistema (gerar_avisos_certificados).
--
-- O nome vem como estava na planilha (às vezes é a unidade, às vezes o veículo).
-- Quando deu para reconhecer o cliente e a unidade cadastrados, eles ficam ligados e
-- o aviso some sozinho ao emitir o novo certificado do mesmo cliente/unidade/serviço.
-- Sem ligação, o ADM resolve o aviso à mão depois de emitir.
-- =============================================================================

create table public.certificados_anteriores (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (char_length(trim(nome)) between 2 and 300),
  servico          text,
  periodicidade    text,
  emitido_em       date,
  validade         date not null,
  cliente_id       uuid references public.clientes (id) on delete cascade,
  endereco_id      uuid references public.enderecos (id) on delete set null,
  tipo_servico_id  uuid references public.tipos_servico (id) on delete set null,
  origem           text,
  criado_em        timestamptz not null default now()
);

create index certificados_anteriores_validade_idx on public.certificados_anteriores (validade);
create index certificados_anteriores_cliente_idx on public.certificados_anteriores (cliente_id);

alter table public.certificados_anteriores enable row level security;
create policy "admin e ADM veem certificados anteriores" on public.certificados_anteriores
  for select to authenticated using (privado.pode_emitir_certificado());
revoke all on public.certificados_anteriores from anon, authenticated;
grant select on public.certificados_anteriores to authenticated;
grant all on public.certificados_anteriores to service_role;

alter table public.avisos
  add column certificado_anterior_id uuid references public.certificados_anteriores (id) on delete cascade;

-- -----------------------------------------------------------------------------
-- Geração (chamada junto com a dos certificados do sistema)
-- -----------------------------------------------------------------------------
create function privado.gerar_avisos_certificados_anteriores()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_hoje  date := privado.hoje();
  v_total integer;
begin
  insert into public.avisos
    (papel_destino, tipo, titulo, mensagem, link, certificado_anterior_id, chave_unica)
  select
    'administrativo',
    'certificado_contrato_vencendo',
    case when a.validade < v_hoje
      then 'Certificado de contrato vencido: agendar ' || coalesce(lower(t.nome), a.servico, 'o serviço')
      else 'Certificado de contrato vencendo: agendar ' || coalesce(lower(t.nome), a.servico, 'o serviço')
    end,
    concat_ws(' · ',
      a.nome,
      a.servico,
      'certificado anterior ao sistema',
      case when a.validade < v_hoje then 'venceu em ' else 'vale até ' end
        || to_char(a.validade, 'DD/MM/YYYY')
    ) || '. É contrato: agende o serviço e emita o novo certificado.',
    '/certificados/novo',
    a.id,
    'certificado-anterior:' || a.id
  from public.certificados_anteriores a
  left join public.tipos_servico t on t.id = a.tipo_servico_id
  left join public.clientes c on c.id = a.cliente_id
  where a.validade - 14 <= v_hoje
    -- Ligado a um cliente: só se ele continua ativo e com contrato.
    and (a.cliente_id is null or (
      c.ativo and exists (
        select 1 from public.contratos ct where ct.cliente_id = a.cliente_id and ct.status = 'ativo')))
    -- Já foi emitido no sistema o certificado seguinte? Então não avisa.
    and not exists (
      select 1 from public.certificados n
       where a.cliente_id is not null
         and n.cliente_id = a.cliente_id
         and (a.endereco_id is null or n.endereco_id = a.endereco_id)
         and (a.tipo_servico_id is null or n.tipo_servico_id = a.tipo_servico_id)
         and n.cancelado_em is null
         and n.validade > a.validade
    )
  on conflict (chave_unica) do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end
$$;

revoke execute on function privado.gerar_avisos_certificados_anteriores() from public, authenticated;

-- A geração dos certificados do sistema (igual a 20261126120200, 14 dias) passa a incluir
-- os anteriores; assim o "Atualizar avisos" e a tarefa diária já cobrem os dois.
create or replace function privado.gerar_avisos_certificados()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_hoje  date := privado.hoje();
  v_total integer;
begin
  insert into public.avisos (papel_destino, tipo, titulo, mensagem, link, certificado_id, chave_unica)
  select
    'administrativo',
    'certificado_contrato_vencendo',
    case when ce.validade < v_hoje
      then 'Certificado de contrato vencido: agendar ' || lower(t.nome)
      else 'Certificado de contrato vencendo: agendar ' || lower(t.nome)
    end,
    concat_ws(' · ',
      coalesce(c.nome_fantasia, c.nome),
      e.apelido,
      ce.numero,
      case when ce.validade < v_hoje then 'venceu em ' else 'vale até ' end
        || to_char(ce.validade, 'DD/MM/YYYY')
    ) || '. É contrato: agende o serviço e emita o novo certificado.',
    '/certificados/' || ce.id,
    ce.id,
    'certificado:' || ce.id
  from public.certificados ce
  join public.clientes c on c.id = ce.cliente_id
  join public.tipos_servico t on t.id = ce.tipo_servico_id
  left join public.enderecos e on e.id = ce.endereco_id
  where ce.tipo_validade = 'contrato'
    and ce.cancelado_em is null
    and ce.validade is not null
    and ce.validade - 14 <= v_hoje
    and c.ativo
    and exists (
      select 1 from public.contratos ct where ct.cliente_id = ce.cliente_id and ct.status = 'ativo'
    )
    and not exists (
      select 1 from public.certificados n
       where n.cliente_id = ce.cliente_id
         and n.endereco_id is not distinct from ce.endereco_id
         and n.tipo_servico_id = ce.tipo_servico_id
         and n.cancelado_em is null
         and n.id <> ce.id
         and n.validade > ce.validade
    )
  on conflict (chave_unica) do nothing;

  get diagnostics v_total = row_count;
  return v_total + privado.gerar_avisos_certificados_anteriores();
end
$$;

-- -----------------------------------------------------------------------------
-- Resolução automática: emitiu no sistema o certificado seguinte do mesmo cliente
-- (e unidade e serviço, quando conhecidos), com validade maior.
-- -----------------------------------------------------------------------------
create function privado.resolver_avisos_certificados_anteriores()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.cancelado_em is null and new.validade is not null then
    update public.avisos av set resolvido_em = now()
      from public.certificados_anteriores a
     where av.certificado_anterior_id = a.id and av.resolvido_em is null
       and a.cliente_id = new.cliente_id
       and (a.endereco_id is null or a.endereco_id = new.endereco_id)
       and (a.tipo_servico_id is null or a.tipo_servico_id = new.tipo_servico_id)
       and a.validade < new.validade;
  end if;
  return null;
end
$$;

revoke execute on function privado.resolver_avisos_certificados_anteriores() from public, authenticated;

create trigger resolver_avisos_anteriores after insert or update on public.certificados
  for each row execute function privado.resolver_avisos_certificados_anteriores();
