-- =============================================================================
-- OS de limpeza de coifa: coifas do local e regras para concluir.
--
-- Confere que:
--   - a OS recebe as coifas do modelo (material, quantidade, telas);
--   - concluir exige liberação para trabalho, sujidade de cada coifa,
--     quantidade de produto e a conferência final com o cliente;
--   - o operador não altera o escopo da coifa.
-- Transação desfeita no final (rollback).
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007c1', 'coifa.recepcao@teste.local', '{"nome":"Recepção Coifa"}'),
  ('00000000-0000-0000-0000-0000000007e1', 'coifa.op@teste.local',       '{"nome":"Operador Coifa"}');
update public.perfis set papel = 'recepcao' where id = '00000000-0000-0000-0000-0000000007c1';
update public.perfis set papel = 'operador' where id = '00000000-0000-0000-0000-0000000007e1';

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
  ('00000000-0000-0000-0000-000000007c01', 'PJ', 'Restaurante [teste coifa]');

select pg_temp.como('00000000-0000-0000-0000-0000000007c1');
set local role authenticated;

insert into public.os_modelos (id, cliente_id, tipo_servico_id, descricao, operadores_padrao)
select '00000000-0000-0000-0000-000000007d01', '00000000-0000-0000-0000-000000007c01', t.id,
       'Limpeza das coifas da cozinha', array['00000000-0000-0000-0000-0000000007e1'::uuid]
  from public.tipos_servico t where t.nome = 'Limpeza de coifa';

insert into public.pontos_controle (modelo_id, tipo, numero, area, material, quantidade, quantidade_telas) values
  ('00000000-0000-0000-0000-000000007d01', 'coifa', 1, 'Coifa do fogão', 'inox', 1, 4),
  ('00000000-0000-0000-0000-000000007d01', 'coifa', 2, 'Coifa do forno', 'inox', 1, 2);

do $$ begin
  begin
    insert into public.pontos_controle (modelo_id, tipo, numero, area)
    values ('00000000-0000-0000-0000-000000007d01', 'coifa', 3, 'Sem material');
    raise exception 'FALHOU: aceitou coifa sem material';
  exception when check_violation then null;
  end;
end $$;

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('os', public.gerar_os_do_modelo('00000000-0000-0000-0000-000000007d01', '2026-11-04'));
reset role;

select pg_temp.conferir('coifas copiadas com os dados do escopo',
  (select count(*) from public.os_pontos where os_id = (select id from ids where nome = 'os')
     and tipo = 'coifa' and material = 'inox' and quantidade_telas is not null and situacao is null), 2);

-- Assinaturas (o envio pela tela passa pelo Storage; aqui basta o registro)
insert into public.arquivos (id, cliente_id, os_id, caminho_storage, nome_original, categoria, enviado_por)
select gen_random_uuid(), '00000000-0000-0000-0000-000000007c01', ids.id,
       'clientes/00000000-0000-0000-0000-000000007c01/os/' || ids.id || '/' || n || '.png',
       n || '.png', 'assinatura', '00000000-0000-0000-0000-0000000007e1'
  from ids, unnest(array['cliente', 'operador']) n;

select pg_temp.como('00000000-0000-0000-0000-0000000007e1');
set local role authenticated;
select public.iniciar_os((select id from ids where nome = 'os'));

do $$ begin
  begin
    update public.os_pontos set quantidade_telas = 9 where os_id = (select id from ids where nome = 'os');
    raise exception 'FALHOU: operador mudou o escopo da coifa';
  exception when insufficient_privilege then null;
  end;
end $$;

update public.os_execucao e
   set data = '2026-11-04', hora_chegada = '2026-11-04 08:50-03', hora_inicio = '2026-11-04 08:55-03',
       hora_termino = '2026-11-04 12:00-03', hora_saida = '2026-11-04 12:10-03',
       operador_nome = 'Operador Coifa', responsavel_nome = 'Casiane', responsavel_setor = 'Cozinha',
       assinatura_cliente_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'cliente.png'),
       assinatura_operador_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'operador.png')
 where os_id = (select id from ids where nome = 'os');

do $$
declare v_msg text;
begin
  begin
    perform public.concluir_os((select id from ids where nome = 'os'));
    raise exception 'FALHOU: concluiu a coifa sem liberação, sujidade e conferência';
  exception when check_violation then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%liberação para trabalho%' or v_msg not like '%sujidade de: Coifa do fogão, Coifa do forno%'
       or v_msg not like '%quantidade de produto%' or v_msg not like '%conferência final%' then
      raise exception 'FALHOU: pendências da coifa incompletas: %', v_msg;
    end if;
  end;
end $$;

update public.os_execucao set checklist = '{
  "liberacao": {
    "area_isolada": {"sim": true}, "producao_livre": {"sim": true}, "pintada": {"sim": false},
    "risco_pintura": {"sim": false}, "equipamentos_desligados": {"sim": true, "texto": "Fritadeiras"},
    "motor_desligado": {"sim": true}, "gas_fechado": {"sim": true, "texto": "1"},
    "condicoes": "LE", "escoamento": "eficiente"},
  "telas_retiradas": {"sim": true, "quantidade": 6},
  "produto_ml": 3000,
  "conferencia": {
    "limpeza_eficiente": {"sim": true}, "equipamentos_religados": {"sim": true},
    "ambiente_liberado": {"sim": true}}
}' where os_id = (select id from ids where nome = 'os');
update public.os_pontos set sujidade = 'B', foto_antes = true
 where os_id = (select id from ids where nome = 'os');
select public.concluir_os((select id from ids where nome = 'os'));
reset role;

select pg_temp.conferir('coifa concluída',
  (select count(*) from public.ordens_servico where id = (select id from ids where nome = 'os')
     and status = 'concluida'), 1);

select 'Limpeza de coifa: escopo e conclusão conferidos.' as resultado;

rollback;
