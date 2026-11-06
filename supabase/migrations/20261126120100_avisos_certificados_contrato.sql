-- =============================================================================
-- Aviso de certificado de CONTRATO perto de vencer → para o ADM (e o Administrador).
--
-- No contrato, quem renova o certificado é o ADM: quando a validade chega perto,
-- é preciso emitir o próximo. Certificado AVULSO não entra aqui: para ele, o
-- vendedor precisa vender uma nova realização do serviço (esse aviso já existe,
-- o de "serviço vencendo", que vai para o vendedor).
--
-- Regras:
--   - só o certificado mais recente de cada cliente + unidade + tipo de serviço
--     (se já foi emitido um com validade maior, o antigo não avisa);
--   - só se o cliente está ativo e ainda tem contrato ativo;
--   - avisa 15 dias antes da validade (e continua aparecendo depois que venceu);
--   - o aviso some sozinho quando o certificado seguinte é emitido, quando o
--     certificado é cancelado ou quando o contrato do cliente acaba.
-- =============================================================================

alter table public.avisos
  add column certificado_id uuid references public.certificados (id) on delete cascade;

create index avisos_certificado_idx on public.avisos (certificado_id) where certificado_id is not null;

-- O Administrador também enxerga os avisos que vão para o perfil ADM.
create or replace function privado.aviso_e_meu(destinatario_id uuid, papel_destino public.papel)
returns boolean
language sql stable
set search_path = ''
as $$
  select destinatario_id = (select auth.uid())
      or papel_destino = privado.meu_papel()
      or (papel_destino in ('admin', 'financeiro') and privado.tem_acesso_total())
      or (papel_destino = 'admin' and privado.meu_papel() = 'administrativo')
      or (papel_destino = 'administrativo' and privado.meu_papel() = 'admin')
$$;

-- -----------------------------------------------------------------------------
-- Geração
-- -----------------------------------------------------------------------------
create function privado.gerar_avisos_certificados()
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
    case when ce.validade < v_hoje then 'Certificado de contrato vencido: renovar'
         else 'Certificado de contrato vencendo: renovar' end,
    concat_ws(' · ',
      ce.numero,
      coalesce(c.nome_fantasia, c.nome),
      e.apelido,
      t.nome,
      case when ce.validade < v_hoje then 'venceu em ' else 'vale até ' end
        || to_char(ce.validade, 'DD/MM/YYYY')
    ),
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
    and ce.validade - 15 <= v_hoje
    and c.ativo
    and exists (
      select 1 from public.contratos ct where ct.cliente_id = ce.cliente_id and ct.status = 'ativo'
    )
    -- Já foi emitido o certificado seguinte? Então este não precisa avisar.
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
  return v_total;
end
$$;

revoke execute on function privado.gerar_avisos_certificados() from public;
grant execute on function privado.gerar_avisos_certificados() to authenticated;

-- -----------------------------------------------------------------------------
-- Resolução automática
-- -----------------------------------------------------------------------------
create function privado.resolver_avisos_certificados()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'certificados' then
    -- Cancelado (ou deixou de ser de contrato): o aviso dele sai.
    if new.cancelado_em is not null or new.tipo_validade <> 'contrato' then
      update public.avisos set resolvido_em = now()
       where certificado_id = new.id and resolvido_em is null;
    end if;
    -- Emitiu (ou corrigiu) um certificado válido: os anteriores do mesmo
    -- cliente + unidade + serviço, com validade menor, foram renovados.
    if new.cancelado_em is null and new.validade is not null then
      update public.avisos a set resolvido_em = now()
        from public.certificados v
       where a.certificado_id = v.id and a.resolvido_em is null
         and v.id <> new.id
         and v.cliente_id = new.cliente_id
         and v.endereco_id is not distinct from new.endereco_id
         and v.tipo_servico_id = new.tipo_servico_id
         and v.validade < new.validade;
    end if;
  elsif tg_table_name = 'contratos' then
    -- O cliente ficou sem contrato ativo: não há o que renovar.
    if new.status <> 'ativo' and not exists (
      select 1 from public.contratos ct where ct.cliente_id = new.cliente_id and ct.status = 'ativo'
    ) then
      update public.avisos a set resolvido_em = now()
        from public.certificados v
       where a.certificado_id = v.id and a.resolvido_em is null
         and v.cliente_id = new.cliente_id;
    end if;
  end if;
  return null;
end
$$;

revoke execute on function privado.resolver_avisos_certificados() from public, authenticated;

create trigger resolver_avisos after insert or update on public.certificados
  for each row execute function privado.resolver_avisos_certificados();
create trigger resolver_avisos_certificados after update on public.contratos
  for each row execute function privado.resolver_avisos_certificados();

-- -----------------------------------------------------------------------------
-- "Atualizar avisos" (ao abrir a tela) e tarefa diária
-- -----------------------------------------------------------------------------
create or replace function public.atualizar_avisos()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_total integer := 0;
begin
  if privado.meu_papel() is null then
    return 0;
  end if;
  if privado.tem_acesso_total() then
    v_total := privado.gerar_avisos_financeiro() + privado.gerar_avisos_comissoes();
  end if;
  if privado.meu_papel() in ('admin', 'administrativo') then
    v_total := v_total + privado.gerar_avisos_certificados();
  end if;
  return v_total + privado.gerar_avisos_propostas() + privado.gerar_avisos_servicos();
end
$$;

select cron.schedule(
  'gerar-avisos-certificados',
  '20 9 * * *',
  $$select privado.gerar_avisos_certificados()$$
);
