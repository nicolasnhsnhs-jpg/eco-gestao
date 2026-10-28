-- =============================================================================
-- Testes do financeiro: permissões, regras dos lançamentos, saldos e avisos.
-- Roda numa transação desfeita no final (rollback): nada fica no banco.
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@teste.local',      '{"nome":"Admin Teste"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'financeiro@teste.local', '{"nome":"Financeiro Teste"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'vend.a@teste.local',     '{"nome":"Vendedor A"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'recepcao@teste.local',   '{"nome":"Recepção Teste"}');

update public.perfis set papel = 'admin'      where id = '00000000-0000-0000-0000-0000000000a1';
update public.perfis set papel = 'financeiro' where id = '00000000-0000-0000-0000-0000000000f1';
update public.perfis set papel = 'vendedor'   where id = '00000000-0000-0000-0000-0000000000b1';
update public.perfis set papel = 'recepcao'   where id = '00000000-0000-0000-0000-0000000000c1';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.categoria(nome_categoria text) returns uuid language sql as $$
  select id from public.categorias_financeiras where nome = nome_categoria
$$;

insert into public.clientes (id, tipo_pessoa, nome, vendedor_responsavel_id) values
  ('00000000-0000-0000-0000-00000000c0a1', 'PF', 'Cliente Financeiro Teste',
   '00000000-0000-0000-0000-0000000000b1');

-- Os testes de saldo partem do zero: apaga temporariamente (dentro da transação)
-- o que existir no banco. O rollback no final devolve tudo.
alter table public.lancamentos disable trigger user;
delete from public.avisos;
delete from public.lancamentos;
alter table public.lancamentos enable trigger user;
update public.contas_bancarias set ativo = false, saldo_inicial = 0;

-- =============================================================================
-- Financeiro: cadastra conta e lançamentos
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;

insert into public.contas_bancarias (id, nome, saldo_inicial, data_saldo_inicial)
values ('00000000-0000-0000-0000-0000000c0a01', 'Conta Teste', 1000, privado.hoje() - 60);

insert into public.lancamentos
  (id, tipo, descricao, cliente_id, categoria_id, competencia, vencimento, valor, status) values
  -- recebimento atrasado
  ('00000000-0000-0000-0000-00000000aa01', 'entrada', 'Limpeza de coifa',
   '00000000-0000-0000-0000-00000000c0a1', pg_temp.categoria('Serviços prestados'),
   privado.hoje() - 10, privado.hoje() - 10, 500, 'pendente'),
  -- recebimento de hoje
  ('00000000-0000-0000-0000-00000000aa02', 'entrada', 'Dedetização',
   '00000000-0000-0000-0000-00000000c0a1', pg_temp.categoria('Serviços prestados'),
   privado.hoje(), privado.hoje(), 300, 'agendado'),
  -- conta a pagar futura
  ('00000000-0000-0000-0000-00000000aa03', 'saida', 'Combustível',
   null, pg_temp.categoria('Combustível'),
   privado.hoje(), privado.hoje() + 5, 200, 'pendente');

do $$ begin
  assert (select count(*) from public.v_lancamentos where atrasado) = 1,
    'Deveria haver exatamente 1 lançamento atrasado (calculado, não digitado)';
  assert (select situacao from public.v_lancamentos where id = '00000000-0000-0000-0000-00000000aa01')
       = 'atrasado', 'A situação do recebimento vencido deveria ser "atrasado"';
  assert (select competencia from public.lancamentos where id = '00000000-0000-0000-0000-00000000aa01')
       = date_trunc('month', privado.hoje() - 10)::date,
    'A competência deveria ser guardada como o dia 1 do mês';
end $$;

-- Categoria de despesa num lançamento de entrada: recusado.
do $$ begin
  begin
    insert into public.lancamentos (tipo, descricao, categoria_id, competencia, vencimento, valor)
    values ('entrada', 'Errado', pg_temp.categoria('Aluguel'), privado.hoje(), privado.hoje(), 10);
    raise exception 'FALHOU: aceitou categoria de despesa numa entrada';
  exception when check_violation then null;
  end;
end $$;

-- Confirmar sem conta: recusado. Com conta: valor pago = valor, e fica registrado quem confirmou.
do $$ begin
  begin
    update public.lancamentos set status = 'realizado', data_pagamento = privado.hoje()
     where id = '00000000-0000-0000-0000-00000000aa01';
    raise exception 'FALHOU: confirmou recebimento sem informar a conta';
  exception when check_violation then null;
  end;
end $$;

-- Avisos: o financeiro gera os avisos do dia.
do $$ begin
  assert public.atualizar_avisos() = 2, 'Deveria gerar 2 avisos (1 atrasado e 1 de hoje)';
  assert public.atualizar_avisos() = 0, 'Rodar de novo não deveria duplicar avisos';
  assert exists (select 1 from public.avisos where tipo = 'cobranca_atrasada'
                   and lancamento_id = '00000000-0000-0000-0000-00000000aa01'),
    'Deveria existir o aviso de cobrança atrasada';
end $$;

update public.lancamentos
   set status = 'realizado', data_pagamento = privado.hoje(),
       conta_bancaria_id = '00000000-0000-0000-0000-0000000c0a01'
 where id = '00000000-0000-0000-0000-00000000aa01';

do $$ begin
  assert (select valor_pago from public.lancamentos where id = '00000000-0000-0000-0000-00000000aa01') = 500,
    'O valor pago deveria ser o valor previsto quando não informado';
  assert (select confirmado_por from public.lancamentos where id = '00000000-0000-0000-0000-00000000aa01')
       = '00000000-0000-0000-0000-0000000000f1', 'Deveria registrar quem confirmou';
  assert (select resolvido_em from public.avisos
           where lancamento_id = '00000000-0000-0000-0000-00000000aa01') is not null,
    'Confirmar o recebimento deveria resolver o aviso de cobrança';
  assert (select saldo_atual from public.v_saldos_contas
           where id = '00000000-0000-0000-0000-0000000c0a01') = 1500,
    'Saldo deveria ser 1000 (inicial) + 500 (recebido)';
  assert (public.painel_financeiro() ->> 'a_receber')::numeric = 300, 'A receber deveria ser 300';
  assert (public.painel_financeiro() ->> 'a_pagar')::numeric = 200, 'A pagar deveria ser 200';
  assert (public.painel_financeiro() ->> 'receber_atrasado')::numeric = 0,
    'Depois de confirmado, não deveria sobrar nada atrasado';
end $$;

-- Lançamento realizado: o financeiro não altera mais (só o admin).
do $$ begin
  begin
    update public.lancamentos set valor = 1 where id = '00000000-0000-0000-0000-00000000aa01';
    raise exception 'FALHOU: financeiro alterou lançamento já confirmado';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Ninguém apaga lançamento.
do $$ begin
  begin
    delete from public.lancamentos where id = '00000000-0000-0000-0000-00000000aa03';
    raise exception 'FALHOU: foi possível apagar um lançamento';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Resumo mensal: o mês atual mostra o recebido e o saldo acumulado.
do $$ declare r record; begin
  select * into r from public.resumo_mensal(0, 0);
  assert r.recebido = 500 and r.saldo_acumulado = 1500,
    format('Resumo do mês errado: recebido=%s saldo=%s', r.recebido, r.saldo_acumulado);
end $$;

reset role;

-- =============================================================================
-- Administrador: pode corrigir lançamento confirmado, e o caixa acompanha
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;

update public.lancamentos set status = 'pendente' where id = '00000000-0000-0000-0000-00000000aa01';

do $$ begin
  assert (select data_pagamento from public.lancamentos where id = '00000000-0000-0000-0000-00000000aa01') is null,
    'Ao desfazer a confirmação, os dados do pagamento deveriam ser limpos';
  assert (select saldo_atual from public.v_saldos_contas
           where id = '00000000-0000-0000-0000-0000000c0a01') = 1000,
    'O saldo deveria voltar a 1000';
end $$;

reset role;

-- =============================================================================
-- Vendedor e recepção: não enxergam nada do financeiro
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.lancamentos) = 0, 'Vendedor não deveria ver lançamentos';
  assert (select count(*) from public.v_lancamentos) = 0, 'Vendedor não deveria ver lançamentos (view)';
  assert (select count(*) from public.contas_bancarias) = 0, 'Vendedor não deveria ver contas';
  assert (select count(*) from public.v_saldos_contas) = 0, 'Vendedor não deveria ver saldos';
  assert (select count(*) from public.avisos) = 0, 'Vendedor não deveria ver avisos do financeiro';
  assert public.atualizar_avisos() = 0, 'Vendedor não deveria gerar avisos';
  assert (public.painel_financeiro() ->> 'a_receber')::numeric = 0,
    'O painel do vendedor deveria vir zerado';
end $$;
do $$ begin
  begin
    insert into public.lancamentos (tipo, descricao, categoria_id, competencia, vencimento, valor)
    values ('saida', 'Tentativa', pg_temp.categoria('Outras despesas'), privado.hoje(), privado.hoje(), 1);
    raise exception 'FALHOU: vendedor criou lançamento';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.lancamentos) = 0, 'Recepção não deveria ver lançamentos';
  assert (select count(*) from public.fornecedores) = 0, 'Recepção não deveria ver fornecedores';
  assert (select count(*) from public.categorias_financeiras) = 0, 'Recepção não deveria ver categorias';
end $$;
reset role;

select 'Todos os testes do financeiro passaram.' as resultado;

rollback;
