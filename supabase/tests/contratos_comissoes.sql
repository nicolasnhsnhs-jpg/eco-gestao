-- =============================================================================
-- Testes de dias úteis, contratos recorrentes e comissões.
-- Transação desfeita no final (rollback): nada fica no banco.
-- Rodar:  npm run test:db
-- =============================================================================

begin;

-- Configuração conhecida para o teste (o rollback devolve a original).
update public.configuracoes set valor = '1' where chave = 'contrato_dia_util_cobranca';
update public.configuracoes set valor = '8' where chave = 'comissao_percentual_padrao';

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@teste.local',      '{"nome":"Admin Teste"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'financeiro@teste.local', '{"nome":"Financeiro Teste"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'vend.a@teste.local',     '{"nome":"Vendedor A"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'vend.b@teste.local',     '{"nome":"Vendedor B"}');
update public.perfis set papel = 'admin'      where id = '00000000-0000-0000-0000-0000000000a1';
update public.perfis set papel = 'financeiro' where id = '00000000-0000-0000-0000-0000000000f1';
update public.perfis set papel = 'vendedor'   where id = '00000000-0000-0000-0000-0000000000b1';
update public.perfis set papel = 'vendedor', comissao_percentual = 10
                                              where id = '00000000-0000-0000-0000-0000000000b2';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.categoria(nome_categoria text) returns uuid language sql as $$
  select id from public.categorias_financeiras where nome = nome_categoria
$$;
create function pg_temp.mes(deslocamento int) returns date language sql as $$
  select (date_trunc('month', privado.hoje()) + make_interval(months => deslocamento))::date
$$;

insert into public.clientes (id, tipo_pessoa, nome, vendedor_responsavel_id) values
  ('00000000-0000-0000-0000-00000000c0a1', 'PJ', 'Cliente do A [teste]', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000c0b1', 'PJ', 'Cliente do B [teste]', '00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-00000000c0d1', 'PJ', 'Cliente do dono [teste]', '00000000-0000-0000-0000-0000000000a1');
insert into public.contas_bancarias (id, nome) values ('00000000-0000-0000-0000-0000000c0a01', 'Conta [teste]');

-- =============================================================================
-- Dias úteis
-- =============================================================================
do $$ begin
  assert public.dia_util(2026, 11, 1) = '2026-11-03', '1º dia útil de nov/2026 deveria ser 03/11 (02/11 é Finados)';
  assert public.dia_util(2026, 11, 5) = '2026-11-09', '5º dia útil de nov/2026 deveria ser 09/11';
  assert public.dia_util(2027, 1, 1)  = '2027-01-04', '1º dia útil de jan/2027 deveria ser 04/01';
  assert public.dia_util(2026, 2, 1)  = '2026-02-02', '1º dia útil de fev/2026 deveria ser 02/02';
  assert public.dia_util(2026, 2, 12) = '2026-02-19', 'Carnaval (16 e 17/02/2026) não conta como dia útil';
  assert privado.pascoa(2026) = '2026-04-05' and privado.pascoa(2027) = '2027-03-28', 'Páscoa errada';
end $$;

-- Feriado municipal cadastrado também conta.
insert into public.feriados (data, descricao) values ('2026-11-03', 'Feriado municipal [teste]');
do $$ begin
  assert public.dia_util(2026, 11, 1) = '2026-11-04', 'Com feriado municipal em 03/11, o 1º dia útil vira 04/11';
end $$;
delete from public.feriados where descricao = 'Feriado municipal [teste]';

-- =============================================================================
-- Vendedor A cadastra um contrato de 12 meses, R$ 2.000/mês
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
-- Sem categoria: o vendedor não vê as categorias; o banco usa "Contrato recorrente".
insert into public.contratos (id, cliente_id, descricao, valor_mensal, data_inicio, data_fim)
values ('00000000-0000-0000-0000-0000000c7001', '00000000-0000-0000-0000-00000000c0a1',
        'Controle de pragas mensal', 2000, pg_temp.mes(0), (pg_temp.mes(12) - 1));
do $$ begin
  begin
    perform public.gerar_cobrancas_contratos();
    raise exception 'FALHOU: vendedor gerou cobranças';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- =============================================================================
-- Financeiro gera as cobranças (mês atual + próximo)
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;

do $$ declare n int; l record; begin
  perform public.gerar_cobrancas_contratos();
  assert (select count(*) from public.lancamentos where contrato_id = '00000000-0000-0000-0000-0000000c7001') = 2,
    'Deveria gerar 2 mensalidades (mês atual e próximo)';
  n := public.gerar_cobrancas_contratos();
  assert (select count(*) from public.lancamentos where contrato_id = '00000000-0000-0000-0000-0000000c7001') = 2,
    'Gerar de novo não deveria duplicar';

  select * into l from public.lancamentos
   where contrato_id = '00000000-0000-0000-0000-0000000c7001' and competencia = pg_temp.mes(1);
  assert l.vencimento = public.dia_util(extract(year from pg_temp.mes(1))::int, extract(month from pg_temp.mes(1))::int, 1),
    'A mensalidade deveria vencer no 1º dia útil do mês';
  assert l.valor = 2000 and l.tipo = 'entrada' and l.status = 'pendente', 'Mensalidade com dados errados';

  -- Comissão: 8% de cada mensalidade, por mês, sem esperar o pagamento.
  assert (select count(*) from public.comissoes where vendedor_id = '00000000-0000-0000-0000-0000000000b1') = 2,
    'Cada mensalidade deveria gerar uma comissão';
  assert (select valor from public.comissoes where lancamento_origem_id = l.id) = 160,
    'Comissão deveria ser 8% de 2.000 = 160';
end $$;

-- Reajuste do contrato: mensalidades futuras em aberto e comissões acompanham.
update public.contratos set valor_mensal = 2500 where id = '00000000-0000-0000-0000-0000000c7001';
do $$ declare l record; begin
  select * into l from public.lancamentos
   where contrato_id = '00000000-0000-0000-0000-0000000c7001' and competencia = pg_temp.mes(1);
  assert l.valor = 2500, 'A mensalidade futura deveria ir para 2.500';
  assert (select valor from public.comissoes where lancamento_origem_id = l.id) = 200,
    'A comissão deveria acompanhar: 8% de 2.500 = 200';
end $$;

-- Venda de serviço do Vendedor B (10% próprio) e do dono (admin sem %): só B ganha comissão.
insert into public.servicos (id, cliente_id, tipo_servico_id, data_execucao, status, valor)
select '00000000-0000-0000-0000-00000005e0b1', '00000000-0000-0000-0000-00000000c0b1', id,
       privado.hoje(), 'realizado', 1000 from public.tipos_servico where nome = 'Desentupimento';
insert into public.servicos (id, cliente_id, tipo_servico_id, data_execucao, status, valor)
select '00000000-0000-0000-0000-00000005e0d1', '00000000-0000-0000-0000-00000000c0d1', id,
       privado.hoje(), 'realizado', 1000 from public.tipos_servico where nome = 'Desentupimento';

insert into public.lancamentos (id, tipo, descricao, cliente_id, categoria_id, competencia, vencimento, valor, servico_id) values
  ('00000000-0000-0000-0000-00000000bb01', 'entrada', 'Desentupimento B', '00000000-0000-0000-0000-00000000c0b1',
   pg_temp.categoria('Serviços prestados'), privado.hoje(), privado.hoje(), 1000, '00000000-0000-0000-0000-00000005e0b1'),
  ('00000000-0000-0000-0000-00000000dd01', 'entrada', 'Desentupimento dono', '00000000-0000-0000-0000-00000000c0d1',
   pg_temp.categoria('Serviços prestados'), privado.hoje(), privado.hoje(), 1000, '00000000-0000-0000-0000-00000005e0d1');

do $$ begin
  assert (select valor from public.comissoes where lancamento_origem_id = '00000000-0000-0000-0000-00000000bb01') = 100,
    'Vendedor B tem 10% próprio: 100';
  assert not exists (select 1 from public.comissoes where lancamento_origem_id = '00000000-0000-0000-0000-00000000dd01'),
    'O dono (admin sem % próprio) não deveria ter comissão';
end $$;

-- Lançamento cancelado: comissão cancelada.
update public.lancamentos set status = 'cancelado' where id = '00000000-0000-0000-0000-00000000bb01';
do $$ begin
  assert (select status from public.comissoes where lancamento_origem_id = '00000000-0000-0000-0000-00000000bb01')
       = 'cancelada', 'Cancelar o recebimento deveria cancelar a comissão';
end $$;

-- Fechamento do mês atual do Vendedor A: só a comissão de competência até este mês (160).
do $$ declare v_fechamento uuid; f record; begin
  v_fechamento := public.fechar_comissoes('00000000-0000-0000-0000-0000000000b1', pg_temp.mes(0),
                                          privado.hoje() + 5, '00000000-0000-0000-0000-0000000c0a01');
  select * into f from public.fechamentos_comissao where id = v_fechamento;
  assert f.valor_total = 160, 'O fechamento do mês deveria somar 160, veio ' || f.valor_total;
  assert (select tipo from public.lancamentos where id = f.lancamento_pagamento_id) = 'saida',
    'O fechamento deveria criar uma saída no financeiro';
  assert (select count(*) from public.comissoes where fechamento_id = v_fechamento) = 1,
    'A comissão do mês seguinte não deveria entrar neste fechamento';

  -- Pagar a saída marca as comissões como pagas.
  update public.lancamentos
     set status = 'realizado', data_pagamento = privado.hoje(),
         conta_bancaria_id = '00000000-0000-0000-0000-0000000c0a01'
   where id = f.lancamento_pagamento_id;
  assert (select status from public.fechamentos_comissao where id = v_fechamento) = 'pago',
    'Pagar a saída deveria marcar o fechamento como pago';
  assert (select status from public.comissoes where fechamento_id = v_fechamento) = 'paga',
    'Pagar a saída deveria marcar as comissões como pagas';
end $$;

-- Encerrar o contrato: a mensalidade futura em aberto é cancelada (e a comissão dela).
update public.contratos set status = 'encerrado' where id = '00000000-0000-0000-0000-0000000c7001';
do $$ declare l record; begin
  select * into l from public.lancamentos
   where contrato_id = '00000000-0000-0000-0000-0000000c7001' and competencia = pg_temp.mes(1);
  assert l.status = 'cancelado', 'Encerrar o contrato deveria cancelar a mensalidade futura';
  assert (select status from public.comissoes where lancamento_origem_id = l.id) = 'cancelada',
    'E a comissão dela também';
end $$;

reset role;

-- =============================================================================
-- Quem vê o quê
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.comissoes) = 2, 'Vendedor A deveria ver só as 2 comissões dele';
  assert (select count(*) from public.fechamentos_comissao) = 1, 'Vendedor A deveria ver o fechamento dele';
  assert (select count(*) from public.configuracoes) = 0, 'Vendedor não deveria ver as configurações';
  begin
    perform public.fechar_comissoes('00000000-0000-0000-0000-0000000000b1', privado.hoje(), privado.hoje());
    raise exception 'FALHOU: vendedor fechou comissões';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.comissoes set valor = 9999;
    if found then raise exception 'FALHOU: vendedor alterou comissão'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000000b2');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.comissoes
           where vendedor_id = '00000000-0000-0000-0000-0000000000b1') = 0,
    'Vendedor B não deveria ver comissões do A';
  assert (select count(*) from public.contratos
           where id = '00000000-0000-0000-0000-0000000c7001') = 0,
    'Vendedor B não deveria ver contrato de cliente do A';
end $$;
reset role;

select 'Todos os testes de contratos e comissões passaram.' as resultado;

rollback;
