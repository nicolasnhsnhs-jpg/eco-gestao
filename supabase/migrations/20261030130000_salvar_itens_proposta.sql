-- =============================================================================
-- Troca todos os itens de uma proposta de uma vez só: ou entram todos os
-- novos, ou nada muda (nunca fica uma proposta sem itens pela metade).
-- Roda com a permissão de quem chama: as regras de RLS dos itens continuam valendo.
-- =============================================================================

create function public.salvar_itens_proposta(proposta uuid, itens jsonb)
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

  delete from public.proposta_itens where proposta_id = proposta;

  insert into public.proposta_itens
    (proposta_id, tipo_servico_id, descricao, quantidade, valor_unitario, periodicidade_meses, ordem)
  select
    proposta,
    nullif(i ->> 'tipo_servico_id', '')::uuid,
    i ->> 'descricao',
    (i ->> 'quantidade')::numeric,
    (i ->> 'valor_unitario')::numeric,
    nullif(i ->> 'periodicidade_meses', '')::smallint,
    (ordinalidade - 1)::smallint
  from jsonb_array_elements(itens) with ordinality as t(i, ordinalidade);
end
$$;

revoke execute on function public.salvar_itens_proposta(uuid, jsonb) from public, anon;
grant execute on function public.salvar_itens_proposta(uuid, jsonb) to authenticated;
