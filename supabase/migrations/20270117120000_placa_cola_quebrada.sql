-- =============================================================================
-- Porta-cola (placa de cola, tipo_isca CO): passa a aceitar "Q · Quebrado",
-- como as iscas. Igual a 20261123120000_isca_mecanica.sql, com o Q na placa.
-- Mesma lista no celular: SITUACOES_PLACA em src/features/os/tipos/pragas.ts.
-- =============================================================================

alter table public.os_pontos drop constraint situacao_do_tipo;
alter table public.os_pontos add constraint situacao_do_tipo check (
  situacao is null
  or (tipo_isca = 'CO' and situacao in ('M', 'SC', 'I', 'T', 'Q', 'SA', 'NE'))
  or (tipo_isca <> 'CO' and situacao in ('MS', 'MC', 'CT', 'IN', 'CAP', 'Q', 'DT', 'SA', 'NE'))
);
