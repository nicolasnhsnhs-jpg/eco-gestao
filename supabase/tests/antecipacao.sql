-- =============================================================================
-- Testes da antecipação de recebíveis.
-- Roda numa transação desfeita no final (rollback): nada fica no banco.
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000002f1', 'fin.antecipa@teste.local', '{"nome":"Financeiro Antecipa"}'),
  ('00000000-0000-0000-0000-0000000002a1', 'adm.antecipa@teste.local', '{"nome":"Admin Antecipa"}'),
  ('00000000-0000-0000-0000-0000000002b1', 'vend.antecipa@teste.local', '{"nome":"Vendedor Antecipa"}');
update public.perfis set papel = 'financeiro' where id = '00000000-0000-0000-0000-0000000002f1';
update public.perfis set papel = 'admin'      where id = '00000000-0000-0000-0000-0000000002a1';
update public.perfis set papel = 'vendedor'   where id = '00000000-0000-0000-0000-0000000002b1';

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

select pg_temp.como('00000000-0000-0000-0000-0000000002f1');
set local role authenticated;

insert into public.contas_bancarias (id, nome, saldo_inicial, data_saldo_inicial)
values ('00000000-0000-0000-0000-0000000d1a01', 'Sicredi Teste', 1000, privado.hoje() - 30);

-- Três boletos de clientes (soma 1.000,00) e uma conta a pagar.
insert into public.lancamentos (id, tipo, descricao, categoria_id, competencia, vencimento, valor) values
  ('00000000-0000-0000-0000-0000000d1b01', 'entrada', 'Boleto A', pg_temp.categoria('Serviços prestados'),
   privado.hoje(), privado.hoje() + 30, 333.33),
  ('00000000-0000-0000-0000-0000000d1b02', 'entrada', 'Boleto B', pg_temp.categoria('Serviços prestados'),
   privado.hoje(), privado.hoje() + 60, 333.33),
  ('00000000-0000-0000-0000-0000000d1b03', 'entrada', 'Boleto C', pg_temp.categoria('Serviços prestados'),
   privado.hoje(), privado.hoje() + 90, 333.34),
  ('00000000-0000-0000-0000-0000000d1b04', 'saida', 'Aluguel', pg_temp.categoria('Aluguel'),
   privado.hoje(), privado.hoje() + 10, 500);

-- =============================================================================
-- Recusas: conta a pagar, desconto maior que o total
-- =============================================================================
do $$ begin
  begin
    perform public.antecipar_recebiveis(
      array['00000000-0000-0000-0000-0000000d1b01', '00000000-0000-0000-0000-0000000d1b04']::uuid[],
      privado.hoje(), '00000000-0000-0000-0000-0000000d1a01', 'Sicredi', 10);
    raise exception 'FALHOU: antecipou uma conta a pagar';
  exception when check_violation then null;
  end;
  begin
    perform public.antecipar_recebiveis(
      array['00000000-0000-0000-0000-0000000d1b01']::uuid[],
      privado.hoje(), '00000000-0000-0000-0000-0000000d1a01', 'Sicredi', 333.33);
    raise exception 'FALHOU: aceitou desconto igual ao total';
  exception when check_violation then null;
  end;
end $$;

-- =============================================================================
-- Antecipa os três com 100,00 de desconto (rateio com centavos sobrando)
-- =============================================================================
do $$
declare v_id uuid;
begin
  v_id := public.antecipar_recebiveis(
    array['00000000-0000-0000-0000-0000000d1b01', '00000000-0000-0000-0000-0000000d1b02',
          '00000000-0000-0000-0000-0000000d1b03']::uuid[],
    privado.hoje(), '00000000-0000-0000-0000-0000000d1a01', '  Sicredi ', 100);

  assert (select valor_bruto from public.antecipacoes where id = v_id) = 1000, 'Bruto deveria ser 1000';
  assert (select valor_liquido from public.antecipacoes where id = v_id) = 900, 'Líquido deveria ser 900';
  assert (select instituicao from public.antecipacoes where id = v_id) = 'Sicredi', 'Instituição sem espaços';

  assert (select sum(valor_pago) from public.lancamentos where antecipacao_id = v_id) = 900,
    'A soma recebida deveria fechar exatamente com o líquido (900)';
  assert (select count(*) from public.lancamentos
           where antecipacao_id = v_id and status = 'realizado' and data_pagamento = privado.hoje()) = 3,
    'Os três deveriam ficar realizados hoje';
  -- O vencimento do cliente continua o mesmo.
  assert (select vencimento from public.lancamentos where id = '00000000-0000-0000-0000-0000000d1b03')
         = privado.hoje() + 90, 'Vencimento original deveria ser mantido';

  -- Saldo sobe só o líquido; a receber cai o bruto.
  assert (select saldo_atual from public.v_saldos_contas
           where id = '00000000-0000-0000-0000-0000000d1a01') = 1900,
    'Conta deveria ter 1000 + 900 (líquido) = 1900';
  assert (public.painel_financeiro() ->> 'a_receber')::numeric = 0,
    'Nada deveria ficar a receber depois de antecipar tudo';
end $$;

-- Não antecipa duas vezes.
do $$ begin
  begin
    perform public.antecipar_recebiveis(
      array['00000000-0000-0000-0000-0000000d1b01']::uuid[],
      privado.hoje(), '00000000-0000-0000-0000-0000000d1a01', 'Sicredi', 0);
    raise exception 'FALHOU: antecipou duas vezes';
  exception when check_violation then null;
  end;
end $$;

-- O financeiro não desfaz.
do $$ begin
  begin
    perform public.desfazer_antecipacao((select id from public.antecipacoes where not desfeita limit 1));
    raise exception 'FALHOU: financeiro desfez antecipação';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- =============================================================================
-- Admin desfaz: tudo volta a ficar em aberto, e o saldo volta
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000002a1');
set local role authenticated;
do $$
declare v_id uuid := (select id from public.antecipacoes where not desfeita limit 1);
begin
  perform public.desfazer_antecipacao(v_id);
  assert (select desfeita from public.antecipacoes where id = v_id), 'Deveria ficar marcada como desfeita';
  assert (select count(*) from public.lancamentos
           where id in ('00000000-0000-0000-0000-0000000d1b01', '00000000-0000-0000-0000-0000000d1b02',
                        '00000000-0000-0000-0000-0000000d1b03')
             and status = 'pendente' and antecipacao_id is null and valor_pago is null) = 3,
    'Os três deveriam voltar a ficar em aberto';
  assert (select saldo_atual from public.v_saldos_contas
           where id = '00000000-0000-0000-0000-0000000d1a01') = 1000,
    'Saldo deveria voltar para 1000';
end $$;
reset role;

-- =============================================================================
-- Notas avulsas (tela das notas): acha a conta do cliente ou cria no Sicredi
-- =============================================================================
reset role;
insert into public.clientes (id, tipo_pessoa, nome) values
  ('00000000-0000-0000-0000-0000000d1c01', 'PF', 'Cliente Avulsa Teste');
insert into public.contas_bancarias (id, nome, saldo_inicial, data_saldo_inicial)
values ('00000000-0000-0000-0000-0000000d1a02', 'Banco Outro', 0, privado.hoje() - 30);
-- Conta a receber lançada à parte, com o mesmo valor da nota 1.
insert into public.lancamentos (id, tipo, descricao, cliente_id, categoria_id, competencia, vencimento, valor)
values ('00000000-0000-0000-0000-0000000d1b11', 'entrada', 'Serviço avulso', '00000000-0000-0000-0000-0000000d1c01',
        pg_temp.categoria('Serviços prestados'), privado.hoje(), privado.hoje() + 20, 980);
insert into public.notas_fiscais (id, tipo, status, cliente_id, numero, data_emissao, competencia,
                                  vencimento, descricao, valor_servico) values
  ('00000000-0000-0000-0000-0000000d1d01', 'avulsa', 'emitida', '00000000-0000-0000-0000-0000000d1c01',
   '9001', privado.hoje(), date_trunc('month', privado.hoje())::date, privado.hoje() + 20,
   'Dedetização avulsa', 980),
  ('00000000-0000-0000-0000-0000000d1d02', 'avulsa', 'emitida', '00000000-0000-0000-0000-0000000d1c01',
   '9002', privado.hoje(), date_trunc('month', privado.hoje())::date, privado.hoje() + 25,
   'Limpeza de caixa avulsa', 980),
  ('00000000-0000-0000-0000-0000000d1d03', 'avulsa', 'rascunho', '00000000-0000-0000-0000-0000000d1c01',
   null, privado.hoje(), date_trunc('month', privado.hoje())::date, null, 'Rascunho', 50);
-- Nota 2 com retenções: ISS retido 2% (19,60) + IRRF 14,70 = 34,30 → líquido 945,70.
update public.notas_fiscais
   set iss_retido = true, aliquota_iss = 2, valor_irrf = 14.70
 where id = '00000000-0000-0000-0000-0000000d1d02';

select pg_temp.como('00000000-0000-0000-0000-0000000002f1');
set local role authenticated;
do $$
declare
  v_contas uuid[];
  v_nova   public.lancamentos;
  v_id     uuid;
begin
  v_contas := public.contas_das_notas(
    array['00000000-0000-0000-0000-0000000d1d01', '00000000-0000-0000-0000-0000000d1d02']::uuid[]);
  assert cardinality(v_contas) = 2, 'Devolve uma conta por nota';
  assert v_contas[1] = '00000000-0000-0000-0000-0000000d1b11', 'Nota 1 liga na conta já lançada';
  assert v_contas[2] <> v_contas[1], 'Nota 2 não reaproveita a conta da nota 1';
  select * into v_nova from public.lancamentos where id = v_contas[2];
  assert v_nova.conta_bancaria_id = '00000000-0000-0000-0000-0000000d1a01', 'Conta nova vai no Sicredi';
  assert v_nova.valor = 980 and v_nova.numero_nota_fiscal = '9002'
     and v_nova.cliente_id = '00000000-0000-0000-0000-0000000d1c01'
     and v_nova.vencimento = privado.hoje() + 25, 'Conta nova com os dados da nota';
  assert (select lancamento_id from public.notas_fiscais
           where id = '00000000-0000-0000-0000-0000000d1d02') = v_contas[2], 'Nota 2 ficou ligada';

  -- Chamar de novo não duplica nada.
  assert public.contas_das_notas(
    array['00000000-0000-0000-0000-0000000d1d01', '00000000-0000-0000-0000-0000000d1d02']::uuid[]) = v_contas,
    'Segunda chamada devolve as mesmas contas';

  -- A tela e o banco contam o líquido das notas (o valor do boleto), não o bruto.
  assert (select valor from public.valores_a_antecipar(v_contas) where id = v_contas[2]) = 945.70,
    'Conta da nota 2 antecipa o líquido';
  v_id := public.antecipar_recebiveis(v_contas, privado.hoje(),
            '00000000-0000-0000-0000-0000000d1a01', 'Sicredi', 60);
  assert (select valor_bruto from public.antecipacoes where id = v_id) = 1925.70,
    'Total = líquido das duas notas (980 + 945,70)';
  assert (select sum(valor_pago) from public.lancamentos where antecipacao_id = v_id) = 1865.70, 'Líquido';

  begin
    perform public.contas_das_notas(array['00000000-0000-0000-0000-0000000d1d03']::uuid[]);
    raise exception 'FALHOU: antecipou nota em rascunho';
  exception when check_violation then null;
  end;
end $$;
reset role;

-- =============================================================================
-- Vendedor: não vê nem antecipa
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000002b1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.antecipacoes) = 0, 'Vendedor não deveria ver antecipações';
  begin
    perform public.antecipar_recebiveis(
      array['00000000-0000-0000-0000-0000000d1b01']::uuid[],
      privado.hoje(), '00000000-0000-0000-0000-0000000d1a01', 'Sicredi', 0);
    raise exception 'FALHOU: vendedor antecipou';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'Todos os testes de antecipação passaram.' as resultado;

rollback;
