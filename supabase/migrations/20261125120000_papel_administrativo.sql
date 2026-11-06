-- =============================================================================
-- Novo perfil "ADM" (setor administrativo / agendamentos).
-- Nome interno: "administrativo" (não confundir com "admin", o Administrador).
-- O valor novo do tipo fica num arquivo só dele: o Postgres não deixa usar um
-- valor de enum na mesma transação em que ele foi criado.
-- As permissões estão no arquivo seguinte (20261125120100_permissoes_administrativo).
-- =============================================================================

alter type public.papel add value if not exists 'administrativo';
