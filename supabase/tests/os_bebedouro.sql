-- =============================================================================
-- OS de limpeza de bebedouros: bebedouros do local e regras para concluir.
--
-- Confere que:
--   - industrial e garrafão têm numeração própria (os dois começam em 01);
--   - a OS recebe os bebedouros com o código do filtro;
--   - concluir exige preventivo/corretivo, "limpo" de cada bebedouro e a
--     conferência com o cliente;
--   - a visita seguinte traz a data da limpeza anterior de quem foi limpo.
-- Transação desfeita no final (rollback).
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000008c1', 'bebedouro.recepcao@teste.local', '{"nome":"Recepção Bebedouro"}'),
  ('00000000-0000-0000-0000-0000000008e1', 'bebedouro.op@teste.local',       '{"nome":"Operador Bebedouro"}');
update public.perfis set papel = 'recepcao' where id = '00000000-0000-0000-0000-0000000008c1';
update public.perfis set papel = 'operador' where id = '00000000-0000-0000-0000-0000000008e1';

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
  ('00000000-0000-0000-0000-000000008c01', 'PJ', 'Indústria [teste bebedouro]');

select pg_temp.conferir('tipo de serviço de bebedouros existe',
  least((select count(*) from public.tipos_servico where formulario_os = 'bebedouro'), 1), 1);

select pg_temp.como('00000000-0000-0000-0000-0000000008c1');
set local role authenticated;

insert into public.os_modelos (id, cliente_id, tipo_servico_id, descricao, operadores_padrao)
select '00000000-0000-0000-0000-000000008d01', '00000000-0000-0000-0000-000000008c01', t.id,
       'Limpeza dos bebedouros', array['00000000-0000-0000-0000-0000000008e1'::uuid]
  from public.tipos_servico t where t.formulario_os = 'bebedouro'
 order by t.nome limit 1;

insert into public.pontos_controle (modelo_id, tipo, numero, area, codigo_filtro) values
  ('00000000-0000-0000-0000-000000008d01', 'bebedouro', 1, 'Montagem', '1019'),
  ('00000000-0000-0000-0000-000000008d01', 'bebedouro', 2, 'Solda', '1085'),
  ('00000000-0000-0000-0000-000000008d01', 'bebedouro_garrafao', 1, 'Recepção', null);

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('os', public.gerar_os_do_modelo('00000000-0000-0000-0000-000000008d01', '2026-11-04'));
reset role;

select pg_temp.conferir('bebedouros copiados com o filtro',
  (select count(*) from public.os_pontos where os_id = (select id from ids where nome = 'os')
     and tipo in ('bebedouro', 'bebedouro_garrafao') and limpo is null and ultima_limpeza is null), 3);
select pg_temp.conferir('filtro copiado',
  (select count(*) from public.os_pontos where os_id = (select id from ids where nome = 'os')
     and codigo_filtro = '1019'), 1);

insert into public.arquivos (id, cliente_id, os_id, caminho_storage, nome_original, categoria, enviado_por)
select gen_random_uuid(), '00000000-0000-0000-0000-000000008c01', ids.id,
       'clientes/00000000-0000-0000-0000-000000008c01/os/' || ids.id || '/' || n,
       n, c::public.categoria_arquivo, '00000000-0000-0000-0000-0000000008e1'
  from ids, (values ('cliente.png', 'assinatura'), ('operador.png', 'assinatura'),
                    ('antes.jpg', 'foto_antes'), ('depois.jpg', 'foto_depois')) f(n, c);

select pg_temp.como('00000000-0000-0000-0000-0000000008e1');
set local role authenticated;
select public.iniciar_os((select id from ids where nome = 'os'));

do $$ begin
  begin
    update public.os_pontos set codigo_filtro = 'outro' where os_id = (select id from ids where nome = 'os');
    raise exception 'FALHOU: operador mudou o filtro do escopo';
  exception when insufficient_privilege then null;
  end;
end $$;

update public.os_execucao e
   set data = '2026-11-04', hora_chegada = '2026-11-04 08:50-03', hora_inicio = '2026-11-04 08:55-03',
       hora_termino = '2026-11-04 10:00-03', hora_saida = '2026-11-04 10:10-03',
       operador_nome = 'Operador Bebedouro', responsavel_nome = 'Márcio', responsavel_setor = 'Manutenção',
       assinatura_cliente_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'cliente.png'),
       assinatura_operador_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'operador.png')
 where os_id = (select id from ids where nome = 'os');

do $$
declare v_msg text;
begin
  begin
    perform public.concluir_os((select id from ids where nome = 'os'));
    raise exception 'FALHOU: concluiu sem preventivo/corretivo, limpeza e conferência';
  exception when check_violation then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%preventivo ou corretivo%'
       or v_msg not like '%limpeza de: Montagem, Solda, Recepção%'
       or v_msg not like '%conferência com o cliente%' then
      raise exception 'FALHOU: pendências do bebedouro incompletas: %', v_msg;
    end if;
  end;
end $$;

update public.os_execucao set checklist = '{
  "trabalho": "preventivo",
  "conferencia": {"todos_limpos": {"sim": false, "texto": "Recepção fechada"}, "danificados": {"sim": false}}
}' where os_id = (select id from ids where nome = 'os');
update public.os_pontos set limpo = (area <> 'Recepção'), filtro_trocado = (area = 'Montagem')
 where os_id = (select id from ids where nome = 'os');
select public.concluir_os((select id from ids where nome = 'os'));
reset role;

select pg_temp.conferir('bebedouros concluídos',
  (select count(*) from public.ordens_servico where id = (select id from ids where nome = 'os')
     and status = 'concluida'), 1);

-- Próxima visita: quem foi limpo traz a data; a Recepção (não limpa) continua sem.
select pg_temp.como('00000000-0000-0000-0000-0000000008c1');
set local role authenticated;
insert into ids values
  ('os2', public.gerar_os_do_modelo('00000000-0000-0000-0000-000000008d01', '2026-12-04'));
reset role;
select pg_temp.conferir('limpeza anterior na visita seguinte',
  (select count(*) from public.os_pontos where os_id = (select id from ids where nome = 'os2')
     and ultima_limpeza = '2026-11-04'), 2);
select pg_temp.conferir('não limpo fica sem data anterior',
  (select count(*) from public.os_pontos where os_id = (select id from ids where nome = 'os2')
     and area = 'Recepção' and ultima_limpeza is null), 1);

select 'Limpeza de bebedouros: escopo, conclusão e histórico conferidos.' as resultado;

rollback;
