-- Boleto da nota: o financeiro anexa (no rascunho ou depois de emitir) e ele segue
-- no mesmo e-mail que leva o PDF da nota ao cliente.

alter type public.categoria_arquivo add value if not exists 'boleto';

alter table public.notas_fiscais
  add column arquivo_boleto_id uuid references public.arquivos (id) on delete set null;

create index notas_fiscais_arquivo_boleto_idx on public.notas_fiscais (arquivo_boleto_id);

comment on column public.notas_fiscais.arquivo_boleto_id is
  'Boleto da cobrança desta nota; vai anexo ao e-mail junto com o PDF da nota.';
