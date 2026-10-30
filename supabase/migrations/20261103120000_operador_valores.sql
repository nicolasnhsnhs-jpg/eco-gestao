-- =============================================================================
-- Ordens de Serviço (OS-1): valores novos nos tipos existentes
-- Ficam numa migration só deles porque o Postgres não deixa usar um valor novo
-- de enum na mesma transação em que ele foi criado.
-- =============================================================================

-- Quem executa os serviços em campo.
alter type public.papel add value if not exists 'operador';

-- Fotos tiradas em campo e assinaturas capturadas na tela.
alter type public.categoria_arquivo add value if not exists 'foto_os';
alter type public.categoria_arquivo add value if not exists 'assinatura';
