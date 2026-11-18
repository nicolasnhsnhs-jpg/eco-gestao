-- =============================================================================
-- Pontos novos numa OS já em execução.
--
-- O escritório precisa às vezes cadastrar um ponto com o técnico em campo (ex.:
-- uma armadilha luminosa nova na Naturovos). Antes da execução, a OS recopia todos
-- os pontos do modelo (copiar_pontos_os apaga e copia de novo). Depois que começou,
-- isso apagaria o que o técnico já anotou; então, em execução, só ENTRAM os pontos
-- do modelo que a OS ainda não tem. Os que já estão nela ficam como estão.
-- O celular do técnico recebe o ponto novo quando atualizar (com sinal).
--
-- O ponto que entra assim fica marcado (incluido_na_execucao): o celular avisa o
-- técnico "o escritório incluiu ponto novo nesta OS".
--
-- O insert é o mesmo de 20270107120000_proposta_texto_prazos_limpeza.sql.
-- =============================================================================

alter table public.os_pontos
  add column if not exists incluido_na_execucao boolean not null default false;

create or replace function privado.inserir_pontos_os(p_os uuid, p_so_novos boolean)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  insert into public.os_pontos
    (os_id, ponto_id, tipo, numero, area, forma_iscagem, tipo_isca, modelo_armadilha,
     material, quantidade, quantidade_telas, codigo_filtro, btu, marca, numero_serie, capacidade_litros,
     com_chuva, ultima_troca_lampada, ultima_limpeza, situacao, observacao_fixa,
     incluido_na_execucao)
  select p_os, p.id, p.tipo, p.numero, p.area, p.forma_iscagem, p.tipo_isca, p.modelo_armadilha,
         p.material, p.quantidade, p.quantidade_telas, p.codigo_filtro, p.btu, p.marca,
         p.numero_serie, p.capacidade_litros, p.com_chuva,
         p.ultima_troca_lampada,
         case when p.tipo in ('bebedouro', 'bebedouro_garrafao', 'ponto_coleta', 'ar_condicionado', 'reservatorio') then
           greatest(
             p.limpeza_informada,
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
                     end))
         end,
         case
           when p.tipo <> 'porta_isca' then null
           when p.tipo_isca = 'CO' then 'M'
           else 'MS'
         end,
         p.observacao_fixa,
         p_so_novos
    from public.pontos_controle p
    join public.ordens_servico s on s.id = p_os and s.modelo_id = p.modelo_id
   where p.ativo
     and (not p_so_novos or not exists (
       select 1 from public.os_pontos o where o.os_id = p_os and o.ponto_id = p.id
     ))
  -- Mesmo tipo, área e número de um ponto que já está na OS: fica o que já está.
  on conflict do nothing;
  get diagnostics v_total = row_count;
  return v_total;
end
$$;

revoke execute on function privado.inserir_pontos_os(uuid, boolean) from public;

create or replace function privado.copiar_pontos_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.os_pontos where os_id = p_os;
  perform privado.inserir_pontos_os(p_os, false);
end
$$;

-- O escritório mudou os pontos do modelo: antes de começar, a OS acompanha tudo;
-- em execução, só ganha os pontos novos.
create or replace function privado.atualizar_pontos_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status public.status_os;
begin
  if not privado.pode_gerir_os() then
    raise exception 'Somente o escritório altera os pontos da OS.' using errcode = '42501';
  end if;
  select status into v_status from public.ordens_servico where id = p_os;
  if v_status in ('rascunho', 'agendada') then
    perform privado.copiar_pontos_os(p_os);
  elsif v_status = 'em_execucao' then
    perform privado.inserir_pontos_os(p_os, true);
  else
    raise exception 'Esta OS já foi concluída: os pontos dela não mudam mais.'
      using errcode = '23514';
  end if;
end
$$;
