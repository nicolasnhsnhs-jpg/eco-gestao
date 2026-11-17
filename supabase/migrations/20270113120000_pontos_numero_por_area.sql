-- =============================================================================
-- Pontos de controle: número repetido em áreas diferentes e armadilha modelo M
--
-- Muitos clientes recomeçam a numeração em cada área (Cozinha 1-5, Saguão 1-10).
-- O número passa a ser único dentro da área (sem diferença de maiúsculas e
-- espaços), e só entre os pontos ativos: um porta-isca retirado não impede de
-- cadastrar outro com o mesmo número.
--
-- Armadilha luminosa ganha o modelo M (além de P branca e G inox).
-- =============================================================================

alter table public.pontos_controle drop constraint um_numero_por_tipo;
create unique index pontos_controle_numero_por_area
  on public.pontos_controle (modelo_id, tipo, lower(btrim(area)), numero)
  where ativo;

alter table public.os_pontos drop constraint um_ponto_por_os;
create unique index os_pontos_numero_por_area
  on public.os_pontos (os_id, tipo, lower(btrim(area)), numero);

alter table public.pontos_controle drop constraint pontos_controle_modelo_armadilha_check;
alter table public.pontos_controle add constraint pontos_controle_modelo_armadilha_check
  check (modelo_armadilha in ('P', 'M', 'G'));
