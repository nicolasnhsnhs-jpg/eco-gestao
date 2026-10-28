-- O vendedor não enxerga as categorias financeiras (é assunto do financeiro).
-- Contrato sem categoria informada usa "Contrato recorrente".
create or replace function privado.antes_salvar_contrato()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.categoria_id is null then
    select id into new.categoria_id from public.categorias_financeiras
     where tipo = 'receita' and nome = 'Contrato recorrente';
  end if;
  if new.endereco_id is not null and not exists (
    select 1 from public.enderecos e where e.id = new.endereco_id and e.cliente_id = new.cliente_id
  ) then
    raise exception 'O endereço escolhido não é deste cliente.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.categorias_financeiras c where c.id = new.categoria_id and c.tipo = 'receita'
  ) then
    raise exception 'A categoria do contrato precisa ser de receita.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and new.vendedor_id is null then
    select vendedor_responsavel_id into new.vendedor_id from public.clientes where id = new.cliente_id;
  end if;
  return new;
end
$$;
