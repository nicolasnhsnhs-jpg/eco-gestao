-- =============================================================================
-- Ordens de Serviço: permissões do operador e fluxo agendada → concluída.
--
-- Cenário: um cliente com uma unidade, um modelo e duas OS (uma do Operador A,
-- outra do Operador B). Confere que:
--   - o operador vê só as OS dele (nunca rascunho) e não vê clientes nem modelos;
--   - o operador preenche a execução, mas não altera o escopo;
--   - concluir exige os campos obrigatórios, trava a OS e registra o serviço;
--   - só o admin reabre, com motivo;
--   - recepção agenda OS, mas não preenche a execução.
-- Transação desfeita no final (rollback).
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000005a1', 'os.admin@teste.local',    '{"nome":"Admin OS"}'),
  ('00000000-0000-0000-0000-0000000005c1', 'os.recepcao@teste.local', '{"nome":"Recepção OS"}'),
  ('00000000-0000-0000-0000-0000000005e1', 'op.a@teste.local',        '{"nome":"Operador A"}'),
  ('00000000-0000-0000-0000-0000000005e2', 'op.b@teste.local',        '{"nome":"Operador B"}');
update public.perfis set papel = 'admin'    where id = '00000000-0000-0000-0000-0000000005a1';
update public.perfis set papel = 'recepcao' where id = '00000000-0000-0000-0000-0000000005c1';
update public.perfis set papel = 'operador' where id in ('00000000-0000-0000-0000-0000000005e1',
                                                         '00000000-0000-0000-0000-0000000005e2');

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

-- Cenário (como administrador do banco)
insert into public.clientes (id, tipo_pessoa, nome) values
  ('00000000-0000-0000-0000-000000005c01', 'PJ', 'Granja [teste OS]');
insert into public.enderecos (id, cliente_id, apelido, logradouro, cidade, uf, cnpj) values
  ('00000000-0000-0000-0000-000000005e01', '00000000-0000-0000-0000-000000005c01',
   'Depósito 97', 'Rua A', 'Palhoça', 'SC', '11222333000262');
insert into public.contatos_cliente (cliente_id, endereco_id, nome, telefone) values
  ('00000000-0000-0000-0000-000000005c01', '00000000-0000-0000-0000-000000005e01', 'Fulana', '48999990000');
insert into public.veiculos (id, placa, descricao) values
  ('00000000-0000-0000-0000-000000005f01', 'TST9Z99', 'Strada [teste]');

-- -----------------------------------------------------------------------------
-- Recepção cria o modelo e gera as OS
-- -----------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000005c1');
set local role authenticated;

insert into public.os_modelos (id, cliente_id, endereco_id, tipo_servico_id, descricao,
                               operadores_padrao, veiculo_padrao_id)
select '00000000-0000-0000-0000-000000005d01', '00000000-0000-0000-0000-000000005c01',
       '00000000-0000-0000-0000-000000005e01', t.id, 'Desentupimento da pia da cozinha',
       array['00000000-0000-0000-0000-0000000005e1'::uuid], '00000000-0000-0000-0000-000000005f01'
  from public.tipos_servico t where t.nome = 'Desentupimento';

create temp table ids (nome text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('os_a', public.gerar_os_do_modelo('00000000-0000-0000-0000-000000005d01', '2026-11-05')),
  ('os_b', public.gerar_os_do_modelo('00000000-0000-0000-0000-000000005d01', '2026-11-06', null,
                                     array['00000000-0000-0000-0000-0000000005e2'::uuid]));

-- Um rascunho do Operador A (ele não deve ver)
insert into public.ordens_servico (id, cliente_id, tipo_servico_id, data_agendada, status)
select '00000000-0000-0000-0000-000000005a99', '00000000-0000-0000-0000-000000005c01', t.id,
       '2026-11-07', 'rascunho'
  from public.tipos_servico t where t.nome = 'Desentupimento';
insert into public.os_operadores values
  ('00000000-0000-0000-0000-000000005a99', '00000000-0000-0000-0000-0000000005e1');

do $$ begin
  perform pg_temp.conferir('número da OS no formato OS-AAAA-0000',
    (select count(*) from public.ordens_servico s join ids on ids.id = s.id
      where s.numero ~ '^OS-\d{4}-\d{4}$'), 2);
  perform pg_temp.conferir('ficha com o CNPJ da unidade',
    (select count(*) from public.ordens_servico s join ids on ids.id = s.id
      where s.ficha_cliente ->> 'cpf_cnpj' = '11222333000262'
        and jsonb_array_length(s.ficha_cliente -> 'contatos') = 1), 2);
  perform pg_temp.conferir('execução criada junto com a OS',
    (select count(*) from public.os_execucao e join ids on ids.id = e.os_id
      where e.veiculo_id = '00000000-0000-0000-0000-000000005f01'), 2);
end $$;

-- Recepção não preenche a execução (0 linhas alteradas)
update public.os_execucao set resultado = 'recepção tentou' where os_id = (select id from ids where nome = 'os_a');
reset role;
select pg_temp.conferir('recepção alterou a execução',
  (select count(*) from public.os_execucao where resultado = 'recepção tentou'), 0);

-- -----------------------------------------------------------------------------
-- Operador A
-- -----------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000005e1');
set local role authenticated;

do $$ begin
  perform pg_temp.conferir('OS visíveis ao Operador A',
    (select count(*) from public.ordens_servico where cliente_id = '00000000-0000-0000-0000-000000005c01'), 1);
  perform pg_temp.conferir('clientes visíveis ao operador',
    (select count(*) from public.clientes where id = '00000000-0000-0000-0000-000000005c01'), 0);
  perform pg_temp.conferir('modelos visíveis ao operador',
    (select count(*) from public.os_modelos where cliente_id = '00000000-0000-0000-0000-000000005c01'), 0);
  perform pg_temp.conferir('execuções visíveis ao Operador A',
    (select count(*) from public.os_execucao e join ids on ids.id = e.os_id), 1);
end $$;

-- Não altera o escopo (sem permissão de UPDATE nem regra que o deixe)
update public.ordens_servico set observacoes_adm = 'operador mudou' where id = (select id from ids where nome = 'os_a');
-- Não mexe na OS do Operador B
update public.os_execucao set resultado = 'invadiu' where os_id = (select id from ids where nome = 'os_b');

-- Não conclui faltando dados
do $$ begin
  begin
    perform public.concluir_os((select id from ids where nome = 'os_a'));
    raise exception 'FALHOU: concluiu sem os campos obrigatórios';
  exception when check_violation then null;
  end;
end $$;

-- Preenche e conclui
select public.iniciar_os((select id from ids where nome = 'os_a'));
update public.os_execucao
   set data = '2026-11-05', hora_chegada = '2026-11-05 08:00-03', hora_inicio = '2026-11-05 08:10-03',
       hora_termino = '2026-11-05 09:00-03', hora_saida = '2026-11-05 09:05-03',
       resultado = 'Pia desentupida', operador_nome = 'Operador A da Silva',
       responsavel_nome = 'Fulana', responsavel_setor = 'Cozinha'
 where os_id = (select id from ids where nome = 'os_a');
reset role;

-- Assinaturas (o envio pela tela passa pelo Storage; aqui basta o registro)
insert into public.arquivos (id, cliente_id, os_id, caminho_storage, nome_original, categoria, enviado_por)
select gen_random_uuid(), '00000000-0000-0000-0000-000000005c01', ids.id,
       'clientes/00000000-0000-0000-0000-000000005c01/os/' || ids.id || '/' || n || '.png',
       n || '.png', 'assinatura', '00000000-0000-0000-0000-0000000005e1'
  from ids, unnest(array['cliente', 'operador']) n where ids.nome = 'os_a';
update public.os_execucao e
   set assinatura_cliente_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'cliente.png'),
       assinatura_operador_id = (select a.id from public.arquivos a where a.os_id = e.os_id and a.nome_original = 'operador.png')
 where os_id = (select id from ids where nome = 'os_a');

select pg_temp.como('00000000-0000-0000-0000-0000000005e1');
set local role authenticated;
select public.concluir_os((select id from ids where nome = 'os_a'));

-- Depois de concluída, nada muda (0 linhas: a regra só libera OS abertas)
update public.os_execucao set resultado = 'mudou depois' where os_id = (select id from ids where nome = 'os_a');
do $$ begin
  begin
    perform public.reabrir_os((select id from ids where nome = 'os_a'), 'operador quer mudar');
    raise exception 'FALHOU: operador reabriu a OS';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin
  perform pg_temp.conferir('escopo alterado pelo operador',
    (select count(*) from public.ordens_servico where observacoes_adm = 'operador mudou'), 0);
  perform pg_temp.conferir('execução do B alterada pelo A',
    (select count(*) from public.os_execucao where resultado = 'invadiu'), 0);
  perform pg_temp.conferir('execução alterada depois de concluída',
    (select count(*) from public.os_execucao where resultado = 'mudou depois'), 0);
  perform pg_temp.conferir('OS concluída com serviço registrado',
    (select count(*) from public.ordens_servico s join public.servicos v on v.id = s.servico_id
      where s.id = (select id from ids where nome = 'os_a')
        and s.status = 'concluida' and v.status = 'realizado' and v.data_execucao = '2026-11-05'
        and v.tecnicos = 'Operador A'), 1);
end $$;

-- Nem o admin apaga as assinaturas de uma OS concluída
select pg_temp.como('00000000-0000-0000-0000-0000000005a1');
set local role authenticated;
do $$ begin
  begin
    delete from public.arquivos where os_id = (select id from ids where nome = 'os_a');
    raise exception 'FALHOU: apagou assinatura de OS concluída';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- -----------------------------------------------------------------------------
-- Escritório não força o status, e só o admin reabre
-- -----------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000005c1');
set local role authenticated;
do $$ begin
  begin
    update public.ordens_servico set status = 'concluida' where id = (select id from ids where nome = 'os_b');
    raise exception 'FALHOU: recepção concluiu a OS sem passar pela conclusão';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000005a1');
set local role authenticated;
select public.reabrir_os((select id from ids where nome = 'os_a'), 'Faltou anotar o sifão trocado');
reset role;

select pg_temp.conferir('OS reaberta pelo admin com motivo',
  (select count(*) from public.ordens_servico
    where id = (select id from ids where nome = 'os_a') and status = 'em_execucao'
      and motivo_reabertura = 'Faltou anotar o sifão trocado'), 1);

-- -----------------------------------------------------------------------------
-- Conferência e faturamento (OS-2)
-- -----------------------------------------------------------------------------
-- O operador não enxerga a conferência, nem da própria OS
select pg_temp.como('00000000-0000-0000-0000-0000000005e1');
set local role authenticated;
select pg_temp.conferir('conferências visíveis ao operador',
  (select count(*) from public.os_conferencia c join ids on ids.id = c.os_id), 0);
reset role;

-- Conclui de novo a OS reaberta (como admin, que também pode preencher)
select pg_temp.como('00000000-0000-0000-0000-0000000005a1');
set local role authenticated;
select public.concluir_os((select id from ids where nome = 'os_a'));
reset role;

-- Recepção preenche a conferência e confere, mas não fatura
select pg_temp.como('00000000-0000-0000-0000-0000000005c1');
set local role authenticated;
update public.os_conferencia set certificado = true, logistica = 'Ok [teste]'
 where os_id = (select id from ids where nome = 'os_a');
select public.conferir_os((select id from ids where nome = 'os_a'));
do $$ begin
  begin
    perform public.faturar_os((select id from ids where nome = 'os_a'), 350, '2026-11-20');
    raise exception 'FALHOU: recepção faturou a OS';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Admin fatura: nasce a conta a receber ligada à OS e ao serviço
select pg_temp.como('00000000-0000-0000-0000-0000000005a1');
set local role authenticated;
select public.faturar_os((select id from ids where nome = 'os_a'), 350, '2026-11-20', '123');
do $$ begin
  begin
    perform public.faturar_os((select id from ids where nome = 'os_a'), 350, '2026-11-20');
    raise exception 'FALHOU: faturou a mesma OS duas vezes';
  exception when unique_violation then null;
  end;
end $$;
reset role;

do $$ begin
  perform pg_temp.conferir('OS conferida com conferência preenchida',
    (select count(*) from public.ordens_servico s join public.os_conferencia c on c.os_id = s.id
      where s.id = (select id from ids where nome = 'os_a') and s.status = 'conferida'
        and c.certificado and c.logistica = 'Ok [teste]'), 1);
  perform pg_temp.conferir('conta a receber criada e ligada',
    (select count(*) from public.os_conferencia c
       join public.lancamentos l on l.id = c.lancamento_id
       join public.ordens_servico s on s.id = c.os_id
      where c.os_id = (select id from ids where nome = 'os_a')
        and l.tipo = 'entrada' and l.valor = 350 and l.vencimento = '2026-11-20'
        and l.servico_id = s.servico_id and l.numero_nota_fiscal = '123'
        and c.taxa_faturada and c.valor_faturado = 350), 1);
end $$;

select 'Ordens de serviço: permissões e fluxo conferidos.' as resultado;

rollback;
