-- =============================================================================
-- Corrige "diclocos" (erro de escrita) para "Diclorvós".
--
-- O princípio ativo do controle localizado era digitado à mão na OS. Agora o
-- técnico escolhe o produto da lista (src/features/os/operador/ExecucaoPragas.tsx),
-- e aqui se corrige o que já foi gravado com o erro.
-- =============================================================================

update public.os_insetos
   set principio_ativo = regexp_replace(principio_ativo, '\mdicloc[oó]s\M', 'Diclorvós', 'gi')
 where principio_ativo ~* '\mdicloc[oó]s\M';

update public.os_produtos
   set principio_ativo = regexp_replace(principio_ativo, '\mdicloc[oó]s\M', 'Diclorvós', 'gi')
 where principio_ativo ~* '\mdicloc[oó]s\M';

update public.produtos_certificado
   set principio_ativo = regexp_replace(principio_ativo, '\mdicloc[oó]s\M', 'Diclorvós', 'gi')
 where principio_ativo ~* '\mdicloc[oó]s\M';
