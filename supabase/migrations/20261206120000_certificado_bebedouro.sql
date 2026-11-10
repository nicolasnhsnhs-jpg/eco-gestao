-- Certificados: modelo de limpeza de bebedouros (azul, lista dos bebedouros e produtos).
alter table public.certificados drop constraint if exists certificados_modelo_check;
alter table public.certificados
  add constraint certificados_modelo_check
  check (modelo in ('pragas', 'reservatorio', 'bebedouro', 'coifa', 'succao', 'geral'));
