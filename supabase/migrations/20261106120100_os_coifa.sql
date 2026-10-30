-- =============================================================================
-- Ordens de Serviço (OS-4): limpeza de coifa
--
-- As coifas do local são pontos de controle do modelo (tipo "coifa"), como os
-- porta-iscas: cada uma tem id permanente e histórico de sujidade por visita.
-- Os campos "planos" (liberação para trabalho, telas, produto, conferência com o
-- cliente) ficam em os_execucao.checklist, com o formato definido no código.
-- =============================================================================

alter table public.pontos_controle
  add column material         text check (material in ('galvanizado', 'inox', 'aluminio')),
  add column quantidade       smallint check (quantidade between 1 and 99),
  add column quantidade_telas smallint check (quantidade_telas between 0 and 99);

alter table public.pontos_controle drop constraint campos_do_tipo;
alter table public.pontos_controle add constraint campos_do_tipo check (
  (tipo = 'porta_isca' and forma_iscagem is not null and tipo_isca is not null
     and modelo_armadilha is null and material is null)
  or (tipo = 'armadilha_luminosa' and modelo_armadilha is not null
     and forma_iscagem is null and tipo_isca is null and material is null)
  or (tipo = 'coifa' and material is not null
     and forma_iscagem is null and tipo_isca is null and modelo_armadilha is null)
);

alter table public.os_pontos
  add column material         text,
  add column quantidade       smallint,
  add column quantidade_telas smallint,
  -- Execução da coifa: nível de sujidade (B baixo, M médio, A alto) e foto antes.
  add column sujidade         text check (sujidade in ('B', 'M', 'A')),
  add column foto_antes       boolean;

grant update (material, quantidade, quantidade_telas) on public.pontos_controle to authenticated;
grant update (sujidade, foto_antes) on public.os_pontos to authenticated;

-- A cópia dos pontos leva também os dados da coifa.
create or replace function privado.copiar_pontos_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.os_pontos where os_id = p_os;
  insert into public.os_pontos
    (os_id, ponto_id, tipo, numero, area, forma_iscagem, tipo_isca, modelo_armadilha,
     material, quantidade, quantidade_telas, ultima_troca_lampada, situacao)
  select p_os, p.id, p.tipo, p.numero, p.area, p.forma_iscagem, p.tipo_isca, p.modelo_armadilha,
         p.material, p.quantidade, p.quantidade_telas,
         (select max(e.data)
            from public.os_pontos ant
            join public.os_execucao e on e.os_id = ant.os_id
            join public.ordens_servico s on s.id = ant.os_id
           where ant.ponto_id = p.id and ant.os_id <> p_os
             and s.status in ('concluida', 'conferida')
             and (ant.lampadas_trocadas or ant.situacao_armadilha = 'LT')),
         case
           when p.tipo <> 'porta_isca' then null
           when p.tipo_isca = 'CO' then 'M'
           else 'MS'
         end
    from public.pontos_controle p
    join public.ordens_servico s on s.id = p_os and s.modelo_id = p.modelo_id
   where p.ativo;
end
$$;

-- O que falta para concluir: comum + pragas + coifa.
create or replace function privado.pendencias_os(p_os uuid)
returns text[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  e          public.os_execucao;
  v_form     public.formulario_os;
  falta      text[] := '{}';
  v_faltando text;
  v_item     text;
begin
  select * into e from public.os_execucao where os_id = p_os;
  select t.formulario_os into v_form
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
  return falta;
end
$$;
