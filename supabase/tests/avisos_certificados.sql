-- =============================================================================
-- Aviso de certificado de contrato perto de vencer.
--
--  1. Certificado de CONTRATO a 15 dias (ou menos) da validade → aviso para o ADM.
--  2. Certificado AVULSO não avisa (renovar é vender um novo serviço).
--  3. ADM e Administrador veem; vendedor e financeiro não.
--  4. O aviso some quando o próximo certificado é emitido, quando o certificado
--     é cancelado e quando o contrato do cliente acaba.
--  5. Cliente sem contrato ativo não gera aviso.
--
-- Rodar:  npm run test:db   (transação desfeita no final)
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000008a1', 'admin@avcert.local',      '{"nome":"Admin [avcert]"}'),
  ('00000000-0000-0000-0000-0000000008e1', 'adm@avcert.local',        '{"nome":"ADM [avcert]"}'),
  ('00000000-0000-0000-0000-0000000008b1', 'vendedor@avcert.local',   '{"nome":"Vendedor [avcert]"}'),
  ('00000000-0000-0000-0000-0000000008f1', 'financeiro@avcert.local', '{"nome":"Financeiro [avcert]"}');
update public.perfis set papel = 'admin'          where id = '00000000-0000-0000-0000-0000000008a1';
update public.perfis set papel = 'administrativo' where id = '00000000-0000-0000-0000-0000000008e1';
update public.perfis set papel = 'vendedor'       where id = '00000000-0000-0000-0000-0000000008b1';
update public.perfis set papel = 'financeiro'     where id = '00000000-0000-0000-0000-0000000008f1';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

-- Emite um certificado (como dono do banco).
create function pg_temp.certificado(p_id uuid, p_cliente uuid, p_tipo text, p_validade date) returns void
language sql as $$
  insert into public.certificados (id, numero, cliente_id, tipo_servico_id, titulo, servico_descrito,
    data_execucao, tipo_validade, validade_meses, validade)
  select p_id, '', p_cliente, t.id, 'CONTROLE DE INSETOS', 'CONTROLE de INSETOS',
         p_validade - 30, p_tipo, 1, p_validade
    from public.tipos_servico t where t.nome = 'Controle de pragas';
$$;

create function pg_temp.avisos_abertos(cert uuid) returns bigint language sql as $$
  select count(*) from public.avisos where certificado_id = cert and resolvido_em is null;
$$;

-- Cliente com contrato ativo e cliente sem contrato
insert into public.clientes (id, tipo_pessoa, nome, cpf_cnpj) values
  ('00000000-0000-0000-0000-00000000c8a1', 'PJ', 'Hotel [avcert]', '48291736000192'),
  ('00000000-0000-0000-0000-00000000c8a2', 'PJ', 'Padaria [avcert]', '59302847000173');
insert into public.contratos (id, cliente_id, descricao, valor_mensal, data_inicio)
values ('00000000-0000-0000-0000-0000000c8001', '00000000-0000-0000-0000-00000000c8a1',
        'Pragas mensal [avcert]', 900, privado.hoje() - 60);

select pg_temp.certificado('00000000-0000-0000-0000-00000000cf01', '00000000-0000-0000-0000-00000000c8a1',
                           'contrato', privado.hoje() + 10);   -- vence em 10 dias → avisa
select pg_temp.certificado('00000000-0000-0000-0000-00000000cf02', '00000000-0000-0000-0000-00000000c8a2',
                           'contrato', privado.hoje() + 5);    -- sem contrato ativo → não avisa
select pg_temp.certificado('00000000-0000-0000-0000-00000000cf03', '00000000-0000-0000-0000-00000000c8a1',
                           'avulso', privado.hoje() + 5);      -- avulso → não avisa

-- Ainda longe da validade: não avisa
update public.certificados set validade = privado.hoje() + 40
 where id = '00000000-0000-0000-0000-00000000cf01';
select privado.gerar_avisos_certificados();
do $$ begin
  assert pg_temp.avisos_abertos('00000000-0000-0000-0000-00000000cf01') = 0,
    'Certificado a 40 dias da validade não deveria avisar';
end $$;

update public.certificados set validade = privado.hoje() + 10
 where id = '00000000-0000-0000-0000-00000000cf01';

-- =============================================================================
-- 1 e 2. Geração (o ADM pede ao abrir a tela de avisos)
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000008e1');
set local role authenticated;
select public.atualizar_avisos();
do $$ begin
  assert (select count(*) from public.avisos
           where certificado_id = '00000000-0000-0000-0000-00000000cf01'
             and tipo = 'certificado_contrato_vencendo'
             and papel_destino = 'administrativo'
             and link = '/certificados/00000000-0000-0000-0000-00000000cf01') = 1,
    'ADM deveria ver o aviso do certificado de contrato vencendo';
  assert (select count(*) from public.avisos where certificado_id = '00000000-0000-0000-0000-00000000cf03') = 0,
    'Certificado avulso não deveria avisar';
  assert (select count(*) from public.avisos where certificado_id = '00000000-0000-0000-0000-00000000cf02') = 0,
    'Cliente sem contrato ativo não deveria gerar aviso';
end $$;
reset role;

-- Rodar de novo não duplica
select privado.gerar_avisos_certificados();
do $$ begin
  assert (select count(*) from public.avisos where certificado_id = '00000000-0000-0000-0000-00000000cf01') = 1,
    'O aviso não deveria ser duplicado';
end $$;

-- =============================================================================
-- 3. Quem vê
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000008a1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.avisos where certificado_id = '00000000-0000-0000-0000-00000000cf01') = 1,
    'Administrador deveria ver o aviso';
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000008b1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.avisos where certificado_id is not null) = 0,
    'Vendedor não deveria ver avisos de certificado';
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000008f1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.avisos where certificado_id is not null) = 0,
    'Financeiro não deveria ver avisos de certificado';
end $$;
reset role;

-- =============================================================================
-- 4. Resolução automática
-- =============================================================================
-- Próximo certificado emitido → o aviso do anterior sai
select pg_temp.certificado('00000000-0000-0000-0000-00000000cf04', '00000000-0000-0000-0000-00000000c8a1',
                           'contrato', privado.hoje() + 40);
do $$ begin
  assert pg_temp.avisos_abertos('00000000-0000-0000-0000-00000000cf01') = 0,
    'Emitir o certificado seguinte deveria resolver o aviso';
end $$;
select privado.gerar_avisos_certificados();
do $$ begin
  assert pg_temp.avisos_abertos('00000000-0000-0000-0000-00000000cf01') = 0,
    'Certificado já renovado não deveria voltar a avisar';
end $$;

-- Cancelado → o aviso dele sai
update public.certificados set validade = privado.hoje() + 12
 where id = '00000000-0000-0000-0000-00000000cf04';
select privado.gerar_avisos_certificados();
do $$ begin
  assert pg_temp.avisos_abertos('00000000-0000-0000-0000-00000000cf04') = 1,
    'Certificado novo perto de vencer deveria avisar';
end $$;
update public.certificados set cancelado_em = now(), motivo_cancelamento = 'Emitido por engano'
 where id = '00000000-0000-0000-0000-00000000cf04';
do $$ begin
  assert pg_temp.avisos_abertos('00000000-0000-0000-0000-00000000cf04') = 0,
    'Cancelar o certificado deveria resolver o aviso';
end $$;

-- Contrato encerrado → os avisos do cliente saem
select pg_temp.certificado('00000000-0000-0000-0000-00000000cf05', '00000000-0000-0000-0000-00000000c8a1',
                           'contrato', privado.hoje() + 14);
select privado.gerar_avisos_certificados();
do $$ begin
  assert pg_temp.avisos_abertos('00000000-0000-0000-0000-00000000cf05') = 1,
    'O certificado que substituiu o cancelado deveria avisar';
end $$;
update public.contratos set status = 'encerrado' where id = '00000000-0000-0000-0000-0000000c8001';
do $$ begin
  assert (select count(*) from public.avisos a join public.certificados c on c.id = a.certificado_id
           where c.cliente_id = '00000000-0000-0000-0000-00000000c8a1' and a.resolvido_em is null) = 0,
    'Encerrar o contrato deveria resolver os avisos do cliente';
end $$;

select 'Avisos de certificado de contrato conferidos.' as resultado;

rollback;
