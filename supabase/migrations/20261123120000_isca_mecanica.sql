-- =============================================================================
-- Controle de pragas: isca mecânica (MEC) e as situações CAP e Q
--
-- Fichas como a da Naturovos usam porta-isca com armadilha mecânica (ratoeira)
-- e anotam "CAP" (capturado) e "Q" (quebrado), além das situações de sempre.
-- =============================================================================

alter table public.pontos_controle drop constraint pontos_controle_tipo_isca_check;
alter table public.pontos_controle add constraint pontos_controle_tipo_isca_check
  check (tipo_isca in ('IP', 'IG', 'PO', 'MEC', 'CO', 'S'));

alter table public.os_pontos drop constraint os_pontos_situacao_check;
alter table public.os_pontos add constraint os_pontos_situacao_check check (situacao in (
  'MS', 'MC', 'CT', 'IN', 'CAP', 'Q', 'DT', 'SA', 'NE', 'M', 'SC', 'I', 'T'));

alter table public.os_pontos drop constraint situacao_do_tipo;
alter table public.os_pontos add constraint situacao_do_tipo check (
  situacao is null
  or (tipo_isca = 'CO' and situacao in ('M', 'SC', 'I', 'T', 'SA', 'NE'))
  or (tipo_isca <> 'CO' and situacao in ('MS', 'MC', 'CT', 'IN', 'CAP', 'Q', 'DT', 'SA', 'NE'))
);
