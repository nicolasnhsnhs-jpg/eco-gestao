-- =============================================================================
-- OS de limpeza (tipo de serviço com "fotos de antes e depois"): só conclui com
-- pelo menos uma foto de antes e uma de depois. Controle de pragas e os outros
-- serviços sem essa opção continuam sem foto obrigatória.
-- Mesma regra no celular: src/features/os/offline/pendencias.ts.
-- =============================================================================

-- O que falta para concluir: comum + pragas + coifa + fotos das limpezas.
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
  v_item     text;
begin
  select * into e from public.os_execucao where os_id = p_os;
  select t.formulario_os, t.fotos_antes_depois into v_form, v_fotos
    from public.ordens_servico s join public.tipos_servico t on t.id = s.tipo_servico_id
   where s.id = p_os;

  if e.data is null then falta := array_append(falta, 'data'); end if;
  if e.hora_chegada is null then falta := array_append(falta, 'horário de chegada'); end if;
  if e.hora_inicio is null then falta := array_append(falta, 'horário de início'); end if;
  if e.hora_termino is null then falta := array_append(falta, 'horário de término'); end if;
  if e.hora_saida is null then falta := array_append(falta, 'horário de saída'); end if;
  if v_form = 'generico' and nullif(trim(e.resultado), '') is null then
    falta := array_append(falta, 'resultado do serviço');
  end if;
  if nullif(trim(e.operador_nome), '') is null then falta := array_append(falta, 'nome do operador'); end if;
  if e.assinatura_operador_id is null then falta := array_append(falta, 'visto do operador'); end if;
  if nullif(trim(e.responsavel_nome), '') is null then
    falta := array_append(falta, 'nome de quem acompanhou');
  end if;
  if e.assinatura_cliente_id is null then
    falta := array_append(falta, 'assinatura de quem acompanhou');
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
