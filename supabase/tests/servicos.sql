-- =============================================================================
-- Testes de serviços e vencimentos: cálculo do "quando volta", avisos,
-- faturamento e permissões. Transação desfeita no final (rollback).
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'financeiro@teste.local', '{"nome":"Financeiro Teste"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'vend.a@teste.local',     '{"nome":"Vendedor A"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'vend.b@teste.local',     '{"nome":"Vendedor B"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'recepcao@teste.local',   '{"nome":"Recepção Teste"}');

update public.perfis set papel = 'financeiro' where id = '00000000-0000-0000-0000-0000000000f1';
update public.perfis set papel = 'vendedor'   where id in ('00000000-0000-0000-0000-0000000000b1',
                                                           '00000000-0000-0000-0000-0000000000b2');
update public.perfis set papel = 'recepcao'   where id = '00000000-0000-0000-0000-0000000000c1';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.tipo(nome_tipo text) returns uuid language sql as $$
  select id from public.tipos_servico where nome = nome_tipo
$$;

insert into public.clientes (id, tipo_pessoa, nome, vendedor_responsavel_id) values
  ('00000000-0000-0000-0000-00000000c0a1', 'PJ', 'Restaurante do A [teste]', '00000000-0000-0000-0000-0000000000b1');
insert into public.enderecos (id, cliente_id, apelido, logradouro, cidade, uf) values
  ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-00000000c0a1', 'Matriz', 'Rua A', 'Palhoça', 'SC'),
  ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-00000000c0a1', 'Filial', 'Rua B', 'Palhoça', 'SC');

-- =============================================================================
-- Vendedor A registra a limpeza de coifa feita há 170 dias na Matriz
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;

insert into public.servicos (id, cliente_id, endereco_id, tipo_servico_id, data_execucao, status, valor)
values ('00000000-0000-0000-0000-00000005e001', '00000000-0000-0000-0000-00000000c0a1',
        '00000000-0000-0000-0000-0000000e0001', pg_temp.tipo('Limpeza de coifa'),
        privado.hoje() - 170, 'realizado', 800);

do $$ declare v record; begin
  select * into v from public.v_vencimentos
   where cliente_id = '00000000-0000-0000-0000-00000000c0a1'
     and endereco_id = '00000000-0000-0000-0000-0000000e0001';
  assert v.periodicidade_meses = 6, 'Coifa deveria usar a periodicidade padrão de 6 meses';
  assert v.proxima_data = (privado.hoje() - 170 + interval '6 months')::date,
    'Próxima data deveria ser a data do serviço + 6 meses';
  assert v.situacao = 'vencendo', 'Faltando menos de 30 dias deveria estar "vencendo", veio ' || v.situacao;
  assert (select vendedor_id from public.servicos where id = '00000000-0000-0000-0000-00000005e001')
       = '00000000-0000-0000-0000-0000000000b1',
    'Sem vendedor informado, deveria usar o vendedor responsável pelo cliente';
end $$;

-- Desentupimento não se repete: não cria vencimento. Outro endereço: vencimento separado.
insert into public.servicos (cliente_id, endereco_id, tipo_servico_id, data_execucao, status)
values ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000e0001',
        pg_temp.tipo('Desentupimento'), privado.hoje(), 'realizado'),
       ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000e0002',
        pg_temp.tipo('Limpeza de coifa'), privado.hoje() - 10, 'realizado');

do $$ begin
  assert (select count(*) from public.vencimentos_servico
           where cliente_id = '00000000-0000-0000-0000-00000000c0a1') = 2,
    'Deveria haver 2 vencimentos de coifa (Matriz e Filial) e nenhum de desentupimento';
end $$;

-- Aviso de vencimento para o vendedor.
do $$ begin
  perform public.atualizar_avisos();
  assert exists (select 1 from public.avisos
                  where tipo = 'servico_vencendo'
                    and destinatario_id = '00000000-0000-0000-0000-0000000000b1'),
    'O vendedor deveria receber o aviso de coifa vencendo';
  assert (select titulo from public.avisos where tipo = 'servico_vencendo' limit 1)
       = 'Certificado vencendo: Limpeza de coifa', 'Coifa tem certificado: o título deveria dizer isso';
  assert not exists (select 1 from public.avisos where tipo = 'servico_a_faturar'),
    'Vendedor não deveria ver o aviso de faturamento (é do financeiro)';
end $$;

-- Agendar o próximo serviço resolve o aviso.
insert into public.servicos (id, cliente_id, endereco_id, tipo_servico_id, data_execucao, status)
values ('00000000-0000-0000-0000-00000005e002', '00000000-0000-0000-0000-00000000c0a1',
        '00000000-0000-0000-0000-0000000e0001', pg_temp.tipo('Limpeza de coifa'),
        privado.hoje() + 5, 'agendado');
do $$ begin
  assert (select resolvido_em from public.avisos where tipo = 'servico_vencendo') is not null,
    'Agendar o próximo serviço deveria resolver o aviso de vencimento';
end $$;

-- Realizado com periodicidade combinada de 4 meses: o vencimento passa a usar 4.
update public.servicos set status = 'realizado', data_execucao = privado.hoje(), periodicidade_meses = 4
 where id = '00000000-0000-0000-0000-00000005e002';
do $$ declare v record; begin
  select * into v from public.v_vencimentos where endereco_id = '00000000-0000-0000-0000-0000000e0001';
  assert v.data_ultimo_servico = privado.hoje() and v.periodicidade_meses = 4
     and v.situacao = 'em_dia',
    'Depois do novo serviço, o vencimento deveria ser hoje + 4 meses e estar em dia';
end $$;

-- Cancelar o último: volta a valer o anterior.
update public.servicos set status = 'cancelado' where id = '00000000-0000-0000-0000-00000005e002';
do $$ begin
  assert (select data_ultimo_servico from public.vencimentos_servico
           where endereco_id = '00000000-0000-0000-0000-0000000e0001') = privado.hoje() - 170,
    'Cancelado o último serviço, deveria voltar a valer o anterior';
end $$;

-- O vendedor ajusta a periodicidade, mas não a data do último serviço.
update public.vencimentos_servico set periodicidade_meses = 3
 where endereco_id = '00000000-0000-0000-0000-0000000e0002';
do $$ begin
  begin
    update public.vencimentos_servico set data_ultimo_servico = privado.hoje()
     where endereco_id = '00000000-0000-0000-0000-0000000e0002';
    raise exception 'FALHOU: vendedor alterou a data do último serviço';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.servicos where id = '00000000-0000-0000-0000-00000005e001';
    raise exception 'FALHOU: foi possível apagar um serviço';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- =============================================================================
-- Vendedor B e recepção não enxergam
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000b2');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.servicos where cliente_id = '00000000-0000-0000-0000-00000000c0a1') = 0,
    'Vendedor B não deveria ver serviços do cliente do A';
  assert (select count(*) from public.v_vencimentos where cliente_id = '00000000-0000-0000-0000-00000000c0a1') = 0,
    'Vendedor B não deveria ver vencimentos do cliente do A';
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.servicos) = 0, 'Recepção ainda não deveria ver serviços (têm valor)';
  -- Desde a Fase 6 a recepção vê os vencimentos (só datas, sem valores).
  assert (select count(*) from public.vencimentos_servico
           where cliente_id = '00000000-0000-0000-0000-00000000c0a1') = 2,
    'Recepção deveria ver os vencimentos (datas) do cliente';
end $$;
reset role;

-- =============================================================================
-- Financeiro: aviso de faturar e conta a receber ligada ao serviço
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;
do $$ begin
  perform public.atualizar_avisos();
  assert exists (select 1 from public.avisos
                  where tipo = 'servico_a_faturar' and servico_id = '00000000-0000-0000-0000-00000005e001'),
    'O financeiro deveria ser avisado do serviço concluído sem conta a receber';
end $$;

insert into public.lancamentos (tipo, descricao, cliente_id, categoria_id, competencia, vencimento, valor, servico_id)
select 'entrada', 'Limpeza de coifa', '00000000-0000-0000-0000-00000000c0a1', id,
       privado.hoje(), privado.hoje() + 15, 800, '00000000-0000-0000-0000-00000005e001'
  from public.categorias_financeiras where nome = 'Serviços prestados';

do $$ begin
  assert (select resolvido_em from public.avisos
           where tipo = 'servico_a_faturar' and servico_id = '00000000-0000-0000-0000-00000005e001') is not null,
    'Lançar a conta a receber do serviço deveria resolver o aviso';
end $$;
reset role;

select 'Todos os testes de serviços e vencimentos passaram.' as resultado;

rollback;
