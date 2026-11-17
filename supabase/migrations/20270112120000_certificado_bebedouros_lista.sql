-- Certificado de bebedouros: em vez de um campo de texto, uma lista bebedouro por
-- bebedouro (nº da etiqueta · local · data da limpeza · troca de filtro), como a
-- tabela dos reservatórios. Guardada em JSON no próprio certificado.
alter table public.certificados
  add column if not exists bebedouros jsonb not null default '[]'
    check (jsonb_typeof(bebedouros) = 'array');

grant insert (bebedouros) on public.certificados to authenticated;
grant update (bebedouros) on public.certificados to authenticated;
