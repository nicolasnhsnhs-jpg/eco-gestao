-- =============================================================================
-- Testes dos custos da calculadora de orçamentos.
-- Admin vê e altera; Vendedor só vê; Financeiro e Recepção não veem.
-- Roda numa transação desfeita no final (rollback): nada fica no banco.
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000003a1', 'adm.orc@teste.local',  '{"nome":"Admin Orçamento"}'),
  ('00000000-0000-0000-0000-0000000003f1', 'fin.orc@teste.local',  '{"nome":"Financeiro Orçamento"}'),
  ('00000000-0000-0000-0000-0000000003b1', 'vend.orc@teste.local', '{"nome":"Vendedor Orçamento"}'),
  ('00000000-0000-0000-0000-0000000003c1', 'rec.orc@teste.local',  '{"nome":"Recepção Orçamento"}');
update public.perfis set papel = 'admin'      where id = '00000000-0000-0000-0000-0000000003a1';
update public.perfis set papel = 'financeiro' where id = '00000000-0000-0000-0000-0000000003f1';
update public.perfis set papel = 'vendedor'   where id = '00000000-0000-0000-0000-0000000003b1';
update public.perfis set papel = 'recepcao'   where id = '00000000-0000-0000-0000-0000000003c1';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

-- Admin cadastra (upsert, como a tela faz) e altera.
select pg_temp.como('00000000-0000-0000-0000-0000000003a1');
set local role authenticated;
insert into public.custos_orcamento (chave, valor) values
  ('teste_orc.produto_m2', 0.5), ('teste_orc.margem_ideal', 30), ('teste_orc.vazio', null)
on conflict (chave) do update set valor = excluded.valor;
insert into public.custos_orcamento (chave, valor) values ('teste_orc.produto_m2', 0.75)
on conflict (chave) do update set valor = excluded.valor;

do $$ begin
  assert (select valor from public.custos_orcamento where chave = 'teste_orc.produto_m2') = 0.75,
    'O admin deveria conseguir alterar o custo';
  assert (select atualizado_por from public.custos_orcamento where chave = 'teste_orc.produto_m2')
         = '00000000-0000-0000-0000-0000000003a1',
    'Deveria carimbar quem alterou';
end $$;

-- Margem de 100% ou mais não fecha a conta.
do $$ begin
  begin
    insert into public.custos_orcamento (chave, valor) values ('teste_orc.margem_maxima', 100);
    raise exception 'deveria ter recusado';
  exception when check_violation then null;
  end;
end $$;
reset role;

-- Vendedor vê, mas não altera.
select pg_temp.como('00000000-0000-0000-0000-0000000003b1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.custos_orcamento where chave like 'teste_orc.%') = 3,
    'O vendedor deveria ver os custos';
  update public.custos_orcamento set valor = 0 where chave = 'teste_orc.produto_m2';
  assert not found, 'O vendedor não deveria conseguir alterar';
  begin
    insert into public.custos_orcamento (chave, valor) values ('teste_orc.outro', 1);
    raise exception 'deveria ter recusado';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Financeiro e Recepção não veem.
select pg_temp.como('00000000-0000-0000-0000-0000000003f1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.custos_orcamento) = 0, 'O financeiro não deveria ver';
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000003c1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.custos_orcamento) = 0, 'A recepção não deveria ver';
end $$;
reset role;

select 'Todos os testes dos custos de orçamento passaram.' as resultado;

rollback;
