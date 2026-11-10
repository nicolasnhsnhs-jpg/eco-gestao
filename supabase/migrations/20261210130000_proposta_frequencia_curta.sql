-- =============================================================================
-- Serviço da proposta semanal ou quinzenal.
--
-- A frequência em meses (periodicidade_meses) continua valendo para mensal em
-- diante. Semana e quinzena não cabem em meses: ficam em "frequencia", e nesse
-- caso periodicidade_meses fica vazio.
-- =============================================================================

alter table public.proposta_itens
  add column frequencia text check (frequencia in ('semanal', 'quinzenal')),
  add constraint frequencia_ou_meses check (frequencia is null or periodicidade_meses is null);

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

  delete from public.proposta_itens where proposta_id = proposta;

  insert into public.proposta_itens
    (proposta_id, tipo_servico_id, descricao, quantidade, valor_unitario, periodicidade_meses,
     frequencia, modelo, titulo, escopo, metodologia, recursos, cobranca, ordem)
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
    (ordinalidade - 1)::smallint
  from jsonb_array_elements(itens) with ordinality as t(i, ordinalidade);
end
$$;
