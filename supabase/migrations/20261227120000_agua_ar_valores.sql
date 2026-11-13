-- =============================================================================
-- OS de análise de água e de limpeza de ar-condicionado: valores novos nos enums.
-- Fica numa migration só dele porque o Postgres não deixa usar um valor novo de
-- enum na mesma transação em que ele foi criado.
-- =============================================================================

-- Ponto de coleta de água (reservatório, torneira…) e aparelho de ar-condicionado.
alter type public.tipo_ponto add value if not exists 'ponto_coleta';
alter type public.tipo_ponto add value if not exists 'ar_condicionado';

alter type public.formulario_os add value if not exists 'agua';
alter type public.formulario_os add value if not exists 'ar_condicionado';
