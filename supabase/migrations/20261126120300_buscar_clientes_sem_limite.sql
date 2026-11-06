-- A lista de clientes passa a carregar de 50 em 50 enquanto a pessoa rola a tela,
-- até o último cliente. Por isso a busca não corta mais em 50 aqui dentro:
-- quem chama pede o pedaço que quer (o seletor de cliente continua pedindo só 50).
-- O id no fim da ordem deixa a ordem fixa, para nenhum cliente repetir ou sumir entre um pedaço e outro.
create or replace function public.buscar_clientes(termo text default '', incluir_inativos boolean default false)
returns setof public.clientes
language sql stable
set search_path = ''
as $$
  with t as (
    select
      privado.sem_acento(trim(coalesce(termo, ''))) as texto,
      lower(regexp_replace(coalesce(termo, ''), '[^0-9A-Za-z]', '', 'g')) as doc
  ),
  e as (
    -- Escapa % e _ para não virarem curingas no LIKE.
    select
      texto,
      doc,
      replace(replace(replace(texto, '\', '\\'), '%', '\%'), '_', '\_') as texto_like,
      replace(replace(doc, '%', '\%'), '_', '\_') as doc_like
    from t
  )
  select c.*
  from public.clientes c, e
  where (incluir_inativos or c.ativo)
    and (
      e.texto = ''
      or c.busca_texto like '%' || e.texto_like || '%'
      or (char_length(e.doc) >= 3 and c.busca_texto like '%' || e.doc_like || '%')
      or (char_length(e.texto) >= 3 and extensions.word_similarity(e.texto, c.busca_texto) >= 0.5)
    )
  order by
    c.ativo desc,
    (e.texto <> '' and c.busca_texto like e.texto_like || '%') desc,
    extensions.word_similarity(e.texto, c.busca_texto) desc,
    c.nome,
    c.id
$$;
