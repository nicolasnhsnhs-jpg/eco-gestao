-- =============================================================================
-- Matriz de permissões: o que CADA perfil enxerga em CADA tabela.
--
-- Monta um cenário com dois clientes (um do Vendedor A, outro do Vendedor B),
-- cada um com endereço, atendimento, proposta, serviço, contrato, lançamentos,
-- comissões e arquivos. Depois "entra" como cada perfil e confere as contagens
-- com a tabela esperada abaixo. Transação desfeita no final (rollback).
--
--                       admin  financeiro  vendedor A  recepção  desativado
--   clientes              2        2           1          2          0
--   endereços             2        2           1          2          0
--   atendimentos          2        2           1          2          0
--   propostas / itens     2        2           1          0          0
--   serviços              2        2           1          0          0
--   serviços sem valor    2        2           1          2          0
--   vencimentos           2        2           1          2          0
--   contratos             2        2           1          0          0
--   lançamentos           6        6           0          0          0
--   comissões             6        6           3          0          0
--   arquivos              6        6           3          2          0
--   auditoria            >0       >0           0          0          0
--   configurações         2        2           0          0          0
--   contas bancárias      1        1           0          0          0
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@teste.local',      '{"nome":"Admin Teste"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'financeiro@teste.local', '{"nome":"Financeiro Teste"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'vend.a@teste.local',     '{"nome":"Vendedor A"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'vend.b@teste.local',     '{"nome":"Vendedor B"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'recepcao@teste.local',   '{"nome":"Recepção Teste"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'desativado@teste.local', '{"nome":"Desativado"}');
update public.perfis set papel = 'admin'      where id = '00000000-0000-0000-0000-0000000000a1';
update public.perfis set papel = 'financeiro' where id = '00000000-0000-0000-0000-0000000000f1';
update public.perfis set papel = 'vendedor'   where id in ('00000000-0000-0000-0000-0000000000b1',
                                                           '00000000-0000-0000-0000-0000000000b2');
update public.perfis set papel = 'recepcao'   where id = '00000000-0000-0000-0000-0000000000c1';
update public.perfis set papel = 'vendedor', ativo = false
                                              where id = '00000000-0000-0000-0000-0000000000d1';
update public.configuracoes set valor = '8' where chave = 'comissao_percentual_padrao';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

-- Os dois clientes do cenário (todas as contagens olham só para eles).
create function pg_temp.do_teste(cliente uuid) returns boolean language sql immutable as $$
  select cliente in ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-00000000c0b1')
$$;

create function pg_temp.conferir(perfil text, o_que text, obtido bigint, esperado bigint)
returns void language plpgsql as $$
begin
  if obtido is distinct from esperado then
    raise exception 'Permissão errada: % deveria ver % %, mas vê %', perfil, esperado, o_que, obtido;
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Cenário (criado como administrador do banco)
-- -----------------------------------------------------------------------------
insert into public.clientes (id, tipo_pessoa, nome, vendedor_responsavel_id) values
  ('00000000-0000-0000-0000-00000000c0a1', 'PJ', 'Cliente do A [matriz]', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000c0b1', 'PJ', 'Cliente do B [matriz]', '00000000-0000-0000-0000-0000000000b2');

insert into public.contas_bancarias (id, nome) values ('00000000-0000-0000-0000-0000000c0a01', 'Conta [matriz]');

do $$
declare
  c uuid;
  v uuid;
  i int := 0;
  v_proposta uuid;
  v_servico uuid;
begin
  foreach c in array array['00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-00000000c0b1']::uuid[] loop
    i := i + 1;
    v := case i when 1 then '00000000-0000-0000-0000-0000000000b1'::uuid else '00000000-0000-0000-0000-0000000000b2'::uuid end;
    -- Atendimentos e arquivos ficam no nome de quem está "logado": o vendedor do cliente.
    perform pg_temp.como(v::text);

    insert into public.enderecos (cliente_id, logradouro, cidade, uf, principal) values (c, 'Rua X', 'Palhoça', 'SC', true);
    insert into public.atendimentos (cliente_id, usuario_id, canal, resumo) values (c, v, 'whatsapp', 'Contato [matriz]');

    insert into public.propostas (cliente_id, vendedor_id) values (c, v) returning id into v_proposta;
    insert into public.proposta_itens (proposta_id, descricao, valor_unitario) values (v_proposta, 'Coifa', 1000);

    insert into public.servicos (cliente_id, tipo_servico_id, vendedor_id, data_execucao, status, valor)
    select c, id, v, privado.hoje() - 30, 'realizado', 1000 from public.tipos_servico where nome = 'Limpeza de coifa'
    returning id into v_servico;

    insert into public.lancamentos (tipo, descricao, cliente_id, categoria_id, competencia, vencimento, valor, servico_id)
    select 'entrada', 'Coifa [matriz]', c, id, privado.hoje(), privado.hoje() + 10, 1000, v_servico
      from public.categorias_financeiras where nome = 'Serviços prestados';

    insert into public.contratos (cliente_id, vendedor_id, descricao, valor_mensal, data_inicio)
    values (c, v, 'Pragas [matriz]', 500, date_trunc('month', privado.hoje())::date);

    -- Arquivos: um geral do cliente, um da proposta, um do serviço.
    insert into public.arquivos (caminho_storage, nome_original, cliente_id, enviado_por) values
      ('clientes/' || c || '/geral.pdf', 'geral.pdf', c, v);
    insert into public.arquivos (caminho_storage, nome_original, cliente_id, proposta_id, enviado_por) values
      ('clientes/' || c || '/proposta.pdf', 'proposta.pdf', c, v_proposta, v);
    insert into public.arquivos (caminho_storage, nome_original, cliente_id, servico_id, enviado_por) values
      ('clientes/' || c || '/certificado.pdf', 'certificado.pdf', c, v_servico, v);
  end loop;

  -- Mensalidades do mês atual e do próximo (2 por contrato).
  perform privado.gerar_cobrancas_contratos(privado.hoje());
  perform privado.gerar_cobrancas_contratos((privado.hoje() + interval '1 month')::date);
end $$;

-- -----------------------------------------------------------------------------
-- Conferência da matriz
-- -----------------------------------------------------------------------------
create function pg_temp.conferir_perfil(
  perfil text,
  e_clientes bigint, e_propostas bigint, e_servicos bigint, e_sem_valor bigint,
  e_vencimentos bigint, e_contratos bigint, e_lancamentos bigint, e_comissoes bigint,
  e_arquivos bigint, ve_auditoria boolean, e_config bigint, e_contas bigint
) returns void language plpgsql as $$
begin
  perform pg_temp.conferir(perfil, 'clientes',
    (select count(*) from public.clientes where pg_temp.do_teste(id)), e_clientes);
  perform pg_temp.conferir(perfil, 'endereços',
    (select count(*) from public.enderecos where pg_temp.do_teste(cliente_id)), e_clientes);
  perform pg_temp.conferir(perfil, 'atendimentos',
    (select count(*) from public.atendimentos where pg_temp.do_teste(cliente_id)), e_clientes);
  perform pg_temp.conferir(perfil, 'propostas',
    (select count(*) from public.propostas where pg_temp.do_teste(cliente_id)), e_propostas);
  perform pg_temp.conferir(perfil, 'itens de proposta',
    (select count(*) from public.proposta_itens i join public.propostas p on p.id = i.proposta_id
      where pg_temp.do_teste(p.cliente_id)), e_propostas);
  perform pg_temp.conferir(perfil, 'serviços',
    (select count(*) from public.servicos where pg_temp.do_teste(cliente_id)), e_servicos);
  perform pg_temp.conferir(perfil, 'serviços sem valor',
    (select count(*) from public.servicos_do_cliente_sem_valor('00000000-0000-0000-0000-00000000c0a1'))
    + (select count(*) from public.servicos_do_cliente_sem_valor('00000000-0000-0000-0000-00000000c0b1')),
    e_sem_valor);
  perform pg_temp.conferir(perfil, 'vencimentos',
    (select count(*) from public.vencimentos_servico where pg_temp.do_teste(cliente_id)), e_vencimentos);
  perform pg_temp.conferir(perfil, 'contratos',
    (select count(*) from public.contratos where pg_temp.do_teste(cliente_id)), e_contratos);
  perform pg_temp.conferir(perfil, 'lançamentos',
    (select count(*) from public.lancamentos where pg_temp.do_teste(cliente_id)), e_lancamentos);
  perform pg_temp.conferir(perfil, 'comissões',
    (select count(*) from public.comissoes where pg_temp.do_teste(cliente_id)), e_comissoes);
  perform pg_temp.conferir(perfil, 'arquivos',
    (select count(*) from public.arquivos where pg_temp.do_teste(cliente_id)), e_arquivos);
  perform pg_temp.conferir(perfil, 'registros de auditoria (algum?)',
    (select (count(*) > 0)::int from public.auditoria where pg_temp.do_teste(cliente_id)), ve_auditoria::int);
  perform pg_temp.conferir(perfil, 'configurações',
    (select count(*) from public.configuracoes), e_config);
  perform pg_temp.conferir(perfil, 'contas bancárias de teste',
    (select count(*) from public.contas_bancarias where nome = 'Conta [matriz]'), e_contas);
end
$$;

--                                       cli prop serv s/valor venc contr lanç comis arq audit conf contas
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select pg_temp.conferir_perfil('Admin',      2,  2,   2,   2,     2,   2,    6,   6,  6,  true,  2,  1);
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;
select pg_temp.conferir_perfil('Financeiro', 2,  2,   2,   2,     2,   2,    6,   6,  6,  true,  2,  1);
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
select pg_temp.conferir_perfil('Vendedor A', 1,  1,   1,   1,     1,   1,    0,   3,  3,  false, 0,  0);
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select pg_temp.conferir_perfil('Recepção',   2,  0,   0,   2,     2,   0,    0,   0,  2,  false, 0,  0);
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000000d1');
set local role authenticated;
select pg_temp.conferir_perfil('Desativado', 0,  0,   0,   0,     0,   0,    0,   0,  0,  false, 0,  0);
reset role;

-- A recepção vê o histórico de serviços, mas a resposta não tem nenhuma coluna de valor.
do $$ begin
  assert not exists (
    select 1 from information_schema.routines r
      join information_schema.parameters p on p.specific_name = r.specific_name
     where r.routine_schema = 'public' and r.routine_name = 'servicos_do_cliente_sem_valor'
       and p.parameter_name ilike '%valor%'
  ), 'A consulta da recepção não pode devolver valores';
end $$;

select 'Matriz de permissões conferida para todos os perfis.' as resultado;

rollback;
