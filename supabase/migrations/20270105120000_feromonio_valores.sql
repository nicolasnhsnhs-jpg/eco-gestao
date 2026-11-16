-- Armadilha adesiva com feromônio e armadilha biológica para moscas: valores novos
-- do enum (migration só deles; usados em 20270105120100_os_feromonio_moscas.sql).
alter type public.tipo_ponto add value if not exists 'feromonio';
alter type public.tipo_ponto add value if not exists 'armadilha_moscas';
