-- =============================================================================
-- Ordem das OS do operador: cada um grava e vê só a dele.
-- Transação desfeita no final (rollback).
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000012a1', 'ordem.op1@teste.local', '{"nome":"Operador Ordem 1"}'),
  ('00000000-0000-0000-0000-0000000012a2', 'ordem.op2@teste.local', '{"nome":"Operador Ordem 2"}');
update public.perfis set papel = 'operador'
 where id in ('00000000-0000-0000-0000-0000000012a1', '00000000-0000-0000-0000-0000000012a2');

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.conferir(o_que text, obtido bigint, esperado bigint)
returns void language plpgsql as $$
begin
  if obtido is distinct from esperado then
    raise exception 'FALHOU: % deveria ser %, mas é %', o_que, esperado, obtido;
  end if;
end
$$;

-- Operador 1 grava a ordem dele (e muda depois).
select pg_temp.como('00000000-0000-0000-0000-0000000012a1');
set local role authenticated;
insert into public.os_ordem_operador (operador_id, os_ids)
values ('00000000-0000-0000-0000-0000000012a1', array[gen_random_uuid(), gen_random_uuid()]);
insert into public.os_ordem_operador (operador_id, os_ids)
values ('00000000-0000-0000-0000-0000000012a1', array[gen_random_uuid()])
on conflict (operador_id) do update set os_ids = excluded.os_ids, atualizado_em = now();
select pg_temp.conferir('operador 1 vê a ordem dele',
  (select cardinality(os_ids) from public.os_ordem_operador), 1);

-- Não grava a ordem de outro.
do $$
begin
  insert into public.os_ordem_operador (operador_id, os_ids)
  values ('00000000-0000-0000-0000-0000000012a2', '{}');
  raise exception 'FALHOU: operador gravou a ordem de outro';
exception when insufficient_privilege then null;
end
$$;
reset role;

-- Operador 2 não vê nem muda a do operador 1.
select pg_temp.como('00000000-0000-0000-0000-0000000012a2');
set local role authenticated;
select pg_temp.conferir('operador 2 não vê a ordem do 1',
  (select count(*) from public.os_ordem_operador), 0);
update public.os_ordem_operador set os_ids = '{}';
reset role;
select pg_temp.conferir('a ordem do operador 1 continua igual',
  (select cardinality(os_ids) from public.os_ordem_operador
    where operador_id = '00000000-0000-0000-0000-0000000012a1'), 1);

select 'os_ordem_operador: tudo certo' as resultado;
rollback;
