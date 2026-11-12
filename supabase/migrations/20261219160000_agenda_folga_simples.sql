-- =============================================================================
-- Agenda do dia: a folga comum (ex.: domingo), sem trabalhar outro dia e sem
-- descontar das horas em haver.
--
--   folgas_simples   folga comum
--   folgas           folga porque o técnico trabalhará no domingo
--   folgas_horas     folga descontada das horas em haver
--
-- Como as outras: fica só naquele dia e tira o técnico da escala no quadro.
-- =============================================================================

alter table public.agenda_dias add column folgas_simples int[] not null default '{}';

comment on column public.agenda_dias.folgas_simples is 'Folga comum (sem trabalhar outro dia e sem descontar horas).';
