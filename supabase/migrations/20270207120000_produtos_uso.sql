-- Para que serve cada produto do catálogo: separa a lista que o técnico vê na OS
-- (a lista inteira ficou longa demais para escolher no celular).
--   ambos    → roedores e insetos (aparece nas duas listas)
--   roedores → só no controle de roedores
--   insetos  → só no controle de insetos
--   outros   → outros serviços (ex.: Clorin e DET da limpeza de reservatório e coifa);
--              não aparece nas OS de pragas
-- A emissão de certificado continua com todos os produtos.

alter table public.produtos_certificado
  add column uso text not null default 'ambos'
    check (uso in ('ambos', 'roedores', 'insetos', 'outros'));

comment on column public.produtos_certificado.uso is
  'Onde o produto aparece na OS: ambos, roedores, insetos ou outros (outros serviços).';
