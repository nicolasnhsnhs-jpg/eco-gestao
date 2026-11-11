-- =============================================================================
-- Testes dos links de cadastro: só o admin cria, vê e cancela; ninguém gera link
-- de Administrador; quem espera aprovação não enxerga nada do sistema.
-- Tudo é desfeito no final (rollback).  Rodar: npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000001a1', 'admin.link@teste.local',    '{"nome":"Admin Link"}'),
  ('00000000-0000-0000-0000-0000000001b1', 'vend.link@teste.local',     '{"nome":"Vendedor Link"}'),
  ('00000000-0000-0000-0000-0000000001c1', 'pendente.link@teste.local', '{"nome":"Pendente Link"}');

update public.perfis set papel = 'admin'    where id = '00000000-0000-0000-0000-0000000001a1';
update public.perfis set papel = 'vendedor' where id = '00000000-0000-0000-0000-0000000001b1';
update public.perfis set papel = 'operador', ativo = false, aguardando_aprovacao = true
                                            where id = '00000000-0000-0000-0000-0000000001c1';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

-- Admin ------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000001a1');
set local role authenticated;

insert into public.links_cadastro (papel, expira_em) values ('operador', now() + interval '7 days');

do $$ begin
  assert (select count(*) from public.links_cadastro where papel = 'operador'
          and criado_por = '00000000-0000-0000-0000-0000000001a1') = 1,
    'Admin deveria criar e ver o link de cadastro';
  assert (select length(codigo) from public.links_cadastro
          where criado_por = '00000000-0000-0000-0000-0000000001a1') = 32,
    'O código do link deveria ter 32 caracteres aleatórios';

  begin
    insert into public.links_cadastro (papel, expira_em) values ('admin', now() + interval '1 day');
    assert false, 'Não deveria existir link de cadastro para Administrador';
  exception when check_violation then null;
  end;

  update public.links_cadastro set revogado = true
   where criado_por = '00000000-0000-0000-0000-0000000001a1';
  assert (select bool_and(revogado) from public.links_cadastro
          where criado_por = '00000000-0000-0000-0000-0000000001a1'),
    'Admin deveria cancelar o link';
end $$;
reset role;

-- Vendedor ---------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000001b1');
set local role authenticated;

do $$ begin
  assert (select count(*) from public.links_cadastro) = 0,
    'Vendedor não deveria ver os links de cadastro';
  begin
    insert into public.links_cadastro (papel, expira_em) values ('operador', now() + interval '1 day');
    assert false, 'Vendedor não deveria criar link de cadastro';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.perfis set aguardando_aprovacao = false
     where id = '00000000-0000-0000-0000-0000000001c1';
    assert false, 'Ninguém aprova pelo navegador: só pela função do servidor';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Quem espera aprovação ---------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000001c1');
set local role authenticated;

do $$ begin
  assert privado.meu_papel() is null,
    'Quem espera aprovação não deveria ter perfil de acesso';
  assert (select count(*) from public.perfis) = 0,
    'Quem espera aprovação não deveria ver a equipe';
  assert (select count(*) from public.clientes) = 0,
    'Quem espera aprovação não deveria ver clientes';
end $$;
reset role;

select 'Todos os testes dos links de cadastro passaram.' as resultado;

rollback;
