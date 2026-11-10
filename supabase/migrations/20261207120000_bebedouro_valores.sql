-- =============================================================================
-- OS de limpeza de bebedouros: valores novos nos enums.
-- Fica numa migration só dele porque o Postgres não deixa usar um valor novo de
-- enum na mesma transação em que ele foi criado.
-- =============================================================================

-- Bebedouro industrial (com filtro) e bebedouro de garrafão: cada um tem a sua
-- numeração de etiqueta (os dois começam em 01 na ficha).
alter type public.tipo_ponto add value if not exists 'bebedouro';
alter type public.tipo_ponto add value if not exists 'bebedouro_garrafao';

alter type public.formulario_os add value if not exists 'bebedouro';
