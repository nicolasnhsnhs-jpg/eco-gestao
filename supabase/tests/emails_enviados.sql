-- =============================================================================
-- Testes dos e-mails enviados: admin e financeiro veem tudo; o ADM vê os do
-- administrativo; o vendedor só os das propostas dele; ninguém grava pela tela.
-- Tudo é desfeito no final (rollback).  Rodar: npm run test:db
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000e0a01', 'admin.mail@teste.local', '{"nome":"Admin Mail"}'),
  ('00000000-0000-0000-0000-0000000e0f01', 'fin.mail@teste.local',   '{"nome":"Fin Mail"}'),
  ('00000000-0000-0000-0000-0000000e0d01', 'adm.mail@teste.local',   '{"nome":"ADM Mail"}'),
  ('00000000-0000-0000-0000-0000000e0b01', 'vend1.mail@teste.local', '{"nome":"Vendedor 1"}'),
  ('00000000-0000-0000-0000-0000000e0b02', 'vend2.mail@teste.local', '{"nome":"Vendedor 2"}'),
  ('00000000-0000-0000-0000-0000000e0c01', 'rec.mail@teste.local',   '{"nome":"Recepção"}');

update public.perfis set papel = 'admin'          where id = '00000000-0000-0000-0000-0000000e0a01';
update public.perfis set papel = 'financeiro'     where id = '00000000-0000-0000-0000-0000000e0f01';
update public.perfis set papel = 'administrativo' where id = '00000000-0000-0000-0000-0000000e0d01';
update public.perfis set papel = 'vendedor'       where id in ('00000000-0000-0000-0000-0000000e0b01',
                                                               '00000000-0000-0000-0000-0000000e0b02');
update public.perfis set papel = 'recepcao'       where id = '00000000-0000-0000-0000-0000000e0c01';

insert into public.emails_enviados (setor, tipo, cliente_nome, para, assunto, descricao, valor, enviado_por) values
  ('financeiro',     'nota',        'Padaria São João', 'a@x.com', 'NF', 'NF 101 + boleto', 350, '00000000-0000-0000-0000-0000000e0f01'),
  ('administrativo', 'certificado', 'Padaria São João', 'a@x.com', 'Cert', 'Certificado 9', null, '00000000-0000-0000-0000-0000000e0d01'),
  ('comercial',      'proposta',    'Mercado Teste',    'b@x.com', 'Prop', 'Proposta 1', 900, '00000000-0000-0000-0000-0000000e0b01');

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

do $$ begin
  assert (select busca from public.emails_enviados where descricao = 'NF 101 + boleto')
         like '%padaria sao joao%', 'A busca deveria ficar sem acento e em minúsculas';
end $$;

select pg_temp.como('00000000-0000-0000-0000-0000000e0a01');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.emails_enviados where cliente_nome in ('Padaria São João', 'Mercado Teste')) = 3,
    'Admin deveria ver todos os e-mails';
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000e0f01');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.emails_enviados where cliente_nome in ('Padaria São João', 'Mercado Teste')) = 3,
    'Financeiro deveria ver todos os e-mails';
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000e0d01');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.emails_enviados where cliente_nome in ('Padaria São João', 'Mercado Teste')) = 1,
    'ADM deveria ver só os do administrativo';
  begin
    insert into public.emails_enviados (setor, tipo, para, assunto) values ('administrativo', 'os', 'x@x.com', 'x');
    assert false, 'Ninguém deveria gravar e-mail enviado pela tela';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000e0b01');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.emails_enviados where cliente_nome in ('Padaria São João', 'Mercado Teste')) = 1,
    'Vendedor deveria ver só a proposta que ele mandou';
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000e0b02');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.emails_enviados where cliente_nome in ('Padaria São João', 'Mercado Teste')) = 0,
    'Outro vendedor não deveria ver a proposta do colega';
end $$;
reset role;

select pg_temp.como('00000000-0000-0000-0000-0000000e0c01');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.emails_enviados where cliente_nome in ('Padaria São João', 'Mercado Teste')) = 0,
    'Recepção não deveria ver e-mails enviados';
end $$;
reset role;

rollback;
