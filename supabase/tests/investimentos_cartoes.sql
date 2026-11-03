-- =============================================================================
-- Testes de investimentos e cartões de crédito.
-- Roda numa transação desfeita no final (rollback): nada fica no banco.
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000001f1', 'fin.invest@teste.local', '{"nome":"Financeiro Invest"}'),
  ('00000000-0000-0000-0000-0000000001b1', 'vend.invest@teste.local', '{"nome":"Vendedor Invest"}');
update public.perfis set papel = 'financeiro' where id = '00000000-0000-0000-0000-0000000001f1';
update public.perfis set papel = 'vendedor'   where id = '00000000-0000-0000-0000-0000000001b1';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.categoria(nome_categoria text) returns uuid language sql as $$
  select id from public.categorias_financeiras where nome = nome_categoria
$$;

-- Parte do zero (dentro da transação): o rollback devolve tudo.
alter table public.lancamentos disable trigger user;
delete from public.avisos;
delete from public.comissoes;
delete from public.fechamentos_comissao;
delete from public.lancamentos;
alter table public.lancamentos enable trigger user;
update public.contas_bancarias set ativo = false, saldo_inicial = 0;
update public.investimentos set ativo = false, saldo_inicial = 0;
update public.movimentos_investimento set cancelado = true;

select pg_temp.como('00000000-0000-0000-0000-0000000001f1');
set local role authenticated;

insert into public.contas_bancarias (id, nome, saldo_inicial, data_saldo_inicial)
values ('00000000-0000-0000-0000-0000000c1a01', 'Conta Invest', 1000, privado.hoje() - 30);

insert into public.investimentos (id, nome, saldo_inicial, data_saldo_inicial)
values ('00000000-0000-0000-0000-0000000c1b01', 'CDB Teste', 5000, privado.hoje() - 30);

-- =============================================================================
-- Investimentos: aplicar tira da conta, mas não some do controle
-- =============================================================================
insert into public.movimentos_investimento (id, investimento_id, tipo, data, valor, conta_bancaria_id)
values
  ('00000000-0000-0000-0000-0000000c1c01', '00000000-0000-0000-0000-0000000c1b01',
   'aporte', privado.hoje(), 400, '00000000-0000-0000-0000-0000000c1a01'),
  ('00000000-0000-0000-0000-0000000c1c02', '00000000-0000-0000-0000-0000000c1b01',
   'resgate', privado.hoje(), 100, '00000000-0000-0000-0000-0000000c1a01');
insert into public.movimentos_investimento (investimento_id, tipo, data, valor)
values ('00000000-0000-0000-0000-0000000c1b01', 'rendimento', privado.hoje(), 50);

do $$ declare r record; begin
  assert (select saldo_atual from public.v_saldos_contas
           where id = '00000000-0000-0000-0000-0000000c1a01') = 700,
    'Conta deveria ter 1000 − 400 (aplicado) + 100 (resgatado) = 700';
  assert (select saldo_atual from public.v_saldos_investimentos
           where id = '00000000-0000-0000-0000-0000000c1b01') = 5350,
    'Investido deveria ser 5000 + 400 − 100 + 50 = 5350';
  assert (public.painel_financeiro() ->> 'saldo_atual')::numeric = 700,
    'O saldo atual do painel não deveria incluir o investido';
  assert (public.painel_financeiro() ->> 'investido')::numeric = 5350,
    'O painel deveria mostrar o investido à parte';

  select * into r from public.resumo_mensal(0, 0);
  assert r.pago = 0 and r.recebido = 0 and r.investido = 300 and r.saldo_acumulado = 700,
    format('Resumo errado: recebido=%s pago=%s investido=%s saldo=%s',
           r.recebido, r.pago, r.investido, r.saldo_acumulado);
end $$;

-- Aporte sem conta e rendimento com conta: recusados.
do $$ begin
  begin
    insert into public.movimentos_investimento (investimento_id, tipo, data, valor)
    values ('00000000-0000-0000-0000-0000000c1b01', 'aporte', privado.hoje(), 10);
    raise exception 'FALHOU: aceitou aplicação sem dizer de que conta saiu';
  exception when check_violation then null;
  end;
  begin
    insert into public.movimentos_investimento (investimento_id, tipo, data, valor)
    values ('00000000-0000-0000-0000-0000000c1b01', 'resgate', privado.hoje(), -10);
    raise exception 'FALHOU: aceitou resgate negativo';
  exception when check_violation then null;
  end;
end $$;

-- Cancelar a aplicação devolve o dinheiro para a conta.
update public.movimentos_investimento set cancelado = true
 where id = '00000000-0000-0000-0000-0000000c1c01';
do $$ begin
  assert (select saldo_atual from public.v_saldos_contas
           where id = '00000000-0000-0000-0000-0000000c1a01') = 1100,
    'Sem a aplicação cancelada, a conta deveria ter 1100';
end $$;

-- =============================================================================
-- Cartões: compras vencem com a fatura; pagar a fatura confirma todas
-- =============================================================================
insert into public.cartoes_credito (id, nome, dia_fechamento, dia_vencimento, conta_bancaria_id)
values ('00000000-0000-0000-0000-0000000c1d01', 'Cartão Teste', 5, 12,
        '00000000-0000-0000-0000-0000000c1a01');

insert into public.lancamentos
  (id, tipo, descricao, categoria_id, competencia, vencimento, valor, status,
   forma_pagamento, cartao_credito_id, data_compra) values
  ('00000000-0000-0000-0000-0000000c1e01', 'saida', 'Combustível no cartão',
   pg_temp.categoria('Combustível'), privado.hoje(), privado.hoje() + 10, 120, 'agendado',
   'cartao', '00000000-0000-0000-0000-0000000c1d01', privado.hoje()),
  ('00000000-0000-0000-0000-0000000c1e02', 'saida', 'Material no cartão',
   pg_temp.categoria('Fornecedores'), privado.hoje(), privado.hoje() + 10, 80, 'agendado',
   'cartao', '00000000-0000-0000-0000-0000000c1d01', privado.hoje());

do $$ begin
  assert (public.painel_financeiro() ->> 'a_pagar')::numeric = 200,
    'Compras no cartão em aberto entram no a pagar (e no saldo projetado)';
  begin
    insert into public.lancamentos
      (tipo, descricao, categoria_id, competencia, vencimento, valor, forma_pagamento, cartao_credito_id)
    values ('saida', 'Errado', pg_temp.categoria('Combustível'), privado.hoje(), privado.hoje(), 1,
            'pix', '00000000-0000-0000-0000-0000000c1d01');
    raise exception 'FALHOU: aceitou cartão com forma de pagamento diferente de cartão';
  exception when check_violation then null;
  end;
end $$;

-- Pagar a fatura (o mesmo UPDATE que o sistema faz).
update public.lancamentos
   set status = 'realizado', data_pagamento = privado.hoje(),
       conta_bancaria_id = '00000000-0000-0000-0000-0000000c1a01'
 where cartao_credito_id = '00000000-0000-0000-0000-0000000c1d01'
   and vencimento = privado.hoje() + 10
   and status in ('pendente', 'agendado');

do $$ begin
  assert (select count(*) from public.lancamentos
           where cartao_credito_id = '00000000-0000-0000-0000-0000000c1d01'
             and status = 'realizado') = 2, 'As duas compras deveriam estar pagas';
  assert (select saldo_atual from public.v_saldos_contas
           where id = '00000000-0000-0000-0000-0000000c1a01') = 900,
    'Conta deveria ter 1100 − 200 (fatura) = 900';
end $$;

reset role;

-- =============================================================================
-- Vendedor: não enxerga investimentos nem cartões
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000001b1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.investimentos) = 0, 'Vendedor não deveria ver investimentos';
  assert (select count(*) from public.v_saldos_investimentos) = 0,
    'Vendedor não deveria ver saldos de investimentos';
  assert (select count(*) from public.movimentos_investimento) = 0,
    'Vendedor não deveria ver movimentos de investimento';
  assert (select count(*) from public.cartoes_credito) = 0, 'Vendedor não deveria ver cartões';
  begin
    insert into public.cartoes_credito (nome, dia_fechamento, dia_vencimento) values ('X', 1, 10);
    raise exception 'FALHOU: vendedor cadastrou cartão';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'Todos os testes de investimentos e cartões passaram.' as resultado;

rollback;
