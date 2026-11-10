-- Agenda do dia: as colunas R e F são a conferência interna do ADM
-- (R = realizado, F = faturado). Viram sim/não; a coluna da câmera continua como marca.
-- Elas não vão na imagem que segue para o grupo dos operadores.

alter table public.agenda_itens
  drop column marca_2,
  drop column marca_3,
  add column realizado boolean not null default false,
  add column faturado boolean not null default false;
