-- =============================================================================
-- OS de entrega de telas: coifas do local e regras para concluir.
--
-- Confere que:
--   - existe o tipo de serviço com o formulário "telas";
--   - a coifa da entrega de telas pode ser cadastrada sem material;
--   - a OS recebe as coifas com a quantidade de telas;
--   - concluir exige a liberação ("autorizada a instalação?") e a conferência
--     ("instaladas?"), e não pede nada da limpeza de coifa (sujidade, produto).
-- Transação desfeita no final (rollback).
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000009a1', 'telas.recepcao@teste.local', '{"nome":"Recepção Telas"}'),
  ('00000000-0000-0000-0000-0000000009a2', 'telas.op@teste.local',       '{"nome":"Operador Telas"}');
update public.perfis set papel = 'recepcao' where id = '00000000-0000-0000-0000-0000000009a1';
update public.perfis set papel = 'operador' where id = '00000000-0000-0000-0000-0000000009a2';

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
  ('00000000-0000-0000-0000-000000009a01', 'PJ', 'Indústria [teste telas]');

select pg_temp.conferir('tipo de serviço de entrega de telas existe',
  least((select count(*) from public.tipos_servico where formulario_os = 'telas'), 1), 1);

select pg_temp.como('00000000-0000-0000-0000-0000000009a1');
set local role authenticated;

insert into public.os_modelos (id, cliente_id, tipo_servico_id, descricao, operadores_padrao)
select '00000000-0000-0000-0000-000000009a10', '00000000-0000-0000-0000-000000009a01', t.id,
       'Entrega de telas', array['00000000-0000-0000-0000-0000000009a2'::uuid]
  from public.tipos_servico t where t.formulario_os = 'telas'
 order by t.nome limit 1;

insert into public.pontos_controle (modelo_id, tipo, numero, area, quantidade, quantidade_telas) values
  ('00000000-0000-0000-0000-000000009a10', 'coifa', 1, 'Coifa do fogão principal', 1, 14),
  ('00000000-0000-0000-0000-000000009a10', 'coifa', 2, 'Coifa da fritadeira', 1, 4);

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('os', public.gerar_os_do_modelo('00000000-0000-0000-0000-000000009a10', '2026-11-12'));
reset role;

select pg_temp.conferir('coifas copiadas com as telas',
  (select sum(quantidade_telas) from public.os_pontos
    where os_id = (select id from ids where nome = 'os') and tipo = 'coifa'), 18);

insert into public.arquivos (id, cliente_id, os_id, caminho_storage, nome_original, categoria, enviado_por)
select gen_random_uuid(), '00000000-0000-0000-0000-000000009a01', ids.id,
       'clientes/00000000-0000-0000-0000-000000009a01/os/' || ids.id || '/' || n,
       n, 'assinatura', '00000000-0000-0000-0000-0000000009a2'
  from ids, (values ('cliente.png'), ('operador.png')) f(n);

select pg_temp.como('00000000-0000-0000-0000-0000000009a2');
set local role authenticated;
select public.iniciar_os((select id from ids where nome = 'os'));

update public.os_execucao e
   set data = '2026-11-12', hora_chegada = '2026-11-12 08:50-03', hora_inicio = '2026-11-12 08:55-03',
       hora_termino = '2026-11-12 09:30-03', hora_saida = '2026-11-12 09:40-03',
       operador_nome = 'Operador Telas', responsavel_nome = 'Sr. Alex', responsavel_setor = 'Cozinha',
       assinatura_cliente_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'cliente.png'),
       assinatura_operador_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'operador.png')
 where os_id = (select id from ids where nome = 'os');

do $$
declare v_msg text;
begin
  begin
    perform public.concluir_os((select id from ids where nome = 'os'));
    raise exception 'FALHOU: concluiu sem liberação e conferência';
  exception when check_violation then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%liberação para instalação de telas%'
       or v_msg not like '%conferência com o cliente%' then
      raise exception 'FALHOU: pendências da entrega de telas incompletas: %', v_msg;
    end if;
    if v_msg like '%sujidade%' or v_msg like '%produto%' or v_msg like '%resultado%' then
      raise exception 'FALHOU: entrega de telas pediu campo de outro formulário: %', v_msg;
    end if;
  end;
end $$;

update public.os_execucao set checklist = '{
  "autorizado": {"sim": true},
  "instaladas": {"sim": false, "texto": "Fritadeira em uso, volta amanhã"}
}' where os_id = (select id from ids where nome = 'os');
select public.concluir_os((select id from ids where nome = 'os'));
reset role;

select pg_temp.conferir('entrega de telas concluída',
  (select count(*) from public.ordens_servico where id = (select id from ids where nome = 'os')
     and status = 'concluida'), 1);

select 'Entrega de telas: escopo e conclusão conferidos.' as resultado;

rollback;
