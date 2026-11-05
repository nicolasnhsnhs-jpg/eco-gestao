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
