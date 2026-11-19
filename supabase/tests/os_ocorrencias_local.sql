-- =============================================================================
-- Ocorrências na O.S salva, antes de agendar a visita.
--
-- Confere que:
--   - o escritório escreve a ocorrência na O.S salva e a próxima OS já nasce com ela;
--   - a OS já agendada do local também recebe a ocorrência nova;
--   - o operador não consegue mexer;
--   - tirar uma que nunca foi para OS apaga; tirar uma que já está em OS dá como sanada
--     e tira das OS não começadas.
-- Transação desfeita no final (rollback).
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000013a1', 'ocloc.adm@teste.local', '{"nome":"ADM Ocorrência Local"}'),
  ('00000000-0000-0000-0000-0000000013a2', 'ocloc.op@teste.local', '{"nome":"Operador Ocorrência Local"}');
update public.perfis set papel = 'administrativo' where id = '00000000-0000-0000-0000-0000000013a1';
update public.perfis set papel = 'operador' where id = '00000000-0000-0000-0000-0000000013a2';

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
  ('00000000-0000-0000-0000-00000000c001', 'PJ', 'Mercado [teste ocorrências local]');

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

select pg_temp.como('00000000-0000-0000-0000-0000000013a1');
set local role authenticated;

insert into public.os_modelos (id, cliente_id, tipo_servico_id, descricao, operadores_padrao)
select '00000000-0000-0000-0000-00000000c010', '00000000-0000-0000-0000-00000000c001', t.id,
       'Serviço de teste', array['00000000-0000-0000-0000-0000000013a2'::uuid]
  from public.tipos_servico t where t.formulario_os = 'generico'
 order by t.nome limit 1;

-- OS já agendada antes de escrever as ocorrências.
insert into ids values
  ('os1', public.gerar_os_do_modelo('00000000-0000-0000-0000-00000000c010', '2026-12-10'));

-- Na O.S salva, antes de agendar a próxima.
select public.salvar_ocorrencias_local('00000000-0000-0000-0000-00000000c010',
  '[{"texto": "Pombos no telhado"}, {"texto": "Ninhos na marquise"}, {"texto": " "}]');
insert into ids select 'A', id from public.ocorrencias where texto = 'Pombos no telhado';
insert into ids select 'B', id from public.ocorrencias where texto = 'Ninhos na marquise';

insert into ids values
  ('os2', public.gerar_os_do_modelo('00000000-0000-0000-0000-00000000c010', '2027-01-10'));
reset role;

select pg_temp.conferir('duas ocorrências abertas no local (a vazia não conta)',
  (select count(*) from public.ocorrencias
    where cliente_id = '00000000-0000-0000-0000-00000000c001' and sanada_em is null), 2);
select pg_temp.conferir('OS agendada depois já nasce com as duas',
  (select count(*) from public.os_ocorrencias where os_id = (select id from ids where nome = 'os2')), 2);
select pg_temp.conferir('OS já agendada também recebe as duas',
  (select count(*) from public.os_ocorrencias where os_id = (select id from ids where nome = 'os1')), 2);

-- O operador não mexe.
select pg_temp.como('00000000-0000-0000-0000-0000000013a2');
set local role authenticated;
do $$
begin
  perform public.salvar_ocorrencias_local('00000000-0000-0000-0000-00000000c010', '[]');
  raise exception 'FALHOU: operador mudou as ocorrências do local';
exception when insufficient_privilege then null;
end
$$;
reset role;

-- Muda o texto de A e tira B (B já estava em OS não começadas: vira sanada e sai delas).
select pg_temp.como('00000000-0000-0000-0000-0000000013a1');
set local role authenticated;
select public.salvar_ocorrencias_local('00000000-0000-0000-0000-00000000c010',
  json_build_array(json_build_object('id', (select id from ids where nome = 'A'),
                                     'texto', 'Pombos no telhado e na calha'))::jsonb);
reset role;

select pg_temp.conferir('texto de A mudou',
  (select count(*) from public.ocorrencias where texto = 'Pombos no telhado e na calha'), 1);
select pg_temp.conferir('B saiu das OS não começadas',
  (select count(*) from public.os_ocorrencias where ocorrencia_id = (select id from ids where nome = 'B')), 0);
select pg_temp.conferir('B some (não ficou em nenhuma OS)',
  (select count(*) from public.ocorrencias where id = (select id from ids where nome = 'B')), 0);

-- Uma nova que nunca foi para OS (sem OS agendada) e é tirada: apagada.
select pg_temp.como('00000000-0000-0000-0000-0000000013a1');
set local role authenticated;
update public.ordens_servico set status = 'cancelada'
 where id in (select id from ids where nome in ('os1', 'os2'));
select public.salvar_ocorrencias_local('00000000-0000-0000-0000-00000000c010',
  json_build_array(json_build_object('id', (select id from ids where nome = 'A'), 'texto', 'Pombos no telhado e na calha'),
                   json_build_object('texto', 'Morcegos no forro'))::jsonb);
select public.salvar_ocorrencias_local('00000000-0000-0000-0000-00000000c010',
  json_build_array(json_build_object('id', (select id from ids where nome = 'A'), 'texto', 'Pombos no telhado e na calha'))::jsonb);
reset role;
select pg_temp.conferir('ocorrência nova tirada antes de ir para OS é apagada',
  (select count(*) from public.ocorrencias where texto = 'Morcegos no forro'), 0);
select pg_temp.conferir('A continua aberta',
  (select count(*) from public.ocorrencias where id = (select id from ids where nome = 'A') and sanada_em is null), 1);

select 'os_ocorrencias_local: tudo certo' as resultado;
rollback;
