-- Substituição da NFS-e pelo sistema: o rascunho que substitui uma nota emitida leva o
-- motivo, e a DPS sai com o grupo subst (chave da substituída). A Sefin Nacional registra
-- sozinha o cancelamento por substituição (evento e105102) da nota antiga, que no portal
-- aparece como substituída.

alter table public.notas_fiscais
  add column motivo_substituicao        text check (motivo_substituicao in ('01', '02', '03', '04', '05', '99')),
  add column justificativa_substituicao text;

comment on column public.notas_fiscais.motivo_substituicao is
  'cMotivo da substituição (01 a 05 ou 99). Preenchido = a emissão substitui a nota de substitui_nota_id.';
comment on column public.notas_fiscais.justificativa_substituicao is
  'xMotivo da substituição, que vai para o governo (15 a 255 letras).';
