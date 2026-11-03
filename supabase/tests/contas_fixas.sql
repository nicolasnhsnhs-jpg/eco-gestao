-- =============================================================================
-- Testes das contas fixas (lançamentos recorrentes).
-- Roda numa transação desfeita no final (rollback): nada fica no banco.
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000002f1', 'fin.fixas@teste.local', '{"nome":"Financeiro Fixas"}'),
  ('00000000-0000-0000-0000-0000000002b1', 'vend.fixas@teste.local', '{"nome":"Vendedor Fixas"}');
update public.perfis set papel = 'financeiro' where id = '00000000-0000-0000-0000-0000000002f1';
update public.perfis set papel = 'vendedor'   where id = '00000000-0000-0000-0000-0000000002b1';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.categoria(nome_categoria text) returns uuid language sql as $$
  select id from public.categorias_financeiras where nome = nome_categoria
$$;

-- Meses curtos: dia 31 vira o último dia do mês.
do $$ begin
  assert privado.vencimento_recorrente('2027-02-01', 31::smallint) = '2027-02-28',
    'Dia 31 em fevereiro deveria vencer no dia 28';
  assert privado.vencimento_recorrente('2027-04-15', 10::smallint) = '2027-04-10',
    'Dia 10 de abril deveria vencer em 10/04';
end $$;

select pg_temp.como('00000000-0000-0000-0000-0000000002f1');
set local role authenticated;

-- =============================================================================
-- Cadastrar: já cria o lançamento pendente do mês atual e do próximo
-- =============================================================================
insert into public.lancamentos_recorrentes
  (id, tipo, descricao, categoria_id, valor, dia_vencimento, data_inicio, forma_pagamento)
values
  ('00000000-0000-0000-0000-0000000f1a01', 'saida', 'Aluguel', pg_temp.categoria('Aluguel'),
   2500, 10, date_trunc('month', privado.hoje())::date + 9, 'boleto');

do $$
declare
  v_mes  date := date_trunc('month', privado.hoje())::date;
  v_prox date := (date_trunc('month', privado.hoje()) + interval '1 month')::date;
begin
  assert (select count(*) from public.lancamentos
           where recorrente_id = '00000000-0000-0000-0000-0000000f1a01') = 2,
    'Deveria ter criado os lançamentos do mês atual e do próximo';
  assert exists (select 1 from public.lancamentos
                  where recorrente_id = '00000000-0000-0000-0000-0000000f1a01'
                    and competencia = v_mes and vencimento = v_mes + 9
                    and status = 'pendente' and valor = 2500 and tipo = 'saida'
                    and forma_pagamento = 'boleto'
                    and descricao = 'Aluguel – ' || to_char(v_mes, 'MM/YYYY')),
    'O lançamento deste mês deveria vencer no dia 10, pendente, com o mês na descrição';
  assert exists (select 1 from public.lancamentos
                  where recorrente_id = '00000000-0000-0000-0000-0000000f1a01'
                    and competencia = v_prox and vencimento = v_prox + 9),
    'O do próximo mês deveria vencer no dia 10 dele';
end $$;

-- Categoria de receita numa conta a pagar: recusada (senão travaria a geração mensal).
do $$ begin
  begin
    insert into public.lancamentos_recorrentes
      (tipo, descricao, categoria_id, valor, dia_vencimento, data_inicio)
    values ('saida', 'Errada', pg_temp.categoria('Outras receitas'), 10, 5, privado.hoje());
    raise exception 'FALHOU: aceitou categoria de receita numa conta fixa a pagar';
  exception when check_violation then null;
  end;
end $$;

-- =============================================================================
-- Alterar o valor: muda os em aberto que ainda não venceram
-- =============================================================================
update public.lancamentos_recorrentes set valor = 2700
 where id = '00000000-0000-0000-0000-0000000f1a01';

do $$ begin
  assert (select valor from public.lancamentos
           where recorrente_id = '00000000-0000-0000-0000-0000000f1a01'
             and competencia = (date_trunc('month', privado.hoje()) + interval '1 month')::date)
         = 2700,
    'O lançamento do próximo mês deveria ter o valor novo';
end $$;

-- Confirmar o do mês atual (o mesmo UPDATE que o sistema faz) e mudar o dia:
-- o já pago não muda.
insert into public.contas_bancarias (id, nome, saldo_inicial, data_saldo_inicial)
values ('00000000-0000-0000-0000-0000000f1b01', 'Conta Fixas', 0, privado.hoje() - 30);
update public.lancamentos
   set status = 'realizado', data_pagamento = privado.hoje(),
       conta_bancaria_id = '00000000-0000-0000-0000-0000000f1b01'
 where recorrente_id = '00000000-0000-0000-0000-0000000f1a01'
   and competencia = date_trunc('month', privado.hoje())::date;
update public.lancamentos_recorrentes set dia_vencimento = 20
 where id = '00000000-0000-0000-0000-0000000f1a01';

do $$
declare
  v_mes  date := date_trunc('month', privado.hoje())::date;
  v_prox date := (date_trunc('month', privado.hoje()) + interval '1 month')::date;
begin
  assert (select vencimento from public.lancamentos
           where recorrente_id = '00000000-0000-0000-0000-0000000f1a01' and competencia = v_mes)
         = v_mes + 9, 'O lançamento já pago não deveria mudar de vencimento';
  assert (select vencimento from public.lancamentos
           where recorrente_id = '00000000-0000-0000-0000-0000000f1a01' and competencia = v_prox)
         = v_prox + 19, 'O do próximo mês deveria passar a vencer no dia 20';
end $$;

reset role;

-- Rodar a geração de novo (como o agendamento diário faz) não duplica nada.
do $$ begin
  assert privado.gerar_lancamentos_recorrentes(privado.hoje()) = 0
     and privado.gerar_lancamentos_recorrentes((privado.hoje() + interval '1 month')::date) = 0,
    'A geração repetida não deveria criar lançamentos de novo';
end $$;

select pg_temp.como('00000000-0000-0000-0000-0000000002f1');
set local role authenticated;

-- =============================================================================
-- Encerrar: cancela os dos próximos meses em aberto
-- =============================================================================
update public.lancamentos_recorrentes set ativo = false
 where id = '00000000-0000-0000-0000-0000000f1a01';

do $$ begin
  assert (select status from public.lancamentos
           where recorrente_id = '00000000-0000-0000-0000-0000000f1a01'
             and competencia = (date_trunc('month', privado.hoje()) + interval '1 month')::date)
         = 'cancelado', 'O lançamento do próximo mês deveria ter sido cancelado';
  assert (select status from public.lancamentos
           where recorrente_id = '00000000-0000-0000-0000-0000000f1a01'
             and competencia = date_trunc('month', privado.hoje())::date)
         = 'realizado', 'O deste mês (já pago) deveria continuar como estava';
end $$;

reset role;

-- =============================================================================
-- Vendedor: não enxerga nem cadastra contas fixas
-- =============================================================================
-- O vendedor não enxerga as categorias: guarda uma antes de trocar de usuário.
select set_config('teste.categoria', pg_temp.categoria('Aluguel')::text, true);
select pg_temp.como('00000000-0000-0000-0000-0000000002b1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.lancamentos_recorrentes) = 0,
    'Vendedor não deveria ver contas fixas';
  begin
    insert into public.lancamentos_recorrentes
      (tipo, descricao, categoria_id, valor, dia_vencimento, data_inicio)
    values ('saida', 'X', current_setting('teste.categoria')::uuid, 1, 1, '2027-01-01');
    raise exception 'FALHOU: vendedor cadastrou conta fixa';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'Todos os testes de contas fixas passaram.' as resultado;

rollback;
