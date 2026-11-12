-- =============================================================================
-- Proposta de contrato: tradicional ou completa.
--
-- Tradicional: a proposta de sempre, com valor anual e parcelas mensais.
-- Completa: o memorial descritivo das propostas contratuais em Word (seções
-- técnicas de cada serviço, atendimento, corpo técnico e investimento mensal).
-- Cada serviço guarda o texto dele no contrato completo (vazio = texto padrão
-- do modelo de serviço, que fica no sistema: src/features/propostas/contratual.ts).
-- =============================================================================

alter table public.propostas
  add column contrato_modelo text
    check (contrato_modelo in ('tradicional', 'completo'));

alter table public.proposta_itens
  add column texto_contrato text check (char_length(texto_contrato) <= 12000);

-- A view usa p.*: recria para pegar a coluna nova.
drop view public.v_propostas;
create view public.v_propostas
with (security_invoker = true)
as
select
  p.*,
  case
    when p.status = 'enviada' and p.validade < privado.hoje() then 'expirada'
    else p.status::text
  end as situacao,
  case when p.status = 'enviada' then privado.hoje() - p.data_envio end as dias_sem_resposta
from public.propostas p;

revoke all on public.v_propostas from anon;
grant select on public.v_propostas to authenticated;

-- Troca os itens de uma vez, agora com o texto do contrato completo.
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
     frequencia, modelo, titulo, escopo, metodologia, recursos, cobranca, taxas_adicionais,
     texto_contrato, ordem)
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
    nullif(trim(i ->> 'texto_contrato'), ''),
    (ordinalidade - 1)::smallint
  from jsonb_array_elements(itens) with ordinality as t(i, ordinalidade);
end
$$;
