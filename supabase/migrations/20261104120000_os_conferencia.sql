-- =============================================================================
-- Ordens de Serviço (OS-2): conferência interna e faturamento
--
-- A conferência é a 3ª camada da OS: só o escritório (Admin, Financeiro, Recepção)
-- vê e preenche. O operador e o vendedor não têm nenhuma regra de leitura nela.
-- =============================================================================

create table public.os_conferencia (
  os_id            uuid primary key references public.ordens_servico (id) on delete cascade,
  -- Administrativo
  certificado      boolean,
  cronograma       boolean,
  alteracoes       text,
  solicitacao      boolean,
  destinacao       text,
  -- Logística
  logistica        text,
  -- Financeiro
  taxa_faturada    boolean,
  valor            numeric(12, 2) check (valor >= 0),
  faturado_em      date,
  valor_faturado   numeric(12, 2) check (valor_faturado >= 0),
  numero_nf        text,
  vencimento       date,
  lancamento_id    uuid references public.lancamentos (id) on delete set null,
  -- Envio
  envio_scanner    boolean not null default false,
  envio_email      boolean not null default false,
  envio_relatorios boolean not null default false,
  envio_arquivo    boolean not null default false,
  observacoes      text,
  criado_em        timestamptz not null default now(),
  criado_por       uuid references public.perfis (id),
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid references public.perfis (id)
);

create index os_conferencia_lancamento_idx on public.os_conferencia (lancamento_id);

create trigger carimbar before insert or update on public.os_conferencia
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.os_conferencia
  for each row execute function privado.registrar_auditoria();

-- Toda OS nasce com a execução e a conferência vazias.
create or replace function privado.depois_criar_os()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.os_execucao (os_id, veiculo_id) values (new.id, new.veiculo_id);
  insert into public.os_conferencia (os_id) values (new.id);
  return null;
end
$$;

insert into public.os_conferencia (os_id)
select id from public.ordens_servico
on conflict (os_id) do nothing;

-- Auditoria: como a execução, a conferência fica registrada com o id e o cliente da OS.
create or replace function privado.registrar_auditoria()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_antes   jsonb;
  v_depois  jsonb;
  v_linha   jsonb;
  v_cliente uuid;
begin
  -- Campos técnicos que não interessam no histórico.
  if tg_op <> 'INSERT' then
    v_antes := to_jsonb(old) - 'busca_texto';
  end if;
  if tg_op <> 'DELETE' then
    v_depois := to_jsonb(new) - 'busca_texto';
  end if;

  -- Atualização que não mudou nada além do carimbo: não registra.
  if tg_op = 'UPDATE'
     and (v_antes - 'atualizado_em' - 'atualizado_por')
       = (v_depois - 'atualizado_em' - 'atualizado_por') then
    return new;
  end if;

  v_linha := coalesce(v_depois, v_antes);
  v_cliente := case
    when tg_table_name = 'clientes' then (v_linha ->> 'id')::uuid
    when tg_table_name in ('os_execucao', 'os_conferencia') then
      (select s.cliente_id from public.ordens_servico s where s.id = (v_linha ->> 'os_id')::uuid)
    else (v_linha ->> 'cliente_id')::uuid
  end;

  insert into public.auditoria (tabela, registro_id, cliente_id, acao, dados_antes, dados_depois, usuario_id)
  values (tg_table_name, coalesce(v_linha ->> 'id', v_linha ->> 'os_id')::uuid, v_cliente,
          lower(tg_op), v_antes, v_depois, auth.uid());

  return coalesce(new, old);
end
$$;

-- -----------------------------------------------------------------------------
-- Permissões: só o escritório
-- -----------------------------------------------------------------------------

alter table public.os_conferencia enable row level security;

create policy "escritório vê a conferência" on public.os_conferencia for select to authenticated
  using (privado.pode_gerir_os() and privado.pode_ver_os(os_id));
create policy "escritório preenche a conferência" on public.os_conferencia for update
  to authenticated
  using (privado.pode_gerir_os() and privado.pode_ver_os(os_id))
  with check (privado.pode_gerir_os() and privado.pode_ver_os(os_id));

revoke all on public.os_conferencia from anon, authenticated;
grant select on public.os_conferencia to authenticated;
-- O lançamento é ligado só pela função de faturar.
grant update (certificado, cronograma, alteracoes, solicitacao, destinacao, logistica,
  taxa_faturada, valor, faturado_em, valor_faturado, numero_nf, vencimento, envio_scanner,
  envio_email, envio_relatorios, envio_arquivo, observacoes) on public.os_conferencia
  to authenticated;
grant all on public.os_conferencia to service_role;

-- -----------------------------------------------------------------------------
-- Conferir: OS concluída passa a "conferida" (continua travada para o operador).
-- -----------------------------------------------------------------------------

create function privado.conferir_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.pode_gerir_os() then
    raise exception 'Somente o escritório confere a OS.' using errcode = '42501';
  end if;
  perform set_config('app.os_transicao', 'sim', true);
  update public.ordens_servico set status = 'conferida' where id = p_os and status = 'concluida';
  if not found then
    raise exception 'Só dá para conferir uma OS concluída pelo operador.' using errcode = '23514';
  end if;
  perform set_config('app.os_transicao', '', true);
end
$$;

revoke execute on function privado.conferir_os(uuid) from public;
grant execute on function privado.conferir_os(uuid) to authenticated;

create function public.conferir_os(os uuid)
returns void
language sql security invoker
set search_path = ''
as $$
  select privado.conferir_os(os)
$$;

-- -----------------------------------------------------------------------------
-- Faturar: cria a conta a receber no financeiro e liga à conferência.
-- Roda com a permissão de quem chama: as regras do financeiro valem (só Admin e
-- Financeiro conseguem criar o lançamento).
-- -----------------------------------------------------------------------------

create function public.faturar_os(os uuid, valor numeric, vencimento date, numero_nf text default null)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_os         public.ordens_servico;
  v_tipo       text;
  v_lancamento uuid;
begin
  if not privado.tem_acesso_total() then
    raise exception 'Somente o Financeiro ou o Administrador fatura a OS.' using errcode = '42501';
  end if;
  select * into v_os from public.ordens_servico where id = os;
  if v_os.id is null or v_os.status not in ('concluida', 'conferida') then
    raise exception 'Só dá para faturar uma OS concluída.' using errcode = '23514';
  end if;
  if exists (select 1 from public.os_conferencia c where c.os_id = os and c.lancamento_id is not null) then
    raise exception 'Esta OS já foi faturada.' using errcode = '23505';
  end if;
  select nome into v_tipo from public.tipos_servico where id = v_os.tipo_servico_id;

  insert into public.lancamentos
    (tipo, descricao, cliente_id, categoria_id, competencia, vencimento, valor, numero_nota_fiscal)
  values
    ('entrada', v_os.numero || ' · ' || v_tipo, v_os.cliente_id,
     (select id from public.categorias_financeiras where tipo = 'receita' and nome = 'Serviços prestados'),
     vencimento, vencimento, valor, nullif(trim(numero_nf), ''))
  returning id into v_lancamento;

  -- O serviço realizado passa a mostrar o valor e o lançamento fica ligado a ele.
  if v_os.servico_id is not null then
    update public.servicos set valor = faturar_os.valor where id = v_os.servico_id;
    update public.lancamentos set servico_id = v_os.servico_id where id = v_lancamento;
  end if;

  update public.os_conferencia
     set taxa_faturada = true, valor_faturado = faturar_os.valor, faturado_em = privado.hoje(),
         vencimento = faturar_os.vencimento, numero_nf = nullif(trim(faturar_os.numero_nf), '')
   where os_id = os;
  -- lancamento_id não tem permissão de UPDATE para ninguém; grava pelo dono do banco.
  perform privado.ligar_lancamento_os(os, v_lancamento);
  return v_lancamento;
end
$$;

create function privado.ligar_lancamento_os(p_os uuid, p_lancamento uuid)
returns void
language sql security definer
set search_path = ''
as $$
  update public.os_conferencia set lancamento_id = p_lancamento
   where os_id = p_os and privado.tem_acesso_total()
     and exists (select 1 from public.lancamentos l where l.id = p_lancamento)
$$;

revoke execute on function privado.ligar_lancamento_os(uuid, uuid) from public;
grant execute on function privado.ligar_lancamento_os(uuid, uuid) to authenticated;

revoke execute on function public.conferir_os(uuid), public.faturar_os(uuid, numeric, date, text)
  from public, anon;
grant execute on function public.conferir_os(uuid), public.faturar_os(uuid, numeric, date, text)
  to authenticated;
