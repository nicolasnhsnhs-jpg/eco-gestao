-- =============================================================================
-- Correção (23/11/2026): a aba "E-mails enviados" ficou vazia desde 19/11 nos três
-- setores. A coluna de busca de emails_enviados usa privado.sem_acento, e o servidor
-- (service_role, que grava o registro depois de mandar o e-mail) não podia executar
-- essa função: toda gravação dava "permission denied for function sem_acento" e o
-- erro só ia para o log (o e-mail em si saía normalmente).
--
-- Libera a função para o servidor. Vale também para qualquer outra gravação do
-- servidor em tabelas com coluna de busca sem acento.
-- =============================================================================

grant usage on schema privado to service_role;
grant execute on function privado.sem_acento(text) to service_role;
