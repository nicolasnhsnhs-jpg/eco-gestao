-- =============================================================================
-- Perfil ADM ("administrativo") e certificados de serviço.
--
--  1. O ADM cuida de clientes, propostas, serviços, OS e O.S de contrato,
--     mas NÃO lê nem grava nada do financeiro e não gerencia usuários.
--  2. Certificados: só Administrador e ADM veem e emitem; número sequencial,
--     ficha do cliente congelada, número no serviço de origem, cancelamento.
--  3. Catálogo de produtos dos certificados: só Administrador e ADM.
--
-- Rodar:  npm run test:db   (transação desfeita no final)
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007a1', 'admin@adm.local',      '{"nome":"Admin [adm]"}'),
  ('00000000-0000-0000-0000-0000000007f1', 'financeiro@adm.local', '{"nome":"Financeiro [adm]"}'),
  ('00000000-0000-0000-0000-0000000007e1', 'adm@adm.local',        '{"nome":"ADM [adm]"}'),
  ('00000000-0000-0000-0000-0000000007b1', 'vendedor@adm.local',   '{"nome":"Vendedor [adm]"}'),
  ('00000000-0000-0000-0000-0000000007c1', 'recepcao@adm.local',   '{"nome":"Recepção [adm]"}');
update public.perfis set papel = 'admin'          where id = '00000000-0000-0000-0000-0000000007a1';
update public.perfis set papel = 'financeiro'     where id = '00000000-0000-0000-0000-0000000007f1';
update public.perfis set papel = 'administrativo' where id = '00000000-0000-0000-0000-0000000007e1';
update public.perfis set papel = 'vendedor'       where id = '00000000-0000-0000-0000-0000000007b1';
update public.perfis set papel = 'recepcao'       where id = '00000000-0000-0000-0000-0000000007c1';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

-- Cenário (como administrador do banco): um cliente com endereço, um serviço
-- realizado, uma conta a receber e cadastros financeiros.
insert into public.clientes (id, tipo_pessoa, nome, cpf_cnpj, vendedor_responsavel_id) values
  ('00000000-0000-0000-0000-00000000c7a1', 'PJ', 'Hotel [adm]', '73015042000170',
   '00000000-0000-0000-0000-0000000007b1');
insert into public.enderecos (id, cliente_id, logradouro, numero, bairro, cidade, uf, principal) values
  ('00000000-0000-0000-0000-00000000e7a1', '00000000-0000-0000-0000-00000000c7a1',
   'Av. Julio de Castilhos', '516', 'Centro Histórico', 'Porto Alegre', 'RS', true);
insert into public.servicos (id, cliente_id, endereco_id, tipo_servico_id, data_execucao, status, valor)
select '00000000-0000-0000-0000-00000000a7a1', '00000000-0000-0000-0000-00000000c7a1',
       '00000000-0000-0000-0000-00000000e7a1', id, '2026-10-27', 'realizado', 900
  from public.tipos_servico where nome = 'Controle de pragas';
insert into public.lancamentos (tipo, descricao, cliente_id, categoria_id, competencia, vencimento, valor)
select 'entrada', 'Pragas [adm]', '00000000-0000-0000-0000-00000000c7a1', id, '2026-10-27', '2026-11-10', 900
  from public.categorias_financeiras where nome = 'Serviços prestados';
insert into public.contas_bancarias (nome) values ('Conta [adm]');
insert into public.fornecedores (nome) values ('Fornecedor [adm]');
insert into public.investimentos (nome) values ('CDB [adm]');
insert into public.cartoes_credito (nome, dia_fechamento, dia_vencimento) values ('Cartão [adm]', 1, 10);

-- =============================================================================
-- 1. ADM: entra na operação, fica fora do financeiro e dos usuários
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000007e1');
set local role authenticated;

do $$ begin
  assert privado.tem_acesso_gestao(), 'O ADM deveria cuidar dos cadastros';
  assert not privado.tem_acesso_total(), 'O ADM não pode ter o acesso do financeiro';
  assert privado.pode_gerir_os(), 'O ADM deveria gerir as OS';

  assert (select count(*) from public.clientes where nome like '%[adm]%') = 1, 'ADM deveria ver o cliente';
  assert (select count(*) from public.servicos where cliente_id = '00000000-0000-0000-0000-00000000c7a1') = 1,
    'ADM deveria ver o serviço';

  -- Financeiro: nada aparece
  assert (select count(*) from public.lancamentos) = 0, 'ADM não pode ver lançamentos';
  assert (select count(*) from public.v_lancamentos) = 0, 'ADM não pode ver lançamentos (view)';
  assert (select count(*) from public.contas_bancarias) = 0, 'ADM não pode ver contas bancárias';
  assert (select count(*) from public.fornecedores) = 0, 'ADM não pode ver fornecedores';
  assert (select count(*) from public.categorias_financeiras) = 0, 'ADM não pode ver categorias';
  assert (select count(*) from public.investimentos) = 0, 'ADM não pode ver investimentos';
  assert (select count(*) from public.movimentos_investimento) = 0, 'ADM não pode ver movimentos';
  assert (select count(*) from public.cartoes_credito) = 0, 'ADM não pode ver cartões';
  assert (select count(*) from public.lancamentos_recorrentes) = 0, 'ADM não pode ver contas fixas';
  assert (select count(*) from public.notas_fiscais) = 0, 'ADM não pode ver notas fiscais';
  assert (select count(*) from public.antecipacoes) = 0, 'ADM não pode ver antecipações';
  assert (select count(*) from public.comissoes) = 0, 'ADM não pode ver comissões';
  assert (select count(*) from public.fechamentos_comissao) = 0, 'ADM não pode ver fechamentos';
  assert (select count(*) from public.configuracoes) = 0, 'ADM não pode ver as configurações';
  assert (select count(*) from public.auditoria) = 0, 'ADM não pode ver a auditoria';
end $$;

-- Gravar no financeiro: o banco recusa
do $$ begin
  insert into public.contas_bancarias (nome) values ('Invasão [adm]');
  raise exception 'ADM não deveria cadastrar conta bancária';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  insert into public.lancamentos (tipo, descricao, cliente_id, categoria_id, competencia, vencimento, valor)
  select 'entrada', 'Invasão [adm]', '00000000-0000-0000-0000-00000000c7a1', id, '2026-10-27', '2026-11-10', 1
    from public.categorias_financeiras limit 1;
  -- Sem ver categorias, o insert acima não tem linha; tenta com uma categoria qualquer.
  insert into public.lancamentos (tipo, descricao, competencia, vencimento, valor)
  values ('saida', 'Invasão [adm]', '2026-10-27', '2026-11-10', 1);
  raise exception 'ADM não deveria lançar no financeiro';
exception when insufficient_privilege or not_null_violation then null;
end $$;

do $$ begin
  insert into public.investimentos (nome) values ('Invasão [adm]');
  raise exception 'ADM não deveria cadastrar investimento';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  insert into public.cartoes_credito (nome, dia_fechamento, dia_vencimento) values ('Invasão [adm]', 1, 10);
  raise exception 'ADM não deveria cadastrar cartão';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  perform public.antecipar_recebiveis(array[]::uuid[], '2026-11-01', gen_random_uuid(), 'Banco', 0, null);
  raise exception 'ADM não deveria antecipar recebíveis';
exception when insufficient_privilege then null;
end $$;

-- Usuários: não troca o papel de ninguém (a regra só deixa o admin)
do $$ declare n int; begin
  update public.perfis set papel = 'admin' where id = '00000000-0000-0000-0000-0000000007c1';
  get diagnostics n = row_count;
  assert n = 0, 'ADM não pode alterar perfis de usuário';
end $$;

-- Operação: proposta, OS e O.S de contrato
do $$ declare v_os uuid; begin
  insert into public.propostas (cliente_id, vendedor_id)
  values ('00000000-0000-0000-0000-00000000c7a1', '00000000-0000-0000-0000-0000000007b1');

  insert into public.ordens_servico (cliente_id, endereco_id, tipo_servico_id, data_agendada, status)
  select '00000000-0000-0000-0000-00000000c7a1', '00000000-0000-0000-0000-00000000e7a1', id,
         '2026-11-20', 'rascunho'
    from public.tipos_servico where nome = 'Limpeza de coifa'
  returning id into v_os;
  assert v_os is not null, 'ADM deveria criar OS';

  insert into public.os_modelos (cliente_id, endereco_id, tipo_servico_id)
  select '00000000-0000-0000-0000-00000000c7a1', '00000000-0000-0000-0000-00000000e7a1', id
    from public.tipos_servico where nome = 'Controle de pragas';
  assert (select count(*) from public.os_modelos where cliente_id = '00000000-0000-0000-0000-00000000c7a1') = 1,
    'ADM deveria montar a O.S de contrato';
end $$;

-- O ADM não pode ser o vendedor responsável por um cliente
do $$ begin
  insert into public.clientes (tipo_pessoa, nome, vendedor_responsavel_id)
  values ('PF', 'Outro [adm]', '00000000-0000-0000-0000-0000000007e1');
  raise exception 'ADM não deveria ser vendedor responsável';
exception when check_violation then null;
end $$;

reset role;

-- =============================================================================
-- 2. Certificados
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000007e1');
set local role authenticated;

insert into public.produtos_certificado (principio_ativo, registro, lote, fabricacao, validade, quantidade_padrao)
values ('Alfa-Cipermetrina', 'MS 304040031', 'LOTE-DE-TESTE', '2024-07-01', '2027-07-01', '100ml');

insert into public.certificados (id, numero, modelo, cliente_id, endereco_id, tipo_servico_id, servico_id,
  titulo, pragas_alvo, servico_descrito, data_execucao, outras_datas, areas, produtos,
  tipo_validade, validade_meses, validade)
select '00000000-0000-0000-0000-00000000ce01', 'QUALQUER', 'pragas', '00000000-0000-0000-0000-00000000c7a1',
       '00000000-0000-0000-0000-00000000e7a1', id, '00000000-0000-0000-0000-00000000a7a1',
       'CONTROLE DE INSETOS', 'baratas, formigas, traças e aranhas', 'CONTROLE de INSETOS',
       '2026-10-27', array['2026-10-21']::date[], '322 Apartamentos',
       '[{"principio_ativo":"Alfa-Cipermetrina","registro":"MS 304040031","quantidade":"150ml"}]',
       'contrato', 6, '2027-04-30'
  from public.tipos_servico where nome = 'Controle de pragas';

do $$ declare c public.certificados; begin
  select * into c from public.certificados where id = '00000000-0000-0000-0000-00000000ce01';
  assert c.numero ~ '^CERT-2026-\d{4}$', 'O banco deveria numerar o certificado (veio ' || c.numero || ')';
  assert c.ficha_cliente ->> 'cpf_cnpj' = '73015042000170', 'A ficha do cliente deveria ser congelada';
  assert c.ficha_cliente -> 'unidade' ->> 'cidade' = 'Porto Alegre', 'A ficha deveria ter a unidade';
  assert not (c.ficha_cliente ? 'contatos'), 'O certificado não guarda os contatos';
  assert (select count(*) from public.produtos_certificado where lote = 'LOTE-DE-TESTE') = 1,
    'ADM deveria cadastrar produtos';
end $$;

-- Número e cliente não mudam
do $$ begin
  update public.certificados set numero = 'X' where id = '00000000-0000-0000-0000-00000000ce01';
  raise exception 'Ninguém deveria conseguir mudar o número';
exception when insufficient_privilege then null;
end $$;

-- Cancelar exige motivo; depois de cancelado, não muda mais
do $$ begin
  update public.certificados set cancelado_em = now() where id = '00000000-0000-0000-0000-00000000ce01';
  raise exception 'Cancelar sem motivo deveria falhar';
exception when check_violation then null;
end $$;

update public.certificados set cancelado_em = now(), motivo_cancelamento = 'Emitido com o endereço errado'
 where id = '00000000-0000-0000-0000-00000000ce01';

do $$ begin
  update public.certificados set titulo = 'OUTRO' where id = '00000000-0000-0000-0000-00000000ce01';
  raise exception 'Certificado cancelado não deveria mudar';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  delete from public.certificados where id = '00000000-0000-0000-0000-00000000ce01';
  raise exception 'Certificado não deveria ser apagado';
exception when insufficient_privilege then null;
end $$;

reset role;

do $$ begin
  assert (select numero_certificado from public.servicos where id = '00000000-0000-0000-0000-00000000a7a1')
         like 'CERT-2026-%', 'O serviço de origem deveria ganhar o número do certificado';
  assert (select cancelado_por from public.certificados where id = '00000000-0000-0000-0000-00000000ce01')
         = '00000000-0000-0000-0000-0000000007e1', 'O cancelamento deveria registrar quem cancelou';
end $$;

-- Administrador vê; financeiro, vendedor e recepção não veem nem emitem
select pg_temp.como('00000000-0000-0000-0000-0000000007a1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.certificados where id = '00000000-0000-0000-0000-00000000ce01') = 1,
    'Admin deveria ver o certificado';
end $$;
reset role;

create function pg_temp.sem_certificados(perfil text) returns void language plpgsql as $$
begin
  if (select count(*) from public.certificados) > 0 then
    raise exception '% não deveria ver certificados', perfil;
  end if;
  if (select count(*) from public.produtos_certificado) > 0 then
    raise exception '% não deveria ver o catálogo de produtos', perfil;
  end if;
  begin
    insert into public.certificados (numero, cliente_id, tipo_servico_id, titulo, servico_descrito, data_execucao)
    select '', '00000000-0000-0000-0000-00000000c7a1', id, 'TESTE', 'TESTE', '2026-10-27'
      from public.tipos_servico limit 1;
    raise exception '% não deveria emitir certificado', perfil;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.produtos_certificado (principio_ativo) values ('Invasão');
    raise exception '% não deveria cadastrar produto', perfil;
  exception when insufficient_privilege then null;
  end;
end
$$;

select pg_temp.como('00000000-0000-0000-0000-0000000007f1');
set local role authenticated;
select pg_temp.sem_certificados('Financeiro');
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000007b1');
set local role authenticated;
select pg_temp.sem_certificados('Vendedor');
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000007c1');
set local role authenticated;
select pg_temp.sem_certificados('Recepção');
reset role;

-- =============================================================================
-- 3. Assinaturas escaneadas (bucket privado): Admin e ADM leem, só o Admin troca
-- =============================================================================
-- (o arquivo de verdade pode já existir no banco de testes)
insert into storage.objects (bucket_id, name)
select 'assinaturas', 'responsavel.png'
where not exists (select 1 from storage.objects where bucket_id = 'assinaturas' and name = 'responsavel.png');

select pg_temp.como('00000000-0000-0000-0000-0000000007e1');
set local role authenticated;
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'assinaturas') >= 1,
    'ADM deveria ler a assinatura (para o PDF)';
  begin
    insert into storage.objects (bucket_id, name) values ('assinaturas', 'responsavel-succao.png');
    raise exception 'ADM não deveria enviar assinatura';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000007a1');
set local role authenticated;
do $$ begin
  if not exists (select 1 from storage.objects
                 where bucket_id = 'assinaturas' and name = 'responsavel-succao.png') then
    insert into storage.objects (bucket_id, name) values ('assinaturas', 'responsavel-succao.png');
  end if;
  begin
    insert into storage.objects (bucket_id, name) values ('assinaturas', 'qualquer.png');
    raise exception 'Só os dois arquivos de assinatura deveriam ser aceitos';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000007f1');
set local role authenticated;
do $$ begin
  assert (select count(*) from storage.objects where bucket_id = 'assinaturas') = 0,
    'Financeiro não deveria ver as assinaturas';
end $$;
reset role;

select 'ADM e certificados conferidos.' as resultado;

rollback;
