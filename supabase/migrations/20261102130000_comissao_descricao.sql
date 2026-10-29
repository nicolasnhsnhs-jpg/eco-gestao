-- O vendedor não lê lançamentos (são do financeiro), então não via de qual venda
-- veio cada comissão. A comissão passa a guardar a descrição da parcela.
alter table public.comissoes add column descricao text;

update public.comissoes c
   set descricao = l.descricao
  from public.lancamentos l
 where l.id = c.lancamento_origem_id;

create or replace function privado.calcular_comissao()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_vendedor   uuid;
  v_percentual numeric;
  v_papel      public.papel;
  v_proprio    numeric;
begin
  if new.tipo <> 'entrada' then
    return null;
  end if;

  if new.servico_id is not null then
    select vendedor_id into v_vendedor from public.servicos where id = new.servico_id;
  elsif new.contrato_id is not null then
    select vendedor_id into v_vendedor from public.contratos where id = new.contrato_id;
  end if;

  if v_vendedor is not null then
    select papel, comissao_percentual into v_papel, v_proprio from public.perfis where id = v_vendedor;
    v_percentual := case
      when v_proprio is not null then v_proprio
      when v_papel = 'vendedor' then coalesce(privado.config('comissao_percentual_padrao')::numeric, 0)
    end;
  end if;

  if v_percentual is null or v_percentual = 0 or new.status = 'cancelado' then
    update public.comissoes
       set status = 'cancelada', atualizado_em = now()
     where lancamento_origem_id = new.id and status = 'prevista' and fechamento_id is null;
    return null;
  end if;

  insert into public.comissoes
    (vendedor_id, lancamento_origem_id, cliente_id, competencia, base, percentual, valor, descricao)
  values
    (v_vendedor, new.id, new.cliente_id, new.competencia, new.valor, v_percentual,
     round(new.valor * v_percentual / 100, 2), new.descricao)
  on conflict (lancamento_origem_id) do update
    set vendedor_id = excluded.vendedor_id,
        competencia = excluded.competencia,
        base = excluded.base,
        percentual = excluded.percentual,
        valor = excluded.valor,
        descricao = excluded.descricao,
        status = 'prevista',
        atualizado_em = now()
    where public.comissoes.fechamento_id is null and public.comissoes.status <> 'paga';

  return null;
end
$$;
