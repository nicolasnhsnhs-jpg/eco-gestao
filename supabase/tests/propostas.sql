-- =============================================================================
-- Testes de propostas e arquivos: numeração, total, permissões e avisos.
-- Roda numa transação desfeita no final (rollback): nada fica no banco.
-- Rodar:  npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@teste.local',    '{"nome":"Admin Teste"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'vend.a@teste.local',   '{"nome":"Vendedor A"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'vend.b@teste.local',   '{"nome":"Vendedor B"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'recepcao@teste.local', '{"nome":"Recepção Teste"}');

update public.perfis set papel = 'admin'    where id = '00000000-0000-0000-0000-0000000000a1';
update public.perfis set papel = 'vendedor' where id in ('00000000-0000-0000-0000-0000000000b1',
                                                         '00000000-0000-0000-0000-0000000000b2');
update public.perfis set papel = 'recepcao' where id = '00000000-0000-0000-0000-0000000000c1';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

insert into public.clientes (id, tipo_pessoa, nome, vendedor_responsavel_id) values
  ('00000000-0000-0000-0000-00000000c0a1', 'PF', 'Cliente do A [teste]', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000c0b1', 'PF', 'Cliente do B [teste]', '00000000-0000-0000-0000-0000000000b2');

-- =============================================================================
-- Vendedor A cria proposta para o próprio cliente
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;

insert into public.propostas (id, cliente_id, data_envio, validade, valor_total)
values ('00000000-0000-0000-0000-0000000aa001', '00000000-0000-0000-0000-00000000c0a1',
        privado.hoje() - 10, privado.hoje() - 1, 999999);

insert into public.proposta_itens (proposta_id, tipo_servico_id, descricao, quantidade, valor_unitario)
select '00000000-0000-0000-0000-0000000aa001', id, 'Limpeza de coifa', 2, 450.50
  from public.tipos_servico where nome = 'Limpeza de coifa';
insert into public.proposta_itens (proposta_id, descricao, quantidade, valor_unitario)
values ('00000000-0000-0000-0000-0000000aa001', 'Caixa de gordura', 1, 300);

do $$ declare p record; begin
  select * into p from public.v_propostas where id = '00000000-0000-0000-0000-0000000aa001';
  assert p.numero ~ ('^' || extract(year from privado.hoje() - 10) || '-\d{4}$'),
    'O número deveria ser ANO-0000, veio ' || p.numero;
  assert p.valor_total = 1201.00,
    'O total deveria ser a soma dos itens (2 × 450,50 + 300 = 1201), veio ' || p.valor_total;
  assert p.vendedor_id = '00000000-0000-0000-0000-0000000000b1',
    'O vendedor deveria ser quem cadastrou';
  assert p.situacao = 'expirada', 'Enviada e com validade vencida deveria aparecer como expirada';
end $$;

-- Trocar os itens de uma vez (como a tela faz ao editar).
select public.salvar_itens_proposta('00000000-0000-0000-0000-0000000aa001',
  '[{"descricao": "Limpeza de coifa", "quantidade": 2, "valor_unitario": 450.50},
    {"descricao": "Caixa de gordura", "quantidade": 1, "valor_unitario": 300, "periodicidade_meses": 4}]');
do $$ begin
  assert (select count(*) from public.proposta_itens
           where proposta_id = '00000000-0000-0000-0000-0000000aa001') = 2,
    'Depois de trocar, a proposta deveria ter exatamente os 2 itens novos';
  begin
    perform public.salvar_itens_proposta('00000000-0000-0000-0000-0000000aa001', '[]');
    raise exception 'FALHOU: aceitou proposta sem itens';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- Total não se altera "na mão".
update public.propostas set valor_total = 1 where id = '00000000-0000-0000-0000-0000000aa001';
do $$ begin
  assert (select valor_total from public.propostas where id = '00000000-0000-0000-0000-0000000aa001') = 1201,
    'O total só deveria mudar pelos itens';
end $$;

-- Não cria proposta para cliente de outro vendedor, nem em nome de outro vendedor.
do $$ begin
  begin
    insert into public.propostas (cliente_id) values ('00000000-0000-0000-0000-00000000c0b1');
    raise exception 'FALHOU: vendedor A criou proposta para cliente do B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.propostas (cliente_id, vendedor_id)
    values ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000b2');
    raise exception 'FALHOU: vendedor A criou proposta em nome do B';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Arquivos: geral do cliente e da proposta.
insert into public.arquivos (caminho_storage, nome_original, cliente_id, categoria) values
  ('clientes/00000000-0000-0000-0000-00000000c0a1/geral.pdf', 'geral.pdf',
   '00000000-0000-0000-0000-00000000c0a1', 'contrato');
insert into public.arquivos (caminho_storage, nome_original, cliente_id, proposta_id, categoria) values
  ('clientes/00000000-0000-0000-0000-00000000c0a1/proposta.pdf', 'proposta.pdf',
   '00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000aa001', 'proposta');

do $$ begin
  begin
    insert into public.arquivos (caminho_storage, nome_original, cliente_id)
    values ('clientes/00000000-0000-0000-0000-00000000c0b1/x.pdf', 'x.pdf',
            '00000000-0000-0000-0000-00000000c0b1');
    raise exception 'FALHOU: vendedor A enviou arquivo para cliente do B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.arquivos (caminho_storage, nome_original, cliente_id)
    values ('clientes/00000000-0000-0000-0000-00000000c0b1/y.pdf', 'y.pdf',
            '00000000-0000-0000-0000-00000000c0a1');
    raise exception 'FALHOU: aceitou arquivo guardado na pasta de outro cliente';
  exception when check_violation then null;
  end;
end $$;

-- Aviso de proposta sem resposta (enviada há 10 dias) vai para o vendedor.
do $$ begin
  perform public.atualizar_avisos();
  assert exists (select 1 from public.avisos
                  where proposta_id = '00000000-0000-0000-0000-0000000aa001'
                    and destinatario_id = '00000000-0000-0000-0000-0000000000b1'),
    'O vendedor A deveria receber o aviso de proposta sem resposta';
end $$;

reset role;

-- =============================================================================
-- Vendedor B e recepção não enxergam a proposta do A
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000b2');
set local role authenticated;
do $$ begin
  assert not exists (select 1 from public.propostas where id = '00000000-0000-0000-0000-0000000aa001'),
    'Vendedor B não deveria ver proposta do A';
  assert (select count(*) from public.proposta_itens
           where proposta_id = '00000000-0000-0000-0000-0000000aa001') = 0,
    'Vendedor B não deveria ver itens da proposta do A';
  assert (select count(*) from public.arquivos
           where cliente_id = '00000000-0000-0000-0000-00000000c0a1') = 0,
    'Vendedor B não deveria ver arquivos do cliente do A';
  assert not exists (select 1 from public.avisos where proposta_id = '00000000-0000-0000-0000-0000000aa001'),
    'Vendedor B não deveria ver o aviso do A';
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
do $$ declare n int; begin
  assert (select count(*) from public.propostas) = 0, 'Recepção não deveria ver propostas';
  assert (select count(*) from public.v_propostas) = 0, 'Recepção não deveria ver propostas (view)';
  assert (select count(*) from public.arquivos
           where cliente_id = '00000000-0000-0000-0000-00000000c0a1') = 1,
    'Recepção deveria ver só o documento geral do cliente, não o da proposta';
  delete from public.arquivos where nome_original = 'geral.pdf';
  get diagnostics n = row_count;
  assert n = 0, 'Recepção não deveria apagar arquivo enviado por outra pessoa';
  assert exists (select 1 from public.tipos_servico), 'Recepção deveria ver o catálogo de serviços';
end $$;
do $$ begin
  begin
    update public.tipos_servico set periodicidade_meses_padrao = 1;
    if found then raise exception 'FALHOU: recepção alterou o catálogo'; end if;
  end;
end $$;
reset role;

-- =============================================================================
-- Vendedor A responde a proposta: o aviso se resolve
-- =============================================================================
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
update public.propostas set status = 'aprovada' where id = '00000000-0000-0000-0000-0000000aa001';
do $$ begin
  assert (select data_resposta from public.propostas where id = '00000000-0000-0000-0000-0000000aa001')
       = privado.hoje(), 'Aprovar deveria registrar a data da resposta';
  assert (select resolvido_em from public.avisos where proposta_id = '00000000-0000-0000-0000-0000000aa001')
       is not null, 'Responder a proposta deveria resolver o aviso';
end $$;
do $$ begin
  begin
    delete from public.propostas where id = '00000000-0000-0000-0000-0000000aa001';
    raise exception 'FALHOU: foi possível apagar uma proposta';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Caminho do Storage → cliente
do $$ begin
  assert privado.cliente_do_caminho('clientes/00000000-0000-0000-0000-00000000c0a1/a.pdf')
       = '00000000-0000-0000-0000-00000000c0a1', 'Deveria extrair o cliente do caminho';
  assert privado.cliente_do_caminho('outra-pasta/a.pdf') is null, 'Caminho fora do padrão não tem cliente';
end $$;

select 'Todos os testes de propostas e arquivos passaram.' as resultado;

rollback;
