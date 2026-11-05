-- Cancelamento da NFS-e pelo sistema (evento e101101 na Sefin Nacional) e a nota que
-- a corrige: a NFS-e emitida não se edita, cancela-se e emite-se outra.

alter table public.notas_fiscais
  add column cancelada_em            timestamptz,
  add column motivo_cancelamento     text,
  add column arquivo_cancelamento_id uuid references public.arquivos (id) on delete set null,
  add column substitui_nota_id       uuid references public.notas_fiscais (id) on delete set null;

create index notas_fiscais_substitui_idx on public.notas_fiscais (substitui_nota_id);

comment on column public.notas_fiscais.cancelada_em is
  'Quando a NFS-e foi cancelada no Sistema Nacional (pelo sistema).';
comment on column public.notas_fiscais.arquivo_cancelamento_id is
  'XML do evento de cancelamento devolvido pela Sefin.';
comment on column public.notas_fiscais.substitui_nota_id is
  'A nota cancelada que esta corrige ("Corrigir e emitir de novo").';
