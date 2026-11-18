-- =============================================================================
-- Ocorrências da OS: várias por OS; sanado encerra, reforço volta na próxima visita.
--
-- Confere que:
--   - o escritório põe mais de uma ocorrência na OS (o operador não consegue);
--   - a OS nova do mesmo serviço e local já vem com as ocorrências abertas;
--   - cada ocorrência precisa de resposta do técnico para concluir;
--   - sanado: some das OS ainda não começadas e não volta mais;
--   - reforço: continua aberta e entra nas OS já agendadas para depois;
--   - o escritório tirar da OS uma que veio de antes dá ela como sanada.
-- Transação desfeita no final (rollback).
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000011a1', 'ocorr.adm@teste.local', '{"nome":"ADM Ocorrência"}'),
  ('00000000-0000-0000-0000-0000000011a2', 'ocorr.op@teste.local', '{"nome":"Operador Ocorrência"}');
update public.perfis set papel = 'administrativo' where id = '00000000-0000-0000-0000-0000000011a1';
update public.perfis set papel = 'operador' where id = '00000000-0000-0000-0000-0000000011a2';

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
  ('00000000-0000-0000-0000-00000000b001', 'PJ', 'Mercado [teste ocorrências]');

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

select pg_temp.como('00000000-0000-0000-0000-0000000011a1');
set local role authenticated;

insert into public.os_modelos (id, cliente_id, tipo_servico_id, descricao, operadores_padrao)
select '00000000-0000-0000-0000-00000000b010', '00000000-0000-0000-0000-00000000b001', t.id,
       'Serviço de teste', array['00000000-0000-0000-0000-0000000011a2'::uuid]
  from public.tipos_servico t where t.formulario_os = 'generico'
 order by t.nome limit 1;

insert into ids values
  ('os1', public.gerar_os_do_modelo('00000000-0000-0000-0000-00000000b010', '2026-11-10')),
  -- Já agendada para depois, antes de existir a ocorrência.
  ('os2', public.gerar_os_do_modelo('00000000-0000-0000-0000-00000000b010', '2026-12-10'));

select public.salvar_ocorrencias_os((select id from ids where nome = 'os1'),
  '[{"texto": "Roedores na expedição"}, {"texto": "Baratas na cozinha"}, {"texto": "  "}]');
insert into ids select 'A', id from public.ocorrencias where texto = 'Roedores na expedição';
insert into ids select 'B', id from public.ocorrencias where texto = 'Baratas na cozinha';

insert into ids values
  ('os3', public.gerar_os_do_modelo('00000000-0000-0000-0000-00000000b010', '2027-01-10'));
reset role;

select pg_temp.conferir('duas ocorrências na OS 1 (a vazia não conta)',
  (select count(*) from public.os_ocorrencias where os_id = (select id from ids where nome = 'os1')), 2);
select pg_temp.conferir('OS nova do mesmo local já vem com as abertas',
  (select count(*) from public.os_ocorrencias where os_id = (select id from ids where nome = 'os3')), 2);
select pg_temp.conferir('OS agendada antes não ganha as ocorrências novas',
  (select count(*) from public.os_ocorrencias where os_id = (select id from ids where nome = 'os2')), 0);

-- O operador não mexe nas ocorrências.
select pg_temp.como('00000000-0000-0000-0000-0000000011a2');
set local role authenticated;
do $$
begin
  perform public.salvar_ocorrencias_os((select id from ids where nome = 'os1'), '[]');
  raise exception 'FALHOU: operador mudou as ocorrências';
exception when insufficient_privilege then null;
end $$;

select pg_temp.conferir('operador vê as ocorrências da sua OS',
  (select count(*) from public.ocorrencias o
     join public.os_ocorrencias l on l.ocorrencia_id = o.id
    where l.os_id = (select id from ids where nome = 'os1')), 2);
select pg_temp.conferir('pendência: ocorrência sem resposta',
  (select count(*) from unnest(public.pendencias_os((select id from ids where nome = 'os1'))) p
    where p = 'confirmação da ocorrência'), 1);

-- Técnico responde: A sanada, B precisa de reforço.
update public.os_execucao
   set ocorrencias_resultado = jsonb_build_object(
         (select id from ids where nome = 'A')::text, 'sanado',
         (select id from ids where nome = 'B')::text, 'reforco')
 where os_id = (select id from ids where nome = 'os1');

select pg_temp.conferir('respondidas: sem pendência de ocorrência',
  (select count(*) from unnest(public.pendencias_os((select id from ids where nome = 'os1'))) p
    where p = 'confirmação da ocorrência'), 0);
reset role;

select pg_temp.conferir('A sanada',
  (select count(*) from public.ocorrencias
    where id = (select id from ids where nome = 'A') and sanada_em is not null
      and sanada_na_os_id = (select id from ids where nome = 'os1')), 1);
select pg_temp.conferir('B continua aberta',
  (select count(*) from public.ocorrencias
    where id = (select id from ids where nome = 'B') and sanada_em is null), 1);
select pg_temp.conferir('A saiu da OS 3 (ainda não começada)',
  (select count(*) from public.os_ocorrencias
    where os_id = (select id from ids where nome = 'os3') and ocorrencia_id = (select id from ids where nome = 'A')), 0);
select pg_temp.conferir('A continua na OS 1 (é onde foi respondida)',
  (select count(*) from public.os_ocorrencias
    where os_id = (select id from ids where nome = 'os1') and ocorrencia_id = (select id from ids where nome = 'A')), 1);
select pg_temp.conferir('B entrou na OS 2 já agendada para depois',
  (select count(*) from public.os_ocorrencias where os_id = (select id from ids where nome = 'os2')), 1);
select pg_temp.conferir('B continua na OS 3',
  (select count(*) from public.os_ocorrencias where os_id = (select id from ids where nome = 'os3')), 1);

-- Próxima OS: só a B.
select pg_temp.como('00000000-0000-0000-0000-0000000011a1');
set local role authenticated;
insert into ids values
  ('os4', public.gerar_os_do_modelo('00000000-0000-0000-0000-00000000b010', '2027-02-10'));
reset role;
select pg_temp.conferir('OS nova só com a que precisa de reforço',
  (select count(*) from public.os_ocorrencias
    where os_id = (select id from ids where nome = 'os4') and ocorrencia_id = (select id from ids where nome = 'B')), 1);
select pg_temp.conferir('OS nova sem a sanada',
  (select count(*) from public.os_ocorrencias where os_id = (select id from ids where nome = 'os4')), 1);

-- O escritório tira a B da OS 4: veio de antes, então é dada como sanada e sai das agendadas.
select pg_temp.como('00000000-0000-0000-0000-0000000011a1');
set local role authenticated;
select public.salvar_ocorrencias_os((select id from ids where nome = 'os4'),
  '[{"texto": "Formigas no depósito"}]');
reset role;
select pg_temp.conferir('B sanada pelo escritório',
  (select count(*) from public.ocorrencias
    where id = (select id from ids where nome = 'B') and sanada_em is not null), 1);
select pg_temp.conferir('B saiu das OS agendadas',
  (select count(*) from public.os_ocorrencias
    where ocorrencia_id = (select id from ids where nome = 'B')
      and os_id in (select id from ids where nome in ('os2', 'os3', 'os4'))), 0);
select pg_temp.conferir('B continua na OS 1 (histórico)',
  (select count(*) from public.os_ocorrencias
    where ocorrencia_id = (select id from ids where nome = 'B') and os_id = (select id from ids where nome = 'os1')), 1);
select pg_temp.conferir('nova ocorrência na OS 4',
  (select count(*) from public.os_ocorrencias l join public.ocorrencias o on o.id = l.ocorrencia_id
    where l.os_id = (select id from ids where nome = 'os4') and o.texto = 'Formigas no depósito'), 1);

-- Tirar a que nasceu na própria OS apaga de vez.
select pg_temp.como('00000000-0000-0000-0000-0000000011a1');
set local role authenticated;
select public.salvar_ocorrencias_os((select id from ids where nome = 'os4'), '[]');
reset role;
select pg_temp.conferir('ocorrência criada e tirada na mesma OS é apagada',
  (select count(*) from public.ocorrencias where texto = 'Formigas no depósito'), 0);

select 'os_ocorrencias: tudo certo' as resultado;
rollback;
