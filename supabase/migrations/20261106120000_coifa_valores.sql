-- =============================================================================
-- Ordens de Serviço (OS-4): valor novo no tipo de ponto de controle.
-- Fica numa migration só dele porque o Postgres não deixa usar um valor novo de
-- enum na mesma transação em que ele foi criado.
-- =============================================================================

alter type public.tipo_ponto add value if not exists 'coifa';
