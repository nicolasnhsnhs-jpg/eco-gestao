-- =============================================================================
-- Antecipação de recebíveis (desconto de duplicatas / boletos na financeira ou no banco).
--
-- O financeiro escolhe várias contas a receber em aberto, informa quanto a financeira
-- descontou (em R$ ou %) e em que conta o dinheiro caiu. Cada conta a receber fica:
--   - realizada, na data da antecipação, na conta escolhida (o saldo sobe só o líquido);
--   - com o vencimento original do cliente guardado (o registro não se perde);
--   - com o valor recebido = valor − a parte dela no desconto (rateado pelo valor).
-- A antecipação em si fica registrada (instituição, bruto, desconto, líquido).
-- Desfazer (lançada errado): só o administrador, como qualquer realizado.
-- =============================================================================

create table public.antecipacoes (
  id                uuid primary key default gen_random_uuid(),
  -- Dia em que o dinheiro caiu na conta.
  data              date not null,
  conta_bancaria_id uuid not null references public.contas_bancarias (id),
  -- Quem antecipou: Sicredi, a financeira…
  instituicao       text not null check (char_length(trim(instituicao)) between 2 and 80),
  valor_bruto       numeric(12, 2) not null check (valor_bruto > 0),
  desconto          numeric(12, 2) not null check (desconto >= 0),
  valor_liquido     numeric(12, 2) generated always as (valor_bruto - desconto) stored,
  observacoes       text,
  -- Nada é apagado: antecipação lançada errado é desfeita e fica no histórico.
  desfeita          boolean not null default false,
  criado_em         timestamptz not null default now(),
  criado_por        uuid references public.perfis (id),
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid references public.perfis (id),

  constraint desconto_menor_que_bruto check (desconto < valor_bruto)
);

create index antecipacoes_data_idx on public.antecipacoes (data desc);

create trigger carimbar before insert or update on public.antecipacoes
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.antecipacoes
  for each row execute function privado.registrar_auditoria();

alter table public.antecipacoes enable row level security;

create policy "financeiro vê antecipações" on public.antecipacoes for select to authenticated
  using (privado.tem_acesso_total());
create policy "financeiro registra antecipações" on public.antecipacoes for insert to authenticated
  with check (privado.tem_acesso_total());
create policy "admin desfaz antecipações" on public.antecipacoes for update to authenticated
  using (privado.e_admin()) with check (privado.e_admin());

revoke all on public.antecipacoes from anon, authenticated;
grant select, insert, update on public.antecipacoes to authenticated;
grant all on public.antecipacoes to service_role;

alter table public.lancamentos
  add column antecipacao_id uuid references public.antecipacoes (id),
  add constraint antecipacao_so_em_entrada_realizada check (
    antecipacao_id is null or (tipo = 'entrada' and status = 'realizado')
  );

create index lancamentos_antecipacao_idx on public.lancamentos (antecipacao_id)
  where antecipacao_id is not null;

-- v_lancamentos foi criada com "l.*": recriada para mostrar a coluna nova.
drop view public.v_lancamentos;
create view public.v_lancamentos
with (security_invoker = true)
as
select
  l.*,
  (l.status in ('pendente', 'agendado') and l.vencimento < privado.hoje()) as atrasado,
  case
    when l.status in ('pendente', 'agendado') and l.vencimento < privado.hoje() then 'atrasado'
    else l.status::text
  end as situacao
from public.lancamentos l;
revoke all on public.v_lancamentos from anon;
grant select on public.v_lancamentos to authenticated;

-- -----------------------------------------------------------------------------
-- Antecipar: tudo numa transação (ou todas as contas entram, ou nenhuma).
-- security invoker: valem as permissões (RLS) e as regras de quem chama.
-- -----------------------------------------------------------------------------

create function public.antecipar_recebiveis(
  p_lancamentos uuid[],
  p_data        date,
  p_conta       uuid,
  p_instituicao text,
  p_desconto    numeric,
  p_observacoes text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_ids        uuid[];
  v_qtd        integer;
  v_bruto      numeric(12, 2);
  v_id         uuid;
begin
  if not privado.tem_acesso_total() then
    raise exception 'Só o financeiro pode antecipar recebíveis.' using errcode = '42501';
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_lancamentos) x;
  if v_ids is null then
    raise exception 'Escolha ao menos uma conta a receber.' using errcode = '23514';
  end if;

  -- Trava as contas escolhidas: ninguém confirma nem antecipa duas vezes ao mesmo tempo.
  perform 1 from public.lancamentos where id = any (v_ids) for update;

  select count(*), sum(valor) into v_qtd, v_bruto
  from public.lancamentos
  where id = any (v_ids)
    and tipo = 'entrada'
    and status in ('pendente', 'agendado');

  if v_qtd <> cardinality(v_ids) then
    raise exception 'Só dá para antecipar contas a receber em aberto. Atualize a lista e escolha de novo.'
      using errcode = '23514';
  end if;

  p_desconto := round(coalesce(p_desconto, 0), 2);
  if p_desconto < 0 or p_desconto >= v_bruto then
    raise exception 'O desconto precisa ficar entre zero e o total antecipado.' using errcode = '23514';
  end if;

  insert into public.antecipacoes (data, conta_bancaria_id, instituicao, valor_bruto, desconto, observacoes)
  values (p_data, p_conta, trim(p_instituicao), v_bruto, p_desconto, nullif(trim(p_observacoes), ''))
  returning id into v_id;

  -- Cada conta paga uma parte do desconto, proporcional ao valor dela. O arredondamento
  -- pode sobrar (ou faltar) centavos: vão para a maior conta, para que a soma recebida
  -- feche exatamente com o líquido. Um UPDATE só: depois de realizado, só o admin altera.
  with parte as (
    select id,
           valor - round(p_desconto * valor / v_bruto, 2) as liquido,
           row_number() over (order by valor desc, id) as ordem
    from public.lancamentos
    where id = any (v_ids)
  ), sobra as (
    select v_bruto - p_desconto - sum(liquido) as centavos from parte
  )
  update public.lancamentos l
  set status = 'realizado',
      data_pagamento = p_data,
      conta_bancaria_id = p_conta,
      valor_pago = p.liquido + case when p.ordem = 1 then s.centavos else 0 end,
      antecipacao_id = v_id
  from parte p, sobra s
  where l.id = p.id;

  return v_id;
end
$$;

-- Desfazer: as contas voltam a ficar em aberto, com o vencimento de sempre.
-- O gatilho dos lançamentos já exige administrador para mexer em realizado.
create function public.desfazer_antecipacao(p_antecipacao uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not privado.e_admin() then
    raise exception 'Só o administrador pode desfazer uma antecipação.' using errcode = '42501';
  end if;

  update public.antecipacoes set desfeita = true where id = p_antecipacao and not desfeita;
  if not found then
    raise exception 'Antecipação não encontrada (ou já desfeita).' using errcode = 'P0002';
  end if;

  update public.lancamentos
  set status = 'pendente', antecipacao_id = null
  where antecipacao_id = p_antecipacao;
end
$$;

revoke execute on function public.antecipar_recebiveis(uuid[], date, uuid, text, numeric, text),
  public.desfazer_antecipacao(uuid) from public, anon;
grant execute on function public.antecipar_recebiveis(uuid[], date, uuid, text, numeric, text),
  public.desfazer_antecipacao(uuid) to authenticated;
