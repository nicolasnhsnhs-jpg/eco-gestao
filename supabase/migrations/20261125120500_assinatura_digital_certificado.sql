-- Assinatura digital (certificado A1 ICP-Brasil) no PDF do certificado.
-- Alguns clientes pedem o certificado assinado digitalmente. Marcado, o PDF sai assinado
-- pela Edge Function "assinatura", com o mesmo certificado da NFS-e (segredos
-- NFSE_CERTIFICADO e NFSE_SENHA); o arquivo nunca vem para o navegador.

alter table public.certificados
  add column assinatura_digital boolean not null default false;

comment on column public.certificados.assinatura_digital is
  'O PDF sai assinado com o certificado digital A1 (o mesmo da NFS-e).';

grant insert (assinatura_digital) on public.certificados to authenticated;
grant update (assinatura_digital) on public.certificados to authenticated;
