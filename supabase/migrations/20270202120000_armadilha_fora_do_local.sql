-- =============================================================================
-- Armadilha luminosa "Não está no local" (pedido de 25/11/2026).
--
-- O técnico chega e a armadilha não está lá (retirada pelo cliente, obra…). Ele marca
-- "Não está no local" (situacao_armadilha = 'NL'): situação, refil, lâmpadas, higiene
-- e capturas deixam de ser pedidas, e a observação passa a ser obrigatória.
-- O resto de privado.pendencias_os é igual ao de 20270201120000_os_ninguem_para_assinar.sql.
-- Mesma regra no celular: src/features/os/offline/pendencias.ts.
-- =============================================================================

alter table public.os_pontos drop constraint os_pontos_situacao_armadilha_check;
alter table public.os_pontos add constraint os_pontos_situacao_armadilha_check
  check (situacao_armadilha in ('F', 'D', 'DL', 'LT', 'NL'));

create or replace function privado.pendencias_os(p_os uuid)
returns text[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  e          public.os_execucao;
  v_form     public.formulario_os;
  v_fotos    boolean;
  v_residuo  boolean;
  v_qtd      numeric;
  falta      text[] := '{}';
  v_faltando text;
  v_item       text;
  v_subtipo    text;
begin
  select * into e from public.os_execucao where os_id = p_os;
  select t.formulario_os, t.fotos_antes_depois, t.registra_residuo,
         s.escopo ->> 'subtipo'
    into v_form, v_fotos, v_residuo, v_subtipo
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
  -- Quem acompanhou: nome, setor e assinatura. Sem acompanhamento, só a assinatura de
  -- quem recebeu na saída, a não ser que não haja ninguém para assinar.
  if e.sem_acompanhamento then
    if not e.ninguem_para_assinar and e.assinatura_cliente_id is null then
      falta := array_append(falta, 'assinatura de quem recebeu');
    end if;
  else
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

  -- Ocorrências do escritório: o técnico responde cada uma (sanado ou reforço).
  if exists (
    select 1 from public.os_ocorrencias l
     where l.os_id = p_os
       and coalesce(e.ocorrencias_resultado ->> l.ocorrencia_id::text, '') not in ('sanado', 'reforco')
  ) then
    falta := array_append(falta, 'confirmação da ocorrência');
  end if;

  if v_form = 'pragas' then
    if coalesce(e.checklist ->> 'nivel_infestacao', '') not in ('B', 'M', 'A') then
      falta := array_append(falta, 'nível de infestação de roedores');
    end if;
    if v_subtipo = 'insetos_roedores'
       and jsonb_typeof(e.checklist -> 'monitoramento_insetos') is distinct from 'boolean' then
      falta := array_append(falta, 'monitoramento de insetos (realizado ou não)');
    end if;
    select string_agg(numero::text, ', ' order by numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo = 'armadilha_luminosa' and situacao_armadilha is null;
    if v_faltando is not null then
      falta := array_append(falta, 'situação das armadilhas ' || v_faltando);
    end if;
    -- Captura de cada espécie em cada armadilha (0 quando não pegou nada). A que não
    -- está no local (NL) não tem captura: pede só a observação (ex.: "retirada").
    select string_agg(numero::text, ', ' order by numero) into v_faltando
      from public.os_pontos p
     where p.os_id = p_os and p.tipo = 'armadilha_luminosa'
       and p.situacao_armadilha is distinct from 'NL'
       and exists (
         select 1 from unnest(array['M', 'MQ', 'MA', 'B']) k
          where jsonb_typeof(coalesce(p.capturas, '{}') -> k) is distinct from 'number');
    if v_faltando is not null then
      falta := array_append(falta, 'capturas das armadilhas ' || v_faltando);
    end if;
    select string_agg(numero::text, ', ' order by numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo = 'armadilha_luminosa' and situacao_armadilha = 'NL'
       and nullif(btrim(observacao), '') is null;
    if v_faltando is not null then
      falta := array_append(falta, 'observação das armadilhas fora do local ' || v_faltando);
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
    -- O técnico diz onde coletou: pelo menos um ponto coletado.
    if not exists (
      select 1 from public.os_pontos
       where os_id = p_os and tipo = 'ponto_coleta' and coletado
    ) then
      falta := array_append(falta, 'ponto de coleta (onde foi coletado)');
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

  -- Sucção: quantidade sugada (m³, maior que zero) e o código do resíduo.
  if v_residuo then
    v_qtd := null;
    if jsonb_typeof(e.checklist -> 'residuo' -> 'quantidade_m3') = 'number' then
      v_qtd := (e.checklist -> 'residuo' ->> 'quantidade_m3')::numeric;
    end if;
    if v_qtd is null or v_qtd <= 0 then
      falta := array_append(falta, 'quantidade sugada');
    end if;
    if coalesce(e.checklist -> 'residuo' ->> 'codigo', '') not in ('200125', '200304', '200301', '190809') then
      falta := array_append(falta, 'tipo de resíduo sugado');
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
