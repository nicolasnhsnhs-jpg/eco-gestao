-- =============================================================================
-- OS de treinamento (teste para os técnicos aprenderem a OS no celular)
--
-- O escritório escolhe uma OS de verdade e os técnicos: cada técnico ganha a sua
-- cópia, só dele (não fica ligada à dos outros). No celular funciona igual à OS
-- real, inclusive a lista do que falta para concluir.
--
-- A cópia é marcada "treinamento" e fica fora de tudo do cliente:
--   - número próprio (TESTE-0001), sem gastar a numeração das OS;
--   - sem modelo e com os pontos sem ligação com os do cliente (não mexe na
--     última troca de lâmpada nem na última limpeza das próximas visitas);
--   - concluir não registra serviço realizado (nem vencimento);
--   - nada vai para o Drive;
--   - a tela do escritório não mostra na lista de OS (só na aba Treinamento).
-- Depois o escritório apaga os testes (privado.apagar_treinamentos_os).
-- =============================================================================

alter table public.ordens_servico add column treinamento boolean not null default false;

create index ordens_servico_treinamento_idx on public.ordens_servico (treinamento)
  where treinamento;

-- Quem monta e apaga os testes: Admin, Financeiro e ADM (administrativo).
create function privado.pode_treinar_os()
returns boolean
language sql stable
set search_path = ''
as $$
  select privado.tem_acesso_gestao()
$$;

grant execute on function privado.pode_treinar_os() to authenticated;

-- -----------------------------------------------------------------------------
-- Número: TESTE-0001 em vez de OS-2026-0001.
-- (Igual a 20261103120200_ordens_servico.sql, só muda o número do treinamento.)
-- -----------------------------------------------------------------------------
create or replace function privado.antes_salvar_os()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ano     text := to_char(privado.hoje(), 'YYYY');
  v_funcao  boolean := current_setting('app.os_transicao', true) = 'sim';
begin
  if tg_op = 'INSERT' then
    if new.treinamento then
      new.numero := 'TESTE-' || lpad(privado.proximo_numero('os-teste')::text, 4, '0');
    else
      new.numero := 'OS-' || v_ano || '-'
                 || lpad(privado.proximo_numero('os-' || v_ano)::text, 4, '0');
    end if;
    if new.status not in ('rascunho', 'agendada') then
      raise exception 'Uma OS nova começa como rascunho ou agendada.' using errcode = '23514';
    end if;
  else
    new.numero := old.numero;
    new.treinamento := old.treinamento;

    -- Concluir, iniciar e reabrir só pelas funções próprias (que conferem as regras).
    if new.status is distinct from old.status and not v_funcao and not (
      old.status in ('rascunho', 'agendada', 'cancelada')
      and new.status in ('rascunho', 'agendada', 'cancelada')
    ) then
      raise exception 'Use os botões de iniciar, concluir ou reabrir a OS.' using errcode = '42501';
    end if;

    -- OS concluída fica travada: só a reabertura (admin) libera.
    if old.status in ('concluida', 'conferida') and not v_funcao then
      raise exception 'Esta OS já foi concluída. Peça ao administrador para reabrir.'
        using errcode = '42501';
    end if;
  end if;

  if new.endereco_id is not null and not exists (
    select 1 from public.enderecos e where e.id = new.endereco_id and e.cliente_id = new.cliente_id
  ) then
    raise exception 'A unidade escolhida não é deste cliente.' using errcode = '23514';
  end if;
  if new.modelo_id is not null and not exists (
    select 1 from public.os_modelos m
     where m.id = new.modelo_id and m.cliente_id = new.cliente_id
       and m.tipo_servico_id = new.tipo_servico_id
  ) then
    raise exception 'O modelo não é deste cliente e tipo de serviço.' using errcode = '23514';
  end if;

  -- Enquanto a execução não começou, a ficha acompanha o cadastro do cliente.
  if new.status in ('rascunho', 'agendada') then
    new.ficha_cliente := privado.ficha_cliente(new.cliente_id, new.endereco_id);
  end if;
  return new;
end
$$;

-- -----------------------------------------------------------------------------
-- Concluir: o teste confere tudo igual, mas não registra serviço realizado.
-- (Igual a 20261107120000_os_offline.sql, mais o desvio do treinamento.)
-- -----------------------------------------------------------------------------
create or replace function privado.concluir_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_os      public.ordens_servico;
  v_exec    public.os_execucao;
  v_falta   text[];
  v_servico uuid;
  v_nomes   text;
begin
  if not (privado.os_e_minha(p_os) or privado.e_admin()) then
    raise exception 'Esta OS não está atribuída a você.' using errcode = '42501';
  end if;
  select * into v_os from public.ordens_servico where id = p_os for update;
  -- Já concluída por este operador: a resposta da 1ª tentativa se perdeu no sinal
  -- fraco e a fila mandou de novo. Não é erro.
  if v_os.status in ('concluida', 'conferida') and v_os.concluida_por = auth.uid() then
    return;
  end if;
  if v_os.status not in ('agendada', 'em_execucao') then
    raise exception 'Esta OS não está aberta.' using errcode = '23514';
  end if;

  v_falta := privado.pendencias_os(p_os);
  if cardinality(v_falta) > 0 then
    raise exception 'Falta preencher: %.', array_to_string(v_falta, ', ') using errcode = '23514';
  end if;

  if v_os.treinamento then
    v_servico := null;
  else
    select * into v_exec from public.os_execucao where os_id = p_os;
    select string_agg(p.nome, ', ' order by p.nome) into v_nomes
      from public.os_operadores o join public.perfis p on p.id = o.operador_id
     where o.os_id = p_os;

    if v_os.servico_id is null then
      insert into public.servicos
        (cliente_id, endereco_id, tipo_servico_id, data_execucao, status, tecnicos, observacoes)
      values
        (v_os.cliente_id, v_os.endereco_id, v_os.tipo_servico_id, v_exec.data, 'realizado',
         v_nomes, 'Registrado pela ' || v_os.numero)
      returning id into v_servico;
    else
      v_servico := v_os.servico_id;
      update public.servicos
         set data_execucao = v_exec.data, status = 'realizado', tecnicos = v_nomes
       where id = v_servico;
    end if;
  end if;

  perform set_config('app.os_transicao', 'sim', true);
  update public.ordens_servico
     set status = 'concluida', concluida_em = now(), concluida_por = auth.uid(),
         servico_id = v_servico
   where id = p_os;
  perform set_config('app.os_transicao', '', true);
end
$$;

-- -----------------------------------------------------------------------------
-- Nada do treinamento vai para o Drive do cliente.
-- -----------------------------------------------------------------------------
create or replace function privado.arquivo_para_o_drive()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if privado.vai_para_o_drive(new.categoria, new.tipo_mime) and privado.drive_ligado()
     and not exists (
       select 1 from public.ordens_servico s where s.id = new.os_id and s.treinamento
     ) then
    insert into public.drive_fila (arquivo_id) values (new.id) on conflict do nothing;
  end if;
  return null;
end
$$;

-- -----------------------------------------------------------------------------
-- Fotos, assinaturas e técnicos de um teste concluído podem ser apagados (com o teste).
-- -----------------------------------------------------------------------------
create or replace function privado.arquivo_de_os_travada()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.os_id is not null and exists (
    select 1 from public.ordens_servico s
     where s.id = old.os_id and s.status in ('concluida', 'conferida') and not s.treinamento
  ) then
    raise exception 'Esta OS já foi concluída: as fotos e assinaturas ficam guardadas como estão.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end
$$;

create or replace function privado.antes_remover_operador_os()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.ordens_servico s
     where s.id = old.os_id and s.status in ('concluida', 'conferida') and not s.treinamento
  ) then
    raise exception 'Não dá para trocar os operadores de uma OS concluída.' using errcode = '42501';
  end if;
  return old;
end
$$;

-- -----------------------------------------------------------------------------
-- Montar o teste: uma cópia da OS escolhida para cada técnico, para hoje.
-- -----------------------------------------------------------------------------
create function privado.criar_treinamento_os(p_origem uuid, p_operadores uuid[])
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_origem public.ordens_servico;
  v_op     uuid;
  v_os     uuid;
  v_total  integer := 0;
begin
  if not privado.pode_treinar_os() then
    raise exception 'Somente o escritório monta o treinamento.' using errcode = '42501';
  end if;
  select * into v_origem from public.ordens_servico where id = p_origem;
  if v_origem.id is null then
    raise exception 'OS não encontrada.' using errcode = '23514';
  end if;
  if coalesce(cardinality(p_operadores), 0) = 0 then
    raise exception 'Escolha pelo menos um técnico.' using errcode = '23514';
  end if;

  foreach v_op in array (select array_agg(distinct x) from unnest(p_operadores) x) loop
    insert into public.ordens_servico
      (cliente_id, endereco_id, tipo_servico_id, status, data_agendada, veiculo_id,
       observacoes_adm, descricao, escopo, treinamento)
    values
      (v_origem.cliente_id, v_origem.endereco_id, v_origem.tipo_servico_id, 'agendada',
       privado.hoje(), v_origem.veiculo_id, v_origem.observacoes_adm, v_origem.descricao,
       v_origem.escopo, true)
    returning id into v_os;

    insert into public.os_operadores (os_id, operador_id) values (v_os, v_op);

    -- Os pontos como estavam na OS escolhida, em branco para preencher e sem
    -- ligação com os pontos do cliente.
    insert into public.os_pontos
      (os_id, ponto_id, tipo, numero, area, forma_iscagem, tipo_isca, modelo_armadilha,
       material, quantidade, quantidade_telas, codigo_filtro, ultima_troca_lampada,
       ultima_limpeza, situacao)
    select v_os, null, p.tipo, p.numero, p.area, p.forma_iscagem, p.tipo_isca,
           p.modelo_armadilha, p.material, p.quantidade, p.quantidade_telas, p.codigo_filtro,
           p.ultima_troca_lampada, p.ultima_limpeza,
           case
             when p.tipo <> 'porta_isca' then null
             when p.tipo_isca = 'CO' then 'M'
             else 'MS'
           end
      from public.os_pontos p
     where p.os_id = p_origem;

    v_total := v_total + 1;
  end loop;
  return v_total;
end
$$;

-- -----------------------------------------------------------------------------
-- Apagar testes (um, ou todos quando p_os é nulo). Devolve os caminhos das fotos
-- e assinaturas no Storage, para a tela apagar os arquivos também.
-- -----------------------------------------------------------------------------
create function privado.apagar_treinamentos_os(p_os uuid)
returns text[]
language plpgsql security definer
set search_path = ''
as $$
declare
  v_caminhos text[];
begin
  if not privado.pode_treinar_os() then
    raise exception 'Somente o escritório apaga o treinamento.' using errcode = '42501';
  end if;

  update public.os_execucao e
     set assinatura_cliente_id = null, assinatura_operador_id = null
    from public.ordens_servico s
   where s.id = e.os_id and s.treinamento and (p_os is null or s.id = p_os);

  with apagados as (
    delete from public.arquivos a
     using public.ordens_servico s
     where s.id = a.os_id and s.treinamento and (p_os is null or s.id = p_os)
    returning a.caminho_storage
  )
  select coalesce(array_agg(caminho_storage), '{}') into v_caminhos from apagados;

  delete from public.ordens_servico where treinamento and (p_os is null or id = p_os);
  return v_caminhos;
end
$$;

revoke execute on function privado.criar_treinamento_os(uuid, uuid[]),
  privado.apagar_treinamentos_os(uuid) from public;
grant execute on function privado.criar_treinamento_os(uuid, uuid[]),
  privado.apagar_treinamentos_os(uuid) to authenticated;

create function public.criar_treinamento_os(origem uuid, operadores uuid[])
returns integer
language sql security invoker
set search_path = ''
as $$
  select privado.criar_treinamento_os(origem, operadores)
$$;

create function public.apagar_treinamentos_os(os uuid default null)
returns text[]
language sql security invoker
set search_path = ''
as $$
  select privado.apagar_treinamentos_os(os)
$$;

revoke execute on function public.criar_treinamento_os(uuid, uuid[]),
  public.apagar_treinamentos_os(uuid) from public, anon;
grant execute on function public.criar_treinamento_os(uuid, uuid[]),
  public.apagar_treinamentos_os(uuid) to authenticated;
