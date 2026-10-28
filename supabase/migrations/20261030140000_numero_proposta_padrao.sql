-- O número da proposta é sempre gerado pelo banco (trigger antes_salvar).
-- O valor padrão vazio só existe para que a tela não precise enviá-lo.
alter table public.propostas alter column numero set default '';
