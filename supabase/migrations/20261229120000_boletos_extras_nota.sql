-- Boletos a mais da nota: emitidos por fora (outro prazo, parcelas) e anexados à mão.
-- Vão no mesmo e-mail, junto com a nota e o boleto principal (arquivo_boleto_id).

alter table public.notas_fiscais
  add column boletos_extras uuid[] not null default '{}';

create index notas_fiscais_boletos_extras_idx on public.notas_fiscais using gin (boletos_extras);

comment on column public.notas_fiscais.boletos_extras is
  'Outros boletos (ids em arquivos) anexados à mão; vão no e-mail junto com a nota e o boleto principal.';
