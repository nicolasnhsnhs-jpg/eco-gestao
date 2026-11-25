-- Novos modelos de armadilha luminosa: AL-15, AL-30 e Slip-115 (além de P, M e G).
alter table public.pontos_controle drop constraint pontos_controle_modelo_armadilha_check;
alter table public.pontos_controle add constraint pontos_controle_modelo_armadilha_check
  check (modelo_armadilha in ('P', 'M', 'G', 'AL-15', 'AL-30', 'SLIP-115'));
