-- =============================================================================
-- OS de entrega de telas (limpeza de coifa industrial — entrega de telas)
--
-- Como na ficha de papel: as coifas do local com a quantidade de telas de cada
-- uma (pontos de controle tipo "coifa" do modelo, como na limpeza de coifa). No
-- celular, o operador responde a liberação ("autorizada a instalação de telas?")
-- e a conferência com o cliente ("instaladas?"), cada uma com sim/não e motivo.
-- Esses campos ficam em os_execucao.checklist, no formato de tipos/telas.ts.
-- O resto de privado.pendencias_os é igual ao de 20261212130000_os_armadilhas_assinatura_rt.sql.
-- Mesma regra no celular: src/features/os/offline/pendencias.ts.
-- =============================================================================

-- Na entrega de telas a coifa não precisa de material (a ficha não pede).
alter table public.pontos_controle drop constraint campos_do_tipo;
alter table public.pontos_controle add constraint campos_do_tipo check (
  (tipo = 'porta_isca' and forma_iscagem is not null and tipo_isca is not null
     and modelo_armadilha is null and material is null)
  or (tipo = 'armadilha_luminosa' and modelo_armadilha is not null
     and forma_iscagem is null and tipo_isca is null and material is null)
  or (tipo = 'coifa'
     and forma_iscagem is null and tipo_isca is null and modelo_armadilha is null)
  or (tipo in ('bebedouro', 'bebedouro_garrafao')
     and forma_iscagem is null and tipo_isca is null and modelo_armadilha is null
     and material is null)
);

-- …mas na limpeza de coifa o material continua obrigatório.
create function privado.antes_salvar_coifa()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.tipo = 'coifa' and new.material is null and not exists (
    select 1 from public.os_modelos m join public.tipos_servico t on t.id = m.tipo_servico_id
     where m.id = new.modelo_id and t.formulario_os = 'telas'
  ) then
    raise exception 'Informe o material da coifa.' using errcode = '23514';
  end if;
  return new;
end
$$;

revoke execute on function privado.antes_salvar_coifa() from public, authenticated;

create trigger antes_salvar_coifa before insert or update of tipo, material on public.pontos_controle
  for each row execute function privado.antes_salvar_coifa();

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

-- O tipo de serviço "Entrega de telas" usa este formulário (cria se ainda não existe).
-- Sem repetição: a entrega não gera vencimento.
insert into public.tipos_servico (nome)
select 'Entrega de telas'
 where not exists (select 1 from public.tipos_servico where nome ilike '%entrega de tela%');

update public.tipos_servico
   set formulario_os = 'telas'
 where nome ilike '%entrega de tela%';
