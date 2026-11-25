-- =============================================================================
-- OS de análise de água e de limpeza de ar-condicionado: pontos e regras para concluir.
--
-- Confere que:
--   - existem os tipos de serviço com os formulários "agua" e "ar_condicionado";
--   - o ponto de coleta e o aparelho (BTU, marca, nº de série) são cadastrados no
--     modelo e copiados para a OS;
--   - água: concluir exige o procedimento, a coleta (com hora) de cada ponto e a
--     conservação das amostras, e não pede nada de outro formulário;
--   - ar: concluir exige as três limpezas e as duas fotos de cada aparelho e a
--     quantidade de produto;
--   - o técnico adiciona, renomeia e tira pontos de coleta em campo;
--   - o escritório corrige o português da OS concluída (só texto);
--   - a próxima OS traz a data anterior da coleta e da limpeza.
-- Transação desfeita no final (rollback).
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000ab1', 'agua.recepcao@teste.local', '{"nome":"Recepção Água"}'),
  ('00000000-0000-0000-0000-000000000ab2', 'agua.op@teste.local',       '{"nome":"Operador Água"}');
update public.perfis set papel = 'recepcao' where id = '00000000-0000-0000-0000-000000000ab1';
update public.perfis set papel = 'operador' where id = '00000000-0000-0000-0000-000000000ab2';

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

/** Pendências da OS como texto (para conferir com like). */
create function pg_temp.pendencias(p_os uuid) returns text language sql as $$
  select array_to_string(privado.pendencias_os(p_os), ' | ');
$$;

insert into public.clientes (id, tipo_pessoa, nome) values
  ('00000000-0000-0000-0000-00000000ab01', 'PJ', 'Distribuidora [teste água e ar]');

select pg_temp.conferir('tipo de serviço de análise de água existe',
  least((select count(*) from public.tipos_servico where formulario_os = 'agua'), 1), 1);
select pg_temp.conferir('tipo de serviço de ar-condicionado existe',
  least((select count(*) from public.tipos_servico where formulario_os = 'ar_condicionado'), 1), 1);

select pg_temp.como('00000000-0000-0000-0000-000000000ab1');
set local role authenticated;

insert into public.os_modelos (id, cliente_id, tipo_servico_id, descricao, operadores_padrao)
select '00000000-0000-0000-0000-00000000ab10', '00000000-0000-0000-0000-00000000ab01', t.id,
       'Análise de água', array['00000000-0000-0000-0000-000000000ab2'::uuid]
  from public.tipos_servico t where t.formulario_os = 'agua' order by t.nome limit 1;
insert into public.os_modelos (id, cliente_id, tipo_servico_id, descricao, operadores_padrao)
select '00000000-0000-0000-0000-00000000ab20', '00000000-0000-0000-0000-00000000ab01', t.id,
       'Ar-condicionado', array['00000000-0000-0000-0000-000000000ab2'::uuid]
  from public.tipos_servico t where t.formulario_os = 'ar_condicionado' order by t.nome limit 1;

insert into public.pontos_controle (modelo_id, tipo, numero, area) values
  ('00000000-0000-0000-0000-00000000ab10', 'ponto_coleta', 1, 'Reservatório superior'),
  ('00000000-0000-0000-0000-00000000ab10', 'ponto_coleta', 2, 'Torneira da cozinha');
insert into public.pontos_controle (modelo_id, tipo, numero, area, btu, marca, numero_serie) values
  ('00000000-0000-0000-0000-00000000ab20', 'ar_condicionado', 1, 'Sala comercial', 18000, 'Midea', '38TAVCA18M5'),
  ('00000000-0000-0000-0000-00000000ab20', 'ar_condicionado', 2, 'No break', 9000, null, null);

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('agua', public.gerar_os_do_modelo('00000000-0000-0000-0000-00000000ab10', '2026-11-12')),
  ('ar',   public.gerar_os_do_modelo('00000000-0000-0000-0000-00000000ab20', '2026-11-12'));
reset role;

select pg_temp.conferir('pontos de coleta copiados',
  (select count(*) from public.os_pontos
    where os_id = (select id from ids where nome = 'agua') and tipo = 'ponto_coleta'), 2);
select pg_temp.conferir('aparelhos copiados com BTU',
  (select sum(btu) from public.os_pontos
    where os_id = (select id from ids where nome = 'ar') and tipo = 'ar_condicionado'), 27000);

insert into public.arquivos (id, cliente_id, os_id, caminho_storage, nome_original, categoria, enviado_por)
select gen_random_uuid(), '00000000-0000-0000-0000-00000000ab01', ids.id,
       'clientes/00000000-0000-0000-0000-00000000ab01/os/' || ids.id || '/' || f.n,
       f.n, f.cat::public.categoria_arquivo, '00000000-0000-0000-0000-000000000ab2'
  from ids, (values ('cliente.png', 'assinatura'), ('operador.png', 'assinatura'),
                    ('antes.jpg', 'foto_antes'), ('depois.jpg', 'foto_depois')) f(n, cat);

select pg_temp.como('00000000-0000-0000-0000-000000000ab2');
set local role authenticated;
select public.iniciar_os(id) from ids;

update public.os_execucao e
   set data = '2026-11-12', hora_chegada = '2026-11-12 08:50-03', hora_inicio = '2026-11-12 08:55-03',
       hora_termino = '2026-11-12 09:30-03', hora_saida = '2026-11-12 09:40-03',
       operador_nome = 'Operador Água', responsavel_nome = 'Sra. Sabrina', responsavel_setor = 'Qualidade',
       assinatura_cliente_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'cliente.png'),
       assinatura_operador_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'operador.png')
 where os_id in (select id from ids);

-- Água: um ponto coletado sem hora e outro sem resposta.
update public.os_pontos set coletado = true
 where os_id = (select id from ids where nome = 'agua') and numero = 2;

do $$
declare v text := pg_temp.pendencias((select id from ids where nome = 'agua'));
begin
  if v not like '%confirmação do procedimento de coleta%'
     or v not like '%coleta de: Reservatório superior, Torneira da cozinha%'
     or v not like '%conservação das amostras%' then
    raise exception 'FALHOU: pendências da água incompletas: %', v;
  end if;
  if v like '%resultado%' or v like '%foto%' or v like '%produto%' then
    raise exception 'FALHOU: água pediu campo de outro formulário: %', v;
  end if;
end $$;

-- O técnico nomeia os pontos em campo: adiciona, corrige o nome e tira.
do $$
declare
  v_os    uuid := (select id from ids where nome = 'agua');
  v_ponto uuid;
begin
  v_ponto := public.coleta_adicionar_ponto(v_os, '  Banheiro ');
  perform pg_temp.conferir('ponto novo na OS com o nome dado',
    (select count(*) from public.os_pontos
      where os_id = v_os and ponto_id = v_ponto and area = 'Banheiro' and numero = 3), 1);
  perform pg_temp.conferir('ponto novo sem o aviso de ponto novo',
    (select count(*) from public.os_pontos where os_id = v_os and incluido_na_execucao), 0);
  begin
    perform public.coleta_adicionar_ponto(v_os, 'banheiro');
    raise exception 'FALHOU: aceitou dois pontos com o mesmo nome';
  exception when unique_violation then null;
  end;
  begin
    perform public.coleta_adicionar_ponto(v_os, ' ');
    raise exception 'FALHOU: aceitou ponto sem nome';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.coleta_adicionar_ponto((select id from ids where nome = 'ar'), 'Banheiro');
    raise exception 'FALHOU: cadastrou ponto de coleta na OS de ar-condicionado';
  exception when insufficient_privilege then null;
  end;

  perform public.coleta_renomear_ponto(v_os, v_ponto, 'Banheiro social');
  perform pg_temp.conferir('nome corrigido na OS',
    (select count(*) from public.os_pontos where ponto_id = v_ponto and area = 'Banheiro social'), 1);

  -- Tirar o ponto novo (sem coleta em outra OS): some de vez.
  perform public.coleta_remover_ponto(v_os, v_ponto);
  perform pg_temp.conferir('ponto tirado da OS',
    (select count(*) from public.os_pontos where ponto_id = v_ponto), 0);
end $$;
reset role;
select pg_temp.conferir('ponto novo tirado também da O.S salva',
  (select count(*) from public.pontos_controle
    where modelo_id = '00000000-0000-0000-0000-00000000ab10' and area like 'Banheiro%'), 0);
select pg_temp.como('00000000-0000-0000-0000-000000000ab2');
set local role authenticated;

update public.os_pontos set coletado = true, hora_coleta = '09:05'
 where os_id = (select id from ids where nome = 'agua') and numero = 2;
update public.os_pontos set coletado = false
 where os_id = (select id from ids where nome = 'agua') and numero = 1;
update public.os_execucao
   set checklist = '{"procedimento": true, "refrigeradas": {"sim": true}}'
 where os_id = (select id from ids where nome = 'agua');
select public.concluir_os((select id from ids where nome = 'agua'));

-- Português: o técnico não corrige depois de concluída; o escritório corrige só o texto.
do $$ begin
  perform public.os_corrigir_textos((select id from ids where nome = 'agua'),
    '{"observacoes": "x"}'::jsonb);
  raise exception 'FALHOU: técnico corrigiu texto da OS concluída';
exception when insufficient_privilege then null;
end $$;
reset role;
update public.os_execucao set observacoes = 'Bloco deteriorado pela humildade',
       checklist = checklist || '{"instaladas": {"sim": false, "texto": "humido"}}'
 where os_id = (select id from ids where nome = 'agua');
update public.os_pontos set observacao = 'Agua da torneira'
 where os_id = (select id from ids where nome = 'agua') and numero = 2;
select pg_temp.como('00000000-0000-0000-0000-000000000ab1');
set local role authenticated;
do $$
declare
  v_os uuid := (select id from ids where nome = 'agua');
  v_n  integer;
begin
  v_n := public.os_corrigir_textos(v_os,
    '{"observacoes": " Bloco deteriorado pela umidade "}'::jsonb,
    '[{"caminho": ["instaladas", "texto"], "valor": "úmido"}]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'id', (select id from public.os_pontos where os_id = v_os and numero = 2),
      'observacao', 'Água da torneira')));
  perform pg_temp.conferir('textos trocados', v_n, 3);
  perform pg_temp.conferir('observação corrigida',
    (select count(*) from public.os_execucao where os_id = v_os
        and observacoes = 'Bloco deteriorado pela umidade'
        and checklist -> 'instaladas' ->> 'texto' = 'úmido'
        and checklist -> 'refrigeradas' ->> 'sim' = 'true'), 1);
  perform pg_temp.conferir('obs. do ponto corrigida',
    (select count(*) from public.os_pontos where os_id = v_os and observacao = 'Água da torneira'), 1);
  begin
    perform public.os_corrigir_textos(v_os, '{"hora_saida": "10:00"}'::jsonb);
    raise exception 'FALHOU: corrigiu campo que não é texto';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.os_corrigir_textos(v_os, '{}'::jsonb,
      '[{"caminho": ["refrigeradas", "sim"], "valor": "não"}]'::jsonb);
    raise exception 'FALHOU: trocou sim/não do checklist';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
select pg_temp.como('00000000-0000-0000-0000-000000000ab2');
set local role authenticated;

-- Ar: o primeiro aparelho completo; o segundo sem o dreno; sem produto.
update public.os_pontos
   set limpeza_serpentina = 'sim', limpeza_gabinete = 'sim', limpeza_dreno = 'na',
       foto_etiqueta = true, fotos_limpeza = true
 where os_id = (select id from ids where nome = 'ar');
update public.os_pontos set limpeza_dreno = null
 where os_id = (select id from ids where nome = 'ar') and numero = 2;

do $$
declare v text := pg_temp.pendencias((select id from ids where nome = 'ar'));
begin
  if v not like '%ar-condicionado: 02%' or v not like '%quantidade de produto%' then
    raise exception 'FALHOU: pendências do ar incompletas: %', v;
  end if;
  if v like '%ar-condicionado: 01%' or v like '%foto antes%' then
    raise exception 'FALHOU: ar pediu o que já estava feito: %', v;
  end if;
end $$;

update public.os_pontos set limpeza_dreno = 'sim'
 where os_id = (select id from ids where nome = 'ar') and numero = 2;
update public.os_execucao set checklist = '{"produto_ml": 500}'
 where os_id = (select id from ids where nome = 'ar');
select public.concluir_os((select id from ids where nome = 'ar'));
reset role;

select pg_temp.conferir('água e ar concluídas',
  (select count(*) from public.ordens_servico where id in (select id from ids)
     and status = 'concluida'), 2);

-- A próxima visita traz a data anterior (só do ponto coletado e dos aparelhos limpos).
select pg_temp.como('00000000-0000-0000-0000-000000000ab1');
set local role authenticated;
insert into ids values
  ('agua2', public.gerar_os_do_modelo('00000000-0000-0000-0000-00000000ab10', '2027-05-12')),
  ('ar2',   public.gerar_os_do_modelo('00000000-0000-0000-0000-00000000ab20', '2027-05-12'));
reset role;

select pg_temp.conferir('coleta anterior só do ponto coletado',
  (select count(*) from public.os_pontos
    where os_id = (select id from ids where nome = 'agua2') and ultima_limpeza = '2026-11-12'), 1);
select pg_temp.conferir('limpeza anterior dos aparelhos',
  (select count(*) from public.os_pontos
    where os_id = (select id from ids where nome = 'ar2') and ultima_limpeza = '2026-11-12'), 2);

select 'Análise de água e ar-condicionado: escopo e conclusão conferidos.' as resultado;

rollback;
