-- =============================================================================
-- Proposta: taxas adicionais em cada serviço.
--
-- Ex.: "Adicional para trabalho ao domingo - R$ 150,00" ou "Adicional noturno".
-- Ficam no próprio item, como lista [{ "descricao": "...", "valor": 150.00 }],
-- e somam no valor do serviço (uma vez, não multiplicam pela quantidade) e no
-- total da proposta.
-- =============================================================================

alter table public.proposta_itens
  add column taxas_adicionais jsonb not null default '[]'::jsonb
    check (jsonb_typeof(taxas_adicionais) = 'array');

-- Soma das taxas de um item.
create function privado.total_taxas_item(taxas jsonb)
returns numeric
language sql immutable
set search_path = ''
as $$
  select coalesce(sum(round((t ->> 'valor')::numeric, 2)), 0)
    from jsonb_array_elements(coalesce(taxas, '[]'::jsonb)) as t
$$;

create or replace function privado.recalcular_total_proposta()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_proposta uuid := coalesce(new.proposta_id, old.proposta_id);
begin
  perform set_config('app.recalculando_proposta', 'sim', true);
  update public.propostas p
     set valor_total = coalesce((
       select sum(round(i.quantidade * i.valor_unitario, 2)
                  + privado.total_taxas_item(i.taxas_adicionais))
         from public.proposta_itens i where i.proposta_id = v_proposta
     ), 0)
   where p.id = v_proposta;
  perform set_config('app.recalculando_proposta', '', true);
  return null;
end
$$;

create or replace function public.salvar_itens_proposta(proposta uuid, itens jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if jsonb_typeof(itens) <> 'array' or jsonb_array_length(itens) = 0 then
    raise exception 'A proposta precisa de pelo menos um item.' using errcode = '22023';
  end if;
  if not privado.pode_ver_proposta(proposta) then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;

  -- Cada taxa precisa de descrição e de um valor maior que zero.
  if exists (
    select 1
      from jsonb_array_elements(itens) as i,
           jsonb_array_elements(coalesce(i -> 'taxas_adicionais', '[]'::jsonb)) as t
     where char_length(trim(coalesce(t ->> 'descricao', ''))) not between 2 and 200
        or coalesce((t ->> 'valor')::numeric, 0) <= 0
  ) then
    raise exception 'Cada taxa adicional precisa de descrição e valor.' using errcode = '22023';
  end if;

  delete from public.proposta_itens where proposta_id = proposta;

  insert into public.proposta_itens
    (proposta_id, tipo_servico_id, descricao, quantidade, valor_unitario, periodicidade_meses,
     frequencia, modelo, titulo, escopo, metodologia, recursos, cobranca, taxas_adicionais, ordem)
  select
    proposta,
    nullif(i ->> 'tipo_servico_id', '')::uuid,
    i ->> 'descricao',
    (i ->> 'quantidade')::numeric,
    (i ->> 'valor_unitario')::numeric,
    nullif(i ->> 'periodicidade_meses', '')::smallint,
    nullif(i ->> 'frequencia', ''),
    nullif(trim(i ->> 'modelo'), ''),
    nullif(trim(i ->> 'titulo'), ''),
    nullif(trim(i ->> 'escopo'), ''),
    nullif(trim(i ->> 'metodologia'), ''),
    nullif(trim(i ->> 'recursos'), ''),
    coalesce(nullif(i ->> 'cobranca', ''), 'unica'),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'descricao', trim(t ->> 'descricao'),
               'valor', round((t ->> 'valor')::numeric, 2)) order by n)
        from jsonb_array_elements(coalesce(i -> 'taxas_adicionais', '[]'::jsonb))
             with ordinality as x(t, n)
    ), '[]'::jsonb),
    (ordinalidade - 1)::smallint
  from jsonb_array_elements(itens) with ordinality as t(i, ordinalidade);
end
$$;
