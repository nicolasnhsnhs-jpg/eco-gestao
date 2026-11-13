-- =============================================================================
-- Agenda do dia: anotação da escala operacional.
--
-- Um lembrete livre de quem monta a agenda (ex.: "Gustavo e Victor saíram às
-- 18h30, ficam com horas em haver"). Fica só naquele dia (o dia seguinte não
-- copia) e não aparece no quadro nem na imagem dos operadores.
-- =============================================================================

alter table public.agenda_dias add column nota_escala text not null default '';

comment on column public.agenda_dias.nota_escala is 'Anotação interna da escala do dia (não vai para o quadro).';
