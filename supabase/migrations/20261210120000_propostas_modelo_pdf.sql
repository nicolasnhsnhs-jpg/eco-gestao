-- =============================================================================
-- Proposta no modelo da Eco Ambiental, pronta para sair em PDF.
--
-- A proposta ganha o contato (A/C), a apresentação, o acréscimo fora do horário
-- e a escolha de mostrar o valor de cada serviço. Cada item ganha o texto que vai
-- no PDF: modelo de serviço, título da seção, escopo, metodologia e recursos.
-- Os textos padrão de cada modelo ficam no sistema (src/features/propostas/modelos.ts);
-- aqui fica o que foi escrito naquela proposta.
-- =============================================================================

alter table public.propostas
  add column contato_nome           text check (char_length(contato_nome) <= 120),
  add column contato_telefone       text check (char_length(contato_telefone) <= 120),
  add column contato_email          text check (char_length(contato_email) <= 300),
  -- Vazio = o sistema escreve a apresentação padrão ("Vimos a V.S. apresentar…").
  add column introducao             text check (char_length(introducao) <= 2000),
  -- Acréscimo para atendimento fora do horário comercial (e deslocamento sem êxito).
  add column acrescimo_fora_horario numeric(12, 2) check (acrescimo_fora_horario >= 0),
  -- Falso = o PDF mostra só o valor total, sem o valor de cada serviço.
  add column custos_detalhados      boolean not null default true;

alter table public.proposta_itens
  add column modelo      text check (char_length(modelo) <= 40),
  add column titulo      text check (char_length(titulo) <= 200),
  add column escopo      text check (char_length(escopo) <= 4000),
  add column metodologia text check (char_length(metodologia) <= 4000),
  add column recursos    text check (char_length(recursos) <= 4000),
  -- Como o valor é cobrado: uma vez, por mês ou por visita.
  add column cobranca    text not null default 'unica'
    check (cobranca in ('unica', 'mensal', 'por_visita'));

-- A view "v_propostas" usa p.*: recria para pegar as colunas novas
-- (as colunas novas entram no meio, então não dá para só substituir).
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

-- Troca os itens de uma vez, agora com os textos do PDF.
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
     modelo, titulo, escopo, metodologia, recursos, cobranca, ordem)
  select
    proposta,
    nullif(i ->> 'tipo_servico_id', '')::uuid,
    i ->> 'descricao',
    (i ->> 'quantidade')::numeric,
    (i ->> 'valor_unitario')::numeric,
    nullif(i ->> 'periodicidade_meses', '')::smallint,
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
