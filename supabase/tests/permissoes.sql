-- =============================================================================
-- Testes das regras de permissão (RLS) e das regras do banco para clientes.
--
-- Como funciona: tudo roda dentro de uma transação que é DESFEITA no final
-- (rollback), então nenhum dado de teste fica no banco. Cria usuários de mentira,
-- "finge" ser cada um deles e confere o que cada perfil consegue ver e fazer.
-- Se alguma regra falhar, o script para com a mensagem do teste que quebrou.
--
-- Rodar:  npm run test:db
-- =============================================================================

begin;

-- Usuários de teste ---------------------------------------------------------
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

-- Função de apoio: "entrar" como um usuário (como o Supabase faz a cada pedido).
create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

-- Os documentos dos clientes de teste podem coincidir com clientes já cadastrados:
-- dentro desta transação (desfeita no final), os documentos existentes são limpos.
alter table public.clientes disable trigger user;
update public.clientes set cpf_cnpj = null where cpf_cnpj is not null;
alter table public.clientes enable trigger user;

-- Clientes de teste (criados como administrador do banco, sem RLS) -------------
insert into public.clientes (id, tipo_pessoa, nome, cpf_cnpj, whatsapp, vendedor_responsavel_id) values
  ('00000000-0000-0000-0000-00000000c0a1', 'PF', 'João da Silva [teste]', '52998224725', '48999990001',
   '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000c0a2', 'PJ', 'Restaurante Teste Ltda [teste]', '11222333000181', null,
   '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000c0b1', 'PF', 'Maria [teste]', null, '48999990002',
   '00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-00000000c0c1', 'PF', 'Sem Vendedor [teste]', null, null, null);

insert into public.enderecos (cliente_id, logradouro, cidade, uf, principal) values
  ('00000000-0000-0000-0000-00000000c0a1', 'Rua A', 'Palhoça', 'SC', true),
  ('00000000-0000-0000-0000-00000000c0b1', 'Rua B', 'Palhoça', 'SC', true);

-- =============================================================================
-- Vendedor A
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;

do $$ begin
  assert (select count(*) from public.clientes where nome like '%[teste]%') = 2,
    'Vendedor A deveria ver só os 2 clientes dele';
  assert not exists (select 1 from public.clientes where id = '00000000-0000-0000-0000-00000000c0b1'),
    'Vendedor A não deveria ver cliente do Vendedor B';
  assert (select count(*) from public.enderecos where logradouro in ('Rua A', 'Rua B')) = 1,
    'Vendedor A deveria ver só o endereço do próprio cliente';
  assert (select count(*) from public.auditoria) = 0,
    'Vendedor não deveria ver a auditoria';
end $$;

do $$ declare n int; begin
  update public.clientes set observacoes = 'invasão'
   where id = '00000000-0000-0000-0000-00000000c0b1';
  get diagnostics n = row_count;
  assert n = 0, 'Vendedor A não deveria alterar cliente do Vendedor B';
end $$;

do $$ begin
  begin
    update public.clientes set vendedor_responsavel_id = '00000000-0000-0000-0000-0000000000b2'
     where id = '00000000-0000-0000-0000-00000000c0a1';
    raise exception 'FALHOU: vendedor conseguiu trocar o vendedor responsável';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$ begin
  begin
    insert into public.clientes (tipo_pessoa, nome, vendedor_responsavel_id)
    values ('PF', 'Cliente para o outro', '00000000-0000-0000-0000-0000000000b2');
    raise exception 'FALHOU: vendedor cadastrou cliente para outro vendedor';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$ begin
  begin
    delete from public.clientes where id = '00000000-0000-0000-0000-00000000c0a1';
    raise exception 'FALHOU: foi possível apagar um cliente';
  exception when insufficient_privilege then null;
  end;
end $$;

-- O atendimento sempre fica no nome de quem está logado, mesmo se tentarem outro.
insert into public.atendimentos (cliente_id, canal, resumo, usuario_id)
values ('00000000-0000-0000-0000-00000000c0a1', 'whatsapp', 'Pediu orçamento',
        '00000000-0000-0000-0000-0000000000b2');

do $$ begin
  assert (select usuario_id from public.atendimentos where resumo = 'Pediu orçamento')
       = '00000000-0000-0000-0000-0000000000b1',
    'Atendimento deveria ficar no nome do usuário logado';
  assert (select count(*) from public.buscar_clientes('maria')) = 0,
    'Busca do vendedor não deveria encontrar cliente de outro vendedor';
end $$;

reset role;

-- =============================================================================
-- Recepção
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;

do $$ begin
  assert (select count(*) from public.clientes where nome like '%[teste]%') = 4,
    'Recepção deveria ver todos os clientes';
  assert (select count(*) from public.auditoria) = 0,
    'Recepção não deveria ver a auditoria';
  assert (select count(*) from public.transferencias_cliente) = 0,
    'Recepção não deveria ver transferências';
end $$;

do $$ begin
  begin
    update public.clientes set vendedor_responsavel_id = '00000000-0000-0000-0000-0000000000b2'
     where id = '00000000-0000-0000-0000-00000000c0a1';
    raise exception 'FALHOU: recepção trocou o vendedor de um cliente que já tinha vendedor';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Mas pode definir o vendedor de quem ainda não tem.
update public.clientes set vendedor_responsavel_id = '00000000-0000-0000-0000-0000000000b2'
 where id = '00000000-0000-0000-0000-00000000c0c1';

do $$ begin
  begin
    perform public.transferir_carteira('00000000-0000-0000-0000-0000000000b1',
                                       '00000000-0000-0000-0000-0000000000b2', null);
    raise exception 'FALHOU: recepção transferiu carteira';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Busca sem acento, por telefone e por documento com pontuação.
do $$ begin
  assert exists (select 1 from public.buscar_clientes('joao da silva')),
    'Busca deveria ignorar acentos';
  assert exists (select 1 from public.buscar_clientes('(48) 99999-0002')),
    'Busca deveria encontrar pelo telefone';
  assert exists (select 1 from public.buscar_clientes('11.222.333/0001-81')),
    'Busca deveria encontrar pelo CNPJ formatado';
  assert exists (select 1 from public.buscar_clientes('restaurnte')),
    'Busca deveria tolerar um erro de digitação';
end $$;

reset role;

-- =============================================================================
-- Financeiro
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;

do $$ declare n int; begin
  assert (select count(*) from public.clientes where nome like '%[teste]%') = 4,
    'Financeiro deveria ver todos os clientes';
  assert exists (select 1 from public.auditoria where tabela = 'clientes'),
    'Financeiro deveria ver a auditoria';

  update public.perfis set papel = 'admin' where id = '00000000-0000-0000-0000-0000000000b1';
  get diagnostics n = row_count;
  assert n = 0, 'Financeiro não deveria alterar perfis de usuários';
end $$;

reset role;

-- =============================================================================
-- Administrador
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;

do $$ declare n int; begin
  n := public.transferir_carteira('00000000-0000-0000-0000-0000000000b1',
                                  '00000000-0000-0000-0000-0000000000b2', 'Saiu da empresa');
  assert n = 2, 'Deveria transferir os 2 clientes do Vendedor A';
  assert (select count(*) from public.transferencias_cliente where motivo = 'Saiu da empresa') = 2,
    'A transferência deveria ficar registrada com o motivo';
  assert exists (
    select 1 from public.auditoria
     where tabela = 'clientes' and acao = 'update'
       and usuario_id = '00000000-0000-0000-0000-0000000000a1'
  ), 'A auditoria deveria registrar quem fez a transferência';
end $$;

do $$ begin
  begin
    update public.perfis set papel = 'vendedor' where id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'FALHOU: admin conseguiu rebaixar o próprio perfil';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$ begin
  begin
    insert into public.clientes (tipo_pessoa, nome, cpf_cnpj) values ('PF', 'CPF errado', '52998224724');
    raise exception 'FALHOU: aceitou CPF inválido';
  exception when check_violation then null;
  end;
  begin
    insert into public.clientes (tipo_pessoa, nome, cpf_cnpj) values ('PF', 'CPF repetido', '52998224725');
    raise exception 'FALHOU: aceitou CPF repetido';
  exception when unique_violation then null;
  end;
end $$;

-- CNPJ alfanumérico (padrão da Receita a partir de 2026) é aceito.
insert into public.clientes (tipo_pessoa, nome, cpf_cnpj) values ('PJ', 'Empresa Nova Teste', '12ABC34501DE35');

-- Anonimização (LGPD)
do $$ begin
  perform public.anonimizar_cliente('00000000-0000-0000-0000-00000000c0b1');
  assert (select nome from public.clientes where id = '00000000-0000-0000-0000-00000000c0b1')
       = 'Cliente anonimizado', 'Cliente deveria ficar anonimizado';
  assert not exists (
    select 1 from public.auditoria
     where cliente_id = '00000000-0000-0000-0000-00000000c0b1'
       and coalesce(dados_antes, dados_depois)::text like '%Maria%'
  ), 'A auditoria não deveria guardar mais os dados pessoais do cliente anonimizado';
end $$;

reset role;

-- =============================================================================
-- Usuário desativado e visitante sem login
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000d1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.clientes) = 0, 'Usuário desativado não deveria ver nada';
  assert (select count(*) from public.perfis) = 0, 'Usuário desativado não deveria ver a equipe';
end $$;
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
do $$ begin
  begin
    perform 1 from public.clientes;
    raise exception 'FALHOU: visitante sem login acessou clientes';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'Todos os testes de permissão passaram.' as resultado;

rollback;
