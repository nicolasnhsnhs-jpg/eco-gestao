-- Produtos da OS de pragas escolhidos do catálogo (o mesmo dos certificados),
-- em vez de digitados pelo técnico: sem erro de escrita e já com o lote em uso.
--
-- O nome e o princípio ativo continuam copiados na linha da OS: trocar ou
-- desativar o produto no catálogo não muda o que foi anotado.

alter table public.os_produtos
  add column produto_id uuid references public.produtos_certificado (id) on delete set null,
  add column nome_comercial text check (char_length(nome_comercial) <= 120);

create index os_produtos_produto_idx on public.os_produtos (produto_id);

comment on column public.os_produtos.produto_id is 'Produto do catálogo escolhido pelo técnico.';

-- O técnico precisa da lista no celular (só os produtos em uso).
create policy "operador vê produtos em uso" on public.produtos_certificado for select to authenticated
  using (ativo and privado.meu_papel() = 'operador');
