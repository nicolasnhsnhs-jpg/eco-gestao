-- =============================================================================
-- OS de entrega de telas: valor novo no enum de formulário.
-- Fica numa migration só dele porque o Postgres não deixa usar um valor novo de
-- enum na mesma transação em que ele foi criado.
-- =============================================================================

alter type public.formulario_os add value if not exists 'telas';
