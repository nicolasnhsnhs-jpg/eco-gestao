-- =============================================================================
-- Armadilha luminosa: data da última troca de lâmpada e observação fixas.
--
-- Os dois ficam na própria armadilha (pontos_controle) e vão para cada OS nova:
--   ultima_troca_lampada  o escritório pode corrigir; ao concluir uma OS com
--                         lâmpada trocada (ou situação LT), passa a ser a data dela
--   observacao_fixa       escrita pelo escritório; aparece em toda OS até mudar
-- Antes a data era calculada só pelo histórico das OS; agora o histórico serve
-- para preencher a data uma vez (abaixo) e o gatilho mantém em dia.
-- O resto de copiar_pontos_os e criar_treinamento_os é igual ao de
-- 20261227120100_os_agua_ar_condicionado.sql.
-- =============================================================================

alter table public.pontos_controle
  add column ultima_troca_lampada date,
  add column observacao_fixa      text check (char_length(observacao_fixa) <= 500);

alter table public.os_pontos add column observacao_fixa text;

grant update (ultima_troca_lampada, observacao_fixa) on public.pontos_controle to authenticated;

-- Preenche a data de cada armadilha com a última troca registrada nas OS.
update public.pontos_controle p
   set ultima_troca_lampada = h.data
  from (select ant.ponto_id, max(e.data) as data
          from public.os_pontos ant
          join public.os_execucao e on e.os_id = ant.os_id
          join public.ordens_servico s on s.id = ant.os_id
         where s.status in ('concluida', 'conferida')
           and (ant.lampadas_trocadas or ant.situacao_armadilha = 'LT')
         group by ant.ponto_id) h
 where h.ponto_id = p.id;

-- OS concluída com troca de lâmpada: a armadilha guarda a data (nunca volta para trás).
create function privado.fixar_troca_lampada()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.pontos_controle p
     set ultima_troca_lampada = greatest(p.ultima_troca_lampada, e.data)
    from public.os_pontos op
    join public.os_execucao e on e.os_id = op.os_id
   where op.os_id = new.id and op.ponto_id = p.id and e.data is not null
     and (op.lampadas_trocadas or op.situacao_armadilha = 'LT');
  return null;
end
$$;

create trigger fixar_troca_lampada
  after update of status on public.ordens_servico
  for each row
  when (new.status = 'concluida' and old.status is distinct from new.status)
  execute function privado.fixar_troca_lampada();

-- A OS recebe a data e a observação fixas da armadilha.
create or replace function privado.copiar_pontos_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.os_pontos where os_id = p_os;
  insert into public.os_pontos
    (os_id, ponto_id, tipo, numero, area, forma_iscagem, tipo_isca, modelo_armadilha,
     material, quantidade, quantidade_telas, codigo_filtro, btu, marca, numero_serie,
     ultima_troca_lampada, ultima_limpeza, situacao, observacao_fixa)
  select p_os, p.id, p.tipo, p.numero, p.area, p.forma_iscagem, p.tipo_isca, p.modelo_armadilha,
         p.material, p.quantidade, p.quantidade_telas, p.codigo_filtro, p.btu, p.marca,
         p.numero_serie,
         p.ultima_troca_lampada,
         case when p.tipo in ('bebedouro', 'bebedouro_garrafao', 'ponto_coleta', 'ar_condicionado') then
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

-- O treinamento copia a observação fixa junto.
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
       material, quantidade, quantidade_telas, codigo_filtro, btu, marca, numero_serie,
       ultima_troca_lampada, ultima_limpeza, situacao, observacao_fixa)
    select v_os, null, p.tipo, p.numero, p.area, p.forma_iscagem, p.tipo_isca,
           p.modelo_armadilha, p.material, p.quantidade, p.quantidade_telas, p.codigo_filtro,
           p.btu, p.marca, p.numero_serie,
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

