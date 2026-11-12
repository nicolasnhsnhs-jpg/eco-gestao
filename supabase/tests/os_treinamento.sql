-- =============================================================================
-- OS de treinamento: cada técnico ganha a sua cópia, separada do cliente.
--
-- Confere que:
--   - o escritório monta o teste a partir de uma OS de verdade, uma cópia por técnico;
--   - o operador não consegue montar teste;
--   - a cópia tem número TESTE-…, não gasta a numeração das OS e não tem modelo;
--   - cada técnico só vê a sua cópia;
--   - concluir exige o mesmo preenchimento (inclusive confirmar a ocorrência do
--     escritório), mas não registra serviço realizado;
--   - o escritório apaga os testes (inclusive concluídos, com fotos e assinaturas).
-- Transação desfeita no final (rollback).
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000010a1', 'treino.adm@teste.local', '{"nome":"ADM Treino"}'),
  ('00000000-0000-0000-0000-0000000010a2', 'treino.op1@teste.local', '{"nome":"Operador Treino 1"}'),
  ('00000000-0000-0000-0000-0000000010a3', 'treino.op2@teste.local', '{"nome":"Operador Treino 2"}');
update public.perfis set papel = 'administrativo' where id = '00000000-0000-0000-0000-0000000010a1';
update public.perfis set papel = 'operador'
 where id in ('00000000-0000-0000-0000-0000000010a2', '00000000-0000-0000-0000-0000000010a3');

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
  ('00000000-0000-0000-0000-00000000a001', 'PJ', 'Indústria [teste treinamento]');

select pg_temp.como('00000000-0000-0000-0000-0000000010a1');
set local role authenticated;

insert into public.os_modelos (id, cliente_id, tipo_servico_id, descricao, operadores_padrao)
select '00000000-0000-0000-0000-00000000a010', '00000000-0000-0000-0000-00000000a001', t.id,
       'Entrega de telas', array['00000000-0000-0000-0000-0000000010a2'::uuid]
  from public.tipos_servico t where t.formulario_os = 'telas'
 order by t.nome limit 1;

insert into public.pontos_controle (modelo_id, tipo, numero, area, quantidade, quantidade_telas) values
  ('00000000-0000-0000-0000-00000000a010', 'coifa', 1, 'Coifa do fogão', 1, 10);

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('origem', public.gerar_os_do_modelo('00000000-0000-0000-0000-00000000a010', '2026-11-12'));
-- Ocorrência do escritório (vai junto para o teste).
update public.ordens_servico set ocorrencia = 'Roedores no setor de expedição'
 where id = (select id from ids where nome = 'origem');
reset role;

create temp table contagem (servicos bigint, numero_os integer) on commit drop;
grant all on contagem to authenticated;
insert into contagem
select (select count(*) from public.servicos),
       coalesce((select valor from privado.contadores
                  where chave = 'os-' || to_char(privado.hoje(), 'YYYY')), 0);

-- O operador não monta teste.
select pg_temp.como('00000000-0000-0000-0000-0000000010a2');
set local role authenticated;
do $$
begin
  perform public.criar_treinamento_os((select id from ids where nome = 'origem'),
                                      array['00000000-0000-0000-0000-0000000010a2'::uuid]);
  raise exception 'FALHOU: operador montou treinamento';
exception when insufficient_privilege then null;
end $$;
reset role;

-- O ADM monta para os dois técnicos.
select pg_temp.como('00000000-0000-0000-0000-0000000010a1');
set local role authenticated;
select pg_temp.conferir('cópias criadas',
  public.criar_treinamento_os((select id from ids where nome = 'origem'),
    array['00000000-0000-0000-0000-0000000010a2', '00000000-0000-0000-0000-0000000010a3']::uuid[]), 2);
reset role;

insert into ids
select 'teste1', s.id from public.ordens_servico s join public.os_operadores o on o.os_id = s.id
 where s.treinamento and o.operador_id = '00000000-0000-0000-0000-0000000010a2'
   and s.cliente_id = '00000000-0000-0000-0000-00000000a001';

select pg_temp.conferir('número do teste',
  (select count(*) from public.ordens_servico
    where treinamento and cliente_id = '00000000-0000-0000-0000-00000000a001'
      and numero like 'TESTE-%' and modelo_id is null and status = 'agendada'), 2);
select pg_temp.conferir('numeração das OS não mudou',
  coalesce((select valor from privado.contadores
             where chave = 'os-' || to_char(privado.hoje(), 'YYYY')), 0),
  (select numero_os from contagem));
select pg_temp.conferir('ocorrência copiada para o teste',
  (select count(*) from public.ordens_servico
    where id = (select id from ids where nome = 'teste1') and ocorrencia like 'Roedores%'), 1);
select pg_temp.conferir('pontos copiados sem ligação com o cliente',
  (select count(*) from public.os_pontos
    where os_id = (select id from ids where nome = 'teste1')
      and ponto_id is null and quantidade_telas = 10), 1);

-- Cada técnico vê só a sua.
select pg_temp.como('00000000-0000-0000-0000-0000000010a2');
set local role authenticated;
select pg_temp.conferir('técnico 1 vê só o seu teste',
  (select count(*) from public.ordens_servico where treinamento), 1);

insert into public.arquivos (id, cliente_id, os_id, caminho_storage, nome_original, categoria, enviado_por)
select gen_random_uuid(), '00000000-0000-0000-0000-00000000a001', ids.id,
       'clientes/00000000-0000-0000-0000-00000000a001/os/' || ids.id || '/' || n,
       n, 'assinatura', '00000000-0000-0000-0000-0000000010a2'
  from ids, (values ('cliente.png'), ('operador.png')) f(n)
 where ids.nome = 'teste1';

select public.iniciar_os((select id from ids where nome = 'teste1'));

-- Mesma regra da OS real: falta preencher, não conclui.
do $$
declare v_msg text;
begin
  perform public.concluir_os((select id from ids where nome = 'teste1'));
  raise exception 'FALHOU: teste concluiu sem preencher';
exception when check_violation then
  get stacked diagnostics v_msg = message_text;
  if v_msg not like '%horário de chegada%' or v_msg not like '%conferência com o cliente%'
     or v_msg not like '%confirmação da ocorrência%' then
    raise exception 'FALHOU: pendências do teste diferentes: %', v_msg;
  end if;
end $$;

update public.os_execucao e
   set hora_chegada = '2026-11-12 08:50-03', hora_inicio = '2026-11-12 08:55-03',
       hora_termino = '2026-11-12 09:30-03', hora_saida = '2026-11-12 09:40-03',
       operador_nome = 'Operador Treino 1', responsavel_nome = 'Fulano', responsavel_setor = 'Cozinha',
       checklist = '{"autorizado": {"sim": true}, "instaladas": {"sim": true}}',
       ocorrencia_resolvida = true,
       assinatura_cliente_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'cliente.png'),
       assinatura_operador_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'operador.png')
 where os_id = (select id from ids where nome = 'teste1');
select public.concluir_os((select id from ids where nome = 'teste1'));
reset role;

select pg_temp.conferir('teste concluído',
  (select count(*) from public.ordens_servico
    where id = (select id from ids where nome = 'teste1') and status = 'concluida'
      and servico_id is null), 1);
select pg_temp.conferir('nenhum serviço realizado registrado',
  (select count(*) from public.servicos), (select servicos from contagem));

-- O operador não apaga; o ADM apaga todos (o concluído também).
select pg_temp.como('00000000-0000-0000-0000-0000000010a2');
set local role authenticated;
do $$
begin
  perform public.apagar_treinamentos_os();
  raise exception 'FALHOU: operador apagou treinamento';
exception when insufficient_privilege then null;
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000010a1');
set local role authenticated;
select pg_temp.conferir('caminhos das fotos devolvidos',
  cardinality(public.apagar_treinamentos_os()), 2);
reset role;

select pg_temp.conferir('testes apagados',
  (select count(*) from public.ordens_servico
    where cliente_id = '00000000-0000-0000-0000-00000000a001' and treinamento), 0);
select pg_temp.conferir('OS de verdade continua',
  (select count(*) from public.ordens_servico where id = (select id from ids where nome = 'origem')), 1);

select 'Treinamento: cópias, conclusão e limpeza conferidas.' as resultado;

rollback;
