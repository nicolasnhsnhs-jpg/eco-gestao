-- =============================================================================
-- OS de controle de pragas: pontos de controle, exceções e histórico.
--
-- Confere que:
--   - a OS recebe a cópia dos pontos do modelo, com MS (isca) e M (placa de cola);
--   - o operador anota a situação, mas não muda o escopo nem vê o modelo;
--   - códigos errados para o tipo de isca são recusados;
--   - concluir exige o nível de infestação e a situação das armadilhas;
--   - a próxima visita traz a data da última troca de lâmpada.
-- Transação desfeita no final (rollback).
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000006c1', 'pragas.recepcao@teste.local', '{"nome":"Recepção Pragas"}'),
  ('00000000-0000-0000-0000-0000000006e1', 'pragas.op@teste.local',       '{"nome":"Operador Pragas"}');
update public.perfis set papel = 'recepcao' where id = '00000000-0000-0000-0000-0000000006c1';
update public.perfis set papel = 'operador' where id = '00000000-0000-0000-0000-0000000006e1';

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
  ('00000000-0000-0000-0000-000000006c01', 'PJ', 'Granja [teste pragas]');

-- Recepção monta o modelo com os pontos e agenda a OS
select pg_temp.como('00000000-0000-0000-0000-0000000006c1');
set local role authenticated;

insert into public.os_modelos (id, cliente_id, tipo_servico_id, descricao, operadores_padrao)
select '00000000-0000-0000-0000-000000006d01', '00000000-0000-0000-0000-000000006c01', t.id,
       'Monitoramento de roedores', array['00000000-0000-0000-0000-0000000006e1'::uuid]
  from public.tipos_servico t where t.nome = 'Controle de pragas';

insert into public.pontos_controle (modelo_id, tipo, numero, area, forma_iscagem, tipo_isca) values
  ('00000000-0000-0000-0000-000000006d01', 'porta_isca', 1, 'Expedição', 'PIE', 'IP'),
  ('00000000-0000-0000-0000-000000006d01', 'porta_isca', 2, 'Expedição', 'PIE', 'IP'),
  ('00000000-0000-0000-0000-000000006d01', 'porta_isca', 3, 'Depósito',  'PII', 'IP'),
  ('00000000-0000-0000-0000-000000006d01', 'porta_isca', 4, 'Depósito',  'PII', 'CO');
insert into public.pontos_controle (modelo_id, tipo, numero, area, modelo_armadilha) values
  ('00000000-0000-0000-0000-000000006d01', 'armadilha_luminosa', 1, 'Depósito Embal.', 'P');

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('os1', public.gerar_os_do_modelo('00000000-0000-0000-0000-000000006d01', '2026-11-05'));
reset role;

select pg_temp.conferir('pontos copiados para a OS',
  (select count(*) from public.os_pontos where os_id = (select id from ids where nome = 'os1')), 5);
select pg_temp.conferir('iscas começam MS e a placa de cola começa M',
  (select count(*) from public.os_pontos where os_id = (select id from ids where nome = 'os1')
     and ((tipo_isca = 'IP' and situacao = 'MS') or (tipo_isca = 'CO' and situacao = 'M'))), 4);

-- Operador
select pg_temp.como('00000000-0000-0000-0000-0000000006e1');
set local role authenticated;

select pg_temp.conferir('pontos do modelo visíveis ao operador',
  (select count(*) from public.pontos_controle where modelo_id = '00000000-0000-0000-0000-000000006d01'), 0);

-- Exceção: o porta-isca 2 teve consumo
update public.os_pontos set situacao = 'MC'
 where os_id = (select id from ids where nome = 'os1') and tipo = 'porta_isca' and numero = 2;

do $$ begin
  begin
    update public.os_pontos set numero = 99 where os_id = (select id from ids where nome = 'os1');
    raise exception 'FALHOU: operador mudou o número do ponto';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.os_pontos set situacao = 'MS'
     where os_id = (select id from ids where nome = 'os1') and tipo_isca = 'CO';
    raise exception 'FALHOU: aceitou "MS" numa placa de cola';
  exception when check_violation then null;
  end;
end $$;

-- Produto usado
insert into public.os_produtos (os_id, principio_ativo, forma, unidades, gramas)
values ((select id from ids where nome = 'os1'), 'Brodifacoum', 'bloco', 3, 60);

-- Preenche o comum e tenta concluir sem nível nem armadilha
select public.iniciar_os((select id from ids where nome = 'os1'));
update public.os_execucao
   set data = '2026-11-05', hora_chegada = '2026-11-05 10:30-03', hora_inicio = '2026-11-05 10:32-03',
       hora_termino = '2026-11-05 11:20-03', hora_saida = '2026-11-05 11:25-03',
       operador_nome = 'Operador Pragas', responsavel_nome = 'Cristian', responsavel_setor = 'Meio ambiente'
 where os_id = (select id from ids where nome = 'os1');
reset role;

insert into public.arquivos (id, cliente_id, os_id, caminho_storage, nome_original, categoria, enviado_por)
select gen_random_uuid(), '00000000-0000-0000-0000-000000006c01', ids.id,
       'clientes/00000000-0000-0000-0000-000000006c01/os/' || ids.id || '/' || n || '.png',
       n || '.png', 'assinatura', '00000000-0000-0000-0000-0000000006e1'
  from ids, unnest(array['cliente', 'operador']) n where ids.nome = 'os1';
update public.os_execucao e
   set assinatura_cliente_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'cliente.png'),
       assinatura_operador_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'operador.png')
 where os_id = (select id from ids where nome = 'os1');

select pg_temp.como('00000000-0000-0000-0000-0000000006e1');
set local role authenticated;
do $$
declare v_msg text;
begin
  begin
    perform public.concluir_os((select id from ids where nome = 'os1'));
    raise exception 'FALHOU: concluiu sem nível de infestação';
  exception when check_violation then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%nível de infestação%' or v_msg not like '%armadilhas 1%' then
      raise exception 'FALHOU: mensagem da conclusão sem as pendências de pragas: %', v_msg;
    end if;
  end;
end $$;

update public.os_execucao set checklist = '{"nivel_infestacao": "B"}'
 where os_id = (select id from ids where nome = 'os1');
update public.os_pontos set situacao_armadilha = 'LT', lampadas_trocadas = true, refil = 'T',
       higiene = 'S', capturas = '{"M": 3, "MQ": 2}'
 where os_id = (select id from ids where nome = 'os1') and tipo = 'armadilha_luminosa';
select public.concluir_os((select id from ids where nome = 'os1'));

-- Concluída: nada mais muda (0 linhas)
update public.os_pontos set situacao = 'CT'
 where os_id = (select id from ids where nome = 'os1') and numero = 1 and tipo = 'porta_isca';
do $$ begin
  begin
    insert into public.os_produtos (os_id, principio_ativo, forma)
    values ((select id from ids where nome = 'os1'), 'Depois de concluída', 'outro');
    raise exception 'FALHOU: registrou produto em OS concluída';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pg_temp.conferir('ponto alterado depois de concluída',
  (select count(*) from public.os_pontos where os_id = (select id from ids where nome = 'os1')
     and situacao = 'CT'), 0);
select pg_temp.conferir('exceção gravada',
  (select count(*) from public.os_pontos where os_id = (select id from ids where nome = 'os1')
     and numero = 2 and situacao = 'MC'), 1);

-- Próxima visita: traz a última troca de lâmpada
select pg_temp.como('00000000-0000-0000-0000-0000000006c1');
set local role authenticated;
insert into ids values
  ('os2', public.gerar_os_do_modelo('00000000-0000-0000-0000-000000006d01', '2026-12-05'));
reset role;

select pg_temp.conferir('última troca de lâmpada herdada da visita anterior',
  (select count(*) from public.os_pontos where os_id = (select id from ids where nome = 'os2')
     and tipo = 'armadilha_luminosa' and ultima_troca_lampada = '2026-11-05'), 1);
select pg_temp.conferir('nova visita começa sem as exceções da anterior',
  (select count(*) from public.os_pontos where os_id = (select id from ids where nome = 'os2')
     and situacao = 'MC'), 0);

select 'Controle de pragas: pontos, exceções e histórico conferidos.' as resultado;

rollback;
