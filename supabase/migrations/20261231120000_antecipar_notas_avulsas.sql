-- Antecipar pela tela das notas: a nota avulsa não nasce ligada a uma conta a receber
-- (a do serviço é lançada à parte), então não aparecia para antecipar. Agora, ao antecipar,
-- cada nota marcada sem conta ligada:
--   1. procura uma conta a receber em aberto do mesmo cliente, ainda sem nota, com o número
--      da NF ou o mesmo valor; achando, liga as duas;
--   2. não achando, cria a conta a receber a partir da nota, na conta Sicredi, e liga.
-- Devolve as contas a receber (na ordem das notas) para o antecipar_recebiveis.

create or replace function public.contas_das_notas(p_notas uuid[])
returns uuid[]
language plpgsql
set search_path = ''
as $$
declare
  v_nota    public.notas_fiscais;
  v_conta   uuid;
  v_sicredi uuid;
  v_ids     uuid[] := '{}';
begin
  if not privado.tem_acesso_total() then
    raise exception 'Só o financeiro pode antecipar recebíveis.' using errcode = '42501';
  end if;

  select id into v_sicredi
    from public.contas_bancarias
   where ativo and nome ilike '%sicredi%'
   order by criado_em
   limit 1;

  for v_nota in
    select * from public.notas_fiscais where id = any (p_notas) order by numero for update
  loop
    if v_nota.status <> 'emitida' then
      raise exception 'A nota % não está emitida.', coalesce(v_nota.numero, '(sem número)')
        using errcode = '23514';
    end if;

    v_conta := v_nota.lancamento_id;

    if v_conta is null then
      select l.id into v_conta
        from public.lancamentos l
       where l.tipo = 'entrada'
         and l.cliente_id = v_nota.cliente_id
         and l.status in ('pendente', 'agendado')
         and l.contrato_id is null
         and (l.numero_nota_fiscal = v_nota.numero or l.valor = v_nota.valor_servico)
         and not exists (
           select 1 from public.notas_fiscais n
            where n.lancamento_id = l.id and n.status <> 'cancelada'
         )
       order by (l.numero_nota_fiscal is not distinct from v_nota.numero) desc,
                abs(l.vencimento - coalesce(v_nota.vencimento, v_nota.data_emissao)),
                l.criado_em
       limit 1;
    end if;

    if v_conta is null then
      insert into public.lancamentos
        (tipo, descricao, cliente_id, categoria_id, conta_bancaria_id, competencia, vencimento,
         valor, forma_pagamento, numero_nota_fiscal)
      values
        ('entrada',
         left('NF ' || coalesce(v_nota.numero, '') || ' · ' || v_nota.descricao, 300),
         v_nota.cliente_id,
         (select id from public.categorias_financeiras
           where tipo = 'receita' and nome = 'Serviços prestados'),
         v_sicredi,
         v_nota.competencia,
         coalesce(v_nota.vencimento, v_nota.data_emissao),
         v_nota.valor_servico,
         v_nota.forma_pagamento,
         v_nota.numero)
      returning id into v_conta;
    end if;

    if v_nota.lancamento_id is distinct from v_conta then
      update public.notas_fiscais set lancamento_id = v_conta where id = v_nota.id;
    end if;

    v_ids := v_ids || v_conta;
  end loop;

  if cardinality(v_ids) <> cardinality(p_notas) then
    raise exception 'Alguma nota escolhida não foi encontrada. Atualize a lista.'
      using errcode = '23514';
  end if;
  return v_ids;
end
$$;

revoke execute on function public.contas_das_notas(uuid[]) from public, anon;
grant execute on function public.contas_das_notas(uuid[]) to authenticated;
