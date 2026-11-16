-- =============================================================================
-- Controle de pragas: pontos novos pedidos com as fichas da Neovia (16/11/2026).
--
-- 1. feromonio: armadilha adesiva com feromônio e atrativo alimentar (pragas de
--    cereais). Do cadastro: localização e a data da última troca (guardada em
--    ultima_troca_lampada, a mesma coluna da "última troca" da luminosa). Na visita:
--    situação da armadilha (refil M/T/I), higiene (S/R/I), quantidade capturada
--    (capturas -> 'qtd') e a(s) praga(s) identificada(s) (observacao).
--    Trocada (T) numa OS concluída: a data da troca passa a ser a da OS.
-- 2. armadilha_moscas: armadilha biológica para captura de moscas. Na visita:
--    situação do refil (refil), condições de higiene (higiene), nível de
--    infestação (nivel, novo: B/M/A) e observação.
-- 3. Porta-isca com ratoeira T-rex (tipo de isca TR). Usa as mesmas situações das
--    iscas (CAP = capturado), como a mecânica.
-- =============================================================================

alter table public.pontos_controle drop constraint campos_do_tipo;
alter table public.pontos_controle add constraint campos_do_tipo check (
  (tipo = 'porta_isca' and forma_iscagem is not null and tipo_isca is not null
     and modelo_armadilha is null and material is null)
  or (tipo = 'armadilha_luminosa' and modelo_armadilha is not null
     and forma_iscagem is null and tipo_isca is null and material is null)
  or (tipo = 'coifa'
     and forma_iscagem is null and tipo_isca is null and modelo_armadilha is null)
  or (tipo in ('bebedouro', 'bebedouro_garrafao', 'ponto_coleta', 'ar_condicionado',
               'reservatorio', 'feromonio', 'armadilha_moscas')
     and forma_iscagem is null and tipo_isca is null and modelo_armadilha is null
     and material is null)
);

alter table public.pontos_controle drop constraint pontos_controle_tipo_isca_check;
alter table public.pontos_controle add constraint pontos_controle_tipo_isca_check
  check (tipo_isca in ('IP', 'IG', 'PO', 'MEC', 'TR', 'CO', 'S'));

alter table public.os_pontos add column nivel text check (nivel in ('B', 'M', 'A'));
grant update (nivel) on public.os_pontos to authenticated;

comment on column public.os_pontos.nivel is 'Armadilha biológica de moscas: nível de infestação.';

-- OS concluída com troca de lâmpada (luminosa) ou com a armadilha de feromônio
-- trocada: o ponto guarda a data (nunca volta para trás).
create or replace function privado.fixar_troca_lampada()
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
     and (op.lampadas_trocadas or op.situacao_armadilha = 'LT'
          or (op.tipo = 'feromonio' and op.refil = 'T'));
  return null;
end
$$;
