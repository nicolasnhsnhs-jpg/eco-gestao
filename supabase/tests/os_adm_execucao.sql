-- =============================================================================
-- O ADM preenche a execução da OS (como o Administrador); vendedor e recepção não.
-- Transação desfeita no final (rollback).
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000014a1', 'admexec.adm@teste.local', '{"nome":"ADM Execução"}'),
  ('00000000-0000-0000-0000-0000000014a2', 'admexec.op@teste.local', '{"nome":"Operador Execução"}'),
  ('00000000-0000-0000-0000-0000000014a3', 'admexec.vend@teste.local', '{"nome":"Vendedor Execução"}'),
  ('00000000-0000-0000-0000-0000000014a4', 'admexec.rec@teste.local', '{"nome":"Recepção Execução"}');
update public.perfis set papel = 'administrativo' where id = '00000000-0000-0000-0000-0000000014a1';
update public.perfis set papel = 'operador' where id = '00000000-0000-0000-0000-0000000014a2';
update public.perfis set papel = 'vendedor' where id = '00000000-0000-0000-0000-0000000014a3';
update public.perfis set papel = 'recepcao' where id = '00000000-0000-0000-0000-0000000014a4';

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

insert into public.clientes (id, tipo_pessoa, nome) values
  ('00000000-0000-0000-0000-00000000d001', 'PJ', 'Mercado [teste ADM execução]');

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

select pg_temp.como('00000000-0000-0000-0000-0000000014a1');
set local role authenticated;
insert into public.os_modelos (id, cliente_id, tipo_servico_id, descricao, operadores_padrao)
select '00000000-0000-0000-0000-00000000d010', '00000000-0000-0000-0000-00000000d001', t.id,
       'Serviço de teste', array['00000000-0000-0000-0000-0000000014a2'::uuid]
  from public.tipos_servico t where t.formulario_os = 'generico'
 order by t.nome limit 1;
insert into ids values
  ('os', public.gerar_os_do_modelo('00000000-0000-0000-0000-00000000d010', current_date));
reset role;

-- Vendedor e recepção não preenchem.
select pg_temp.como('00000000-0000-0000-0000-0000000014a3');
set local role authenticated;
do $$
begin
  perform public.iniciar_os((select id from ids where nome = 'os'));
  raise exception 'FALHOU: vendedor iniciou a OS';
exception when insufficient_privilege then null;
end
$$;
update public.os_execucao set resultado = 'vendedor' where os_id = (select id from ids where nome = 'os');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000014a4');
set local role authenticated;
update public.os_execucao set resultado = 'recepção' where os_id = (select id from ids where nome = 'os');
reset role;
select pg_temp.conferir('vendedor e recepção não gravam na execução',
  (select count(*) from public.os_execucao
    where os_id = (select id from ids where nome = 'os') and resultado in ('vendedor', 'recepção')), 0);

-- O ADM inicia e preenche.
select pg_temp.como('00000000-0000-0000-0000-0000000014a1');
set local role authenticated;
select public.iniciar_os((select id from ids where nome = 'os'));
update public.os_execucao set resultado = 'Feito pelo ADM'
 where os_id = (select id from ids where nome = 'os');
reset role;

select pg_temp.conferir('ADM iniciou a OS',
  (select count(*) from public.ordens_servico
    where id = (select id from ids where nome = 'os') and status = 'em_execucao'), 1);
select pg_temp.conferir('ADM gravou na execução',
  (select count(*) from public.os_execucao
    where os_id = (select id from ids where nome = 'os') and resultado = 'Feito pelo ADM'), 1);

-- Concluir: o ADM passa da checagem de quem pode (pode faltar preencher algo, e
-- aí a recusa é outra, não a de "não é sua").
select pg_temp.como('00000000-0000-0000-0000-0000000014a1');
set local role authenticated;
do $$
begin
  perform public.concluir_os((select id from ids where nome = 'os'));
exception
  when insufficient_privilege then raise exception 'FALHOU: ADM barrado ao concluir: %', sqlerrm;
  when others then null;
end
$$;
reset role;

select 'os_adm_execucao: tudo certo' as resultado;
rollback;
