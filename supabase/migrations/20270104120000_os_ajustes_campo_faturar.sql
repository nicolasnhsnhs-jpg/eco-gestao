-- =============================================================================
-- Ajustes pedidos em 16/11/2026:
--
-- 1. Produtos da OS em mL: além de unidades e gramas, o técnico anota mililitros
--    (inseticida líquido). Nova forma "Líquido (pulverização)".
-- 2. Reservatórios: "Realização com chuva" (sim/não) em cada caixa do cadastro.
--    Vai junto para a OS (os_pontos) e para o treinamento, como a capacidade.
--    As funções copiar_pontos_os e criar_treinamento_os são iguais às de
--    20270103120100_os_reservatorios.sql, com a coluna nova.
-- 3. "OK para o financeiro": ao conferir a OS o escritório libera o serviço para
--    faturar (os_conferencia.liberada_financeiro_em). A aba "A faturar" do
--    financeiro lista as liberadas que ainda não foram faturadas (taxa_faturada).
--    Uma OS já conferida também pode ser liberada (conferir de novo só libera).
-- =============================================================================

-- 1. Produtos em mL ------------------------------------------------------------

alter table public.os_produtos add column ml numeric(10, 2) check (ml >= 0);

alter table public.os_produtos drop constraint os_produtos_forma_check;
alter table public.os_produtos add constraint os_produtos_forma_check
  check (forma in ('bloco', 'semente', 'granulada', 'po', 'placa', 'liquido', 'outro'));

-- 2. Reservatório com chuva ----------------------------------------------------

alter table public.pontos_controle add column com_chuva boolean;
alter table public.os_pontos add column com_chuva boolean;
grant update (com_chuva) on public.pontos_controle to authenticated;

comment on column public.pontos_controle.com_chuva is
  'Reservatório: dá para fazer a limpeza com chuva? (null = não informado)';

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
     com_chuva, ultima_troca_lampada, ultima_limpeza, situacao, observacao_fixa)
  select p_os, p.id, p.tipo, p.numero, p.area, p.forma_iscagem, p.tipo_isca, p.modelo_armadilha,
         p.material, p.quantidade, p.quantidade_telas, p.codigo_filtro, p.btu, p.marca,
         p.numero_serie, p.capacidade_litros, p.com_chuva,
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
       com_chuva, ultima_troca_lampada, ultima_limpeza, situacao, observacao_fixa)
    select v_os, null, p.tipo, p.numero, p.area, p.forma_iscagem, p.tipo_isca,
           p.modelo_armadilha, p.material, p.quantidade, p.quantidade_telas, p.codigo_filtro,
           p.btu, p.marca, p.numero_serie, p.capacidade_litros, p.com_chuva,
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

-- 3. OK para o financeiro ------------------------------------------------------

alter table public.os_conferencia
  add column liberada_financeiro_em timestamptz,
  add column liberada_financeiro_por uuid references public.perfis (id);

create index os_conferencia_a_faturar_idx on public.os_conferencia (liberada_financeiro_em)
  where liberada_financeiro_em is not null and taxa_faturada is not true;

comment on column public.os_conferencia.liberada_financeiro_em is
  'Quando o escritório deu o OK para o financeiro faturar o serviço.';

create or replace function privado.conferir_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.pode_gerir_os() then
    raise exception 'Somente o escritório confere a OS.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.ordens_servico where id = p_os and status in ('concluida', 'conferida')
  ) then
    raise exception 'Só dá para conferir uma OS concluída pelo operador.' using errcode = '23514';
  end if;
  perform set_config('app.os_transicao', 'sim', true);
  update public.ordens_servico set status = 'conferida' where id = p_os and status = 'concluida';
  perform set_config('app.os_transicao', '', true);
  update public.os_conferencia
     set liberada_financeiro_em = coalesce(liberada_financeiro_em, now()),
         liberada_financeiro_por = coalesce(liberada_financeiro_por, (select auth.uid()))
   where os_id = p_os;
end
$$;
