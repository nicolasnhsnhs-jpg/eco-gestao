-- Recibo com assinatura digital (certificado A1 ICP-Brasil, o mesmo da NFS-e), como o
-- certificado de serviço: marcado, o PDF vai à função "assinatura" e volta assinado.
alter table public.recibos
  add column assinatura_digital boolean not null default false;

comment on column public.recibos.assinatura_digital is
  'O PDF do recibo sai assinado digitalmente (função "assinatura", ação assinar_recibo).';
