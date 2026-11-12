-- =============================================================================
-- Agenda do dia: dois tipos de folga.
--
--   folgas         folga porque o técnico trabalhará no domingo
--   folgas_horas   folga descontada das horas em haver (banco de horas)
--
-- Como a falta e a outra folga: ficam só naquele dia e tiram o técnico da escala
-- no quadro.
-- =============================================================================

alter table public.agenda_dias add column folgas_horas int[] not null default '{}';

comment on column public.agenda_dias.folgas is 'Folga porque trabalhará no domingo.';
comment on column public.agenda_dias.folgas_horas is 'Folga descontada das horas em haver.';
