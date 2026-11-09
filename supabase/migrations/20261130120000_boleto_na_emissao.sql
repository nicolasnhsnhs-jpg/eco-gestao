-- Boleto na emissão só quando o financeiro marca: muita nota por boleto não deve
-- gerar a cobrança no banco na hora (o boleto vem depois, ou é feito fora). Marcado,
-- a emissão gera o boleto pelo banco da nota e manda junto no e-mail; desmarcado, a
-- nota sai sem boleto e o financeiro gera ou anexa quando quiser.

alter table public.notas_fiscais
  add column boleto_na_emissao boolean not null default false;
