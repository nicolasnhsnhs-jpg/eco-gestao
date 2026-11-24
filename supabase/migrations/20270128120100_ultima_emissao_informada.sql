-- =============================================================================
-- Rota de atendimento (pedido de 24/11/2026): ao lado de cada cliente aparece a
-- data da última OS emitida, para o ADM saber quem já recebeu a OS no mês (tem
-- cliente da mesma rota com uma visita por mês e cliente com mais de uma).
--
-- A data sai sozinha das OS do sistema. Quando a OS foi feita por fora (papel,
-- outro sistema), o ADM informa a data à mão: vale a mais recente das duas.
-- =============================================================================

alter table public.os_modelos
  add column ultima_emissao_informada date;

comment on column public.os_modelos.ultima_emissao_informada is
  'Última emissão informada à mão pelo ADM (OS feita fora do sistema).';
