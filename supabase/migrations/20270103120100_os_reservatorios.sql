-- =============================================================================
-- OS de limpeza de reservatórios com os reservatórios do local (como coifas e
-- bebedouros): cada um é um ponto de controle do modelo com localização,
-- quantidade e capacidade em litros. Na visita o técnico marca "limpo" sim/não;
-- a data da última limpeza vem do histórico (ultima_limpeza) e se atualiza a cada
-- OS concluída. O tipo "Limpeza de reservatórios" passa a usar este formulário.
-- O resto das funções é igual ao de 20261230120000_armadilha_dados_fixos.sql e
-- 20270102120100_os_pragas_simples.sql.
-- Mesma regra no celular: src/features/os/offline/pendencias.ts.
-- =============================================================================

alter table public.pontos_controle
  add column capacidade_litros integer check (capacidade_litros > 0);
alter table public.os_pontos add column capacidade_litros integer;
grant update (capacidade_litros) on public.pontos_controle to authenticated;

alter table public.pontos_controle drop constraint campos_do_tipo;
alter table public.pontos_controle add constraint campos_do_tipo check (
  (tipo = 'porta_isca' and forma_iscagem is not null and tipo_isca is not null
     and modelo_armadilha is null and material is null)
  or (tipo = 'armadilha_luminosa' and modelo_armadilha is not null
     and forma_iscagem is null and tipo_isca is null and material is null)
  or (tipo = 'coifa'
     and forma_iscagem is null and tipo_isca is null and modelo_armadilha is null)
  or (tipo in ('bebedouro', 'bebedouro_garrafao', 'ponto_coleta', 'ar_condicionado', 'reservatorio')
     and forma_iscagem is null and tipo_isca is null and modelo_armadilha is null
     and material is null)
);

create or replace function privado.copiar_pontos_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.os_pontos where os_id = p_os;
  insert into public.os_pontos
    (os_id, ponto_id, tipo, numero, area, forma_iscagem, tipo_isca, modelo_armadilha,
     material, quantidade, quantidade_telas, codigo_filtro, btu, marca, numero_serie, capacidade_litros,
     ultima_troca_lampada, ultima_limpeza, situacao, observacao_fixa)
  select p_os, p.id, p.tipo, p.numero, p.area, p.forma_iscagem, p.tipo_isca, p.modelo_armadilha,
         p.material, p.quantidade, p.quantidade_telas, p.codigo_filtro, p.btu, p.marca,
         p.numero_serie, p.capacidade_litros,
         p.ultima_troca_lampada,
         case when p.tipo in ('bebedouro', 'bebedouro_garrafao', 'ponto_coleta', 'ar_condicionado', 'reservatorio') then
           (select max(e.data)
              from public.os_pontos ant
              join public.os_execucao e on e.os_id = ant.os_id
              join public.ordens_servico s on s.id = ant.os_id
             where ant.ponto_id = p.id and ant.os_id <> p_os
               and s.status in ('concluida', 'conferida')
               and case p.tipo
                     when 'ponto_coleta' then ant.coletado
                     when 'ar_condicionado' then
                       'sim' in (ant.limpeza_serpentina, ant.limpeza_gabinete, ant.limpeza_dreno)
                     else ant.limpo
                   end)
         end,
         case
           when p.tipo <> 'porta_isca' then null
           when p.tipo_isca = 'CO' then 'M'
           else 'MS'
         end,
         p.observacao_fixa
    from public.pontos_controle p
    join public.ordens_servico s on s.id = p_os and s.modelo_id = p.modelo_id
   where p.ativo;
end
$$;

create or replace function privado.criar_treinamento_os(p_origem uuid, p_operadores uuid[])
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
       observacoes_adm, ocorrencia, descricao, escopo, treinamento)
    values
      (v_origem.cliente_id, v_origem.endereco_id, v_origem.tipo_servico_id, 'agendada',
       privado.hoje(), v_origem.veiculo_id, v_origem.observacoes_adm, v_origem.ocorrencia,
       v_origem.descricao,
       v_origem.escopo, true)
    returning id into v_os;

    insert into public.os_operadores (os_id, operador_id) values (v_os, v_op);

    -- Os pontos como estavam na OS escolhida, em branco para preencher e sem
    -- ligação com os pontos do cliente.
    insert into public.os_pontos
      (os_id, ponto_id, tipo, numero, area, forma_iscagem, tipo_isca, modelo_armadilha,
       material, quantidade, quantidade_telas, codigo_filtro, btu, marca, numero_serie, capacidade_litros,
       ultima_troca_lampada, ultima_limpeza, situacao, observacao_fixa)
    select v_os, null, p.tipo, p.numero, p.area, p.forma_iscagem, p.tipo_isca,
           p.modelo_armadilha, p.material, p.quantidade, p.quantidade_telas, p.codigo_filtro,
           p.btu, p.marca, p.numero_serie, p.capacidade_litros,
           p.ultima_troca_lampada, p.ultima_limpeza,
           case
             when p.tipo <> 'porta_isca' then null
             when p.tipo_isca = 'CO' then 'M'
             else 'MS'
           end,
           p.observacao_fixa
      from public.os_pontos p
     where p.os_id = p_origem;

    v_total := v_total + 1;
  end loop;
  return v_total;
end
$$;

create or replace function privado.pendencias_os(p_os uuid)
returns text[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  e          public.os_execucao;
  v_form     public.formulario_os;
  v_fotos    boolean;
  falta      text[] := '{}';
  v_faltando text;
  v_item       text;
  v_ocorrencia text;
begin
  select * into e from public.os_execucao where os_id = p_os;
  select t.formulario_os, t.fotos_antes_depois, nullif(trim(s.ocorrencia), '')
    into v_form, v_fotos, v_ocorrencia
    from public.ordens_servico s join public.tipos_servico t on t.id = s.tipo_servico_id
   where s.id = p_os;

  if e.data is null then falta := array_append(falta, 'data'); end if;
  if e.hora_chegada is null then falta := array_append(falta, 'horário de chegada'); end if;
  if e.hora_inicio is null then falta := array_append(falta, 'horário de início'); end if;
  if e.hora_termino is null then falta := array_append(falta, 'horário de término'); end if;
  if e.hora_saida is null then falta := array_append(falta, 'horário de saída'); end if;
  if v_form in ('generico', 'pragas_simples') and nullif(trim(e.resultado), '') is null then
    falta := array_append(falta, 'resultado do serviço');
  end if;
  if nullif(trim(e.operador_nome), '') is null then falta := array_append(falta, 'nome do operador'); end if;
  if e.assinatura_operador_id is null then falta := array_append(falta, 'visto do operador'); end if;
  -- Quem acompanhou: nome, setor e assinatura, a não ser que ninguém tenha acompanhado.
  if not e.sem_acompanhamento then
    if nullif(trim(e.responsavel_nome), '') is null then
      falta := array_append(falta, 'nome de quem acompanhou');
    end if;
    if nullif(trim(e.responsavel_setor), '') is null then
      falta := array_append(falta, 'setor de quem acompanhou');
    end if;
    if e.assinatura_cliente_id is null then
      falta := array_append(falta, 'assinatura de quem acompanhou');
    end if;
  end if;

  -- Ocorrência do escritório: o técnico confirma que resolveu.
  if v_ocorrencia is not null and not e.ocorrencia_resolvida then
    falta := array_append(falta, 'confirmação da ocorrência');
  end if;

  if v_form = 'pragas' then
    if coalesce(e.checklist ->> 'nivel_infestacao', '') not in ('B', 'M', 'A') then
      falta := array_append(falta, 'nível de infestação de roedores');
    end if;
    select string_agg(numero::text, ', ' order by numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo = 'armadilha_luminosa' and situacao_armadilha is null;
    if v_faltando is not null then
      falta := array_append(falta, 'situação das armadilhas ' || v_faltando);
    end if;
    -- Captura de cada espécie em cada armadilha (0 quando não pegou nada).
    select string_agg(numero::text, ', ' order by numero) into v_faltando
      from public.os_pontos p
     where p.os_id = p_os and p.tipo = 'armadilha_luminosa'
       and exists (
         select 1 from unnest(array['M', 'MQ', 'MA', 'B']) k
          where jsonb_typeof(coalesce(p.capturas, '{}') -> k) is distinct from 'number');
    if v_faltando is not null then
      falta := array_append(falta, 'capturas das armadilhas ' || v_faltando);
    end if;
  end if;

  if v_form = 'coifa' then
    -- Cada pergunta da liberação para trabalho precisa de resposta (sim ou não).
    foreach v_item in array array[
      'area_isolada', 'producao_livre', 'pintada', 'risco_pintura', 'equipamentos_desligados',
      'motor_desligado', 'gas_fechado'] loop
      if jsonb_typeof(e.checklist -> 'liberacao' -> v_item -> 'sim') is distinct from 'boolean' then
        falta := array_append(falta, 'liberação para trabalho');
        exit;
      end if;
    end loop;
    if coalesce(e.checklist -> 'liberacao' ->> 'condicoes', '') not in ('LE', 'LR', 'LI') then
      falta := array_append(falta, 'condições do ambiente');
    end if;
    if coalesce(e.checklist -> 'liberacao' ->> 'escoamento', '') not in ('eficiente', 'regular', 'ineficiente') then
      falta := array_append(falta, 'escoamento do piso');
    end if;
    select string_agg(area, ', ' order by numero) into v_faltando
      from public.os_pontos where os_id = p_os and tipo = 'coifa' and sujidade is null;
    if v_faltando is not null then
      falta := array_append(falta, 'sujidade de: ' || v_faltando);
    end if;
    if jsonb_typeof(e.checklist -> 'produto_ml') is distinct from 'number' then
      falta := array_append(falta, 'quantidade de produto');
    end if;
    foreach v_item in array array['limpeza_eficiente', 'equipamentos_religados', 'ambiente_liberado'] loop
      if jsonb_typeof(e.checklist -> 'conferencia' -> v_item -> 'sim') is distinct from 'boolean' then
        falta := array_append(falta, 'conferência final com o cliente');
        exit;
      end if;
    end loop;
  end if;

  if v_form = 'bebedouro' then
    if coalesce(e.checklist ->> 'trabalho', '') not in ('preventivo', 'corretivo') then
      falta := array_append(falta, 'preventivo ou corretivo');
    end if;
    -- Cada bebedouro precisa de "limpo" sim ou não (não limpo: diga o motivo na obs.).
    select string_agg(area, ', ' order by tipo, numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo in ('bebedouro', 'bebedouro_garrafao') and limpo is null;
    if v_faltando is not null then
      falta := array_append(falta, 'limpeza de: ' || v_faltando);
    end if;
    foreach v_item in array array['todos_limpos', 'danificados'] loop
      if jsonb_typeof(e.checklist -> 'conferencia' -> v_item -> 'sim') is distinct from 'boolean' then
        falta := array_append(falta, 'conferência com o cliente');
        exit;
      end if;
    end loop;
  end if;

  if v_form = 'telas' then
    if jsonb_typeof(e.checklist -> 'autorizado' -> 'sim') is distinct from 'boolean' then
      falta := array_append(falta, 'liberação para instalação de telas');
    end if;
    if jsonb_typeof(e.checklist -> 'instaladas' -> 'sim') is distinct from 'boolean' then
      falta := array_append(falta, 'conferência com o cliente');
    end if;
  end if;

  if v_form = 'agua' then
    if (e.checklist ->> 'procedimento') is distinct from 'true' then
      falta := array_append(falta, 'confirmação do procedimento de coleta');
    end if;
    -- Cada ponto: coletado sim ou não; coletado precisa da hora da coleta.
    select string_agg(area, ', ' order by numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo = 'ponto_coleta'
       and (coletado is null or (coletado and hora_coleta is null));
    if v_faltando is not null then
      falta := array_append(falta, 'coleta de: ' || v_faltando);
    end if;
    if jsonb_typeof(e.checklist -> 'refrigeradas' -> 'sim') is distinct from 'boolean' then
      falta := array_append(falta, 'conservação das amostras');
    end if;
  end if;

  if v_form = 'ar_condicionado' then
    -- Cada aparelho: as três limpezas e as duas fotos respondidas.
    select string_agg(lpad(numero::text, 2, '0'), ', ' order by numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo = 'ar_condicionado'
       and (limpeza_serpentina is null or limpeza_gabinete is null or limpeza_dreno is null
            or foto_etiqueta is null or fotos_limpeza is null);
    if v_faltando is not null then
      falta := array_append(falta, 'ar-condicionado: ' || v_faltando);
    end if;
    if jsonb_typeof(e.checklist -> 'produto_ml') is distinct from 'number' then
      falta := array_append(falta, 'quantidade de produto');
    end if;
  end if;

  if v_form = 'reservatorio' then
    -- Cada reservatório precisa de "limpo" sim ou não (não limpo: diga o motivo na obs.).
    select string_agg(area, ', ' order by numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo = 'reservatorio' and limpo is null;
    if v_faltando is not null then
      falta := array_append(falta, 'reservatórios: ' || v_faltando);
    end if;
  end if;

  -- Serviços de limpeza: pelo menos uma foto de antes e uma de depois.
  if v_fotos then
    if not exists (select 1 from public.arquivos where os_id = p_os and categoria = 'foto_antes') then
      falta := array_append(falta, 'foto antes do serviço');
    end if;
    if not exists (select 1 from public.arquivos where os_id = p_os and categoria = 'foto_depois') then
      falta := array_append(falta, 'foto após o serviço');
    end if;
  end if;
  return falta;
end
$$;

update public.tipos_servico set formulario_os = 'reservatorio' where nome ilike '%reservat%';
