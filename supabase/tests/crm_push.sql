-- =============================================================================
-- Notificações push do CRM.
--
--  1. Quem recebe = quem vê a conversa: a regra do servidor (usuario_ve_conversa) é
--     igual à da tela (pode_ver_conversa) para todos os perfis e situações.
--  2. Preferências: desligado não recebe; "só as minhas" só quando é o responsável;
--     sem prévia vai com mostrar_previa = false.
--  3. O número do ícone soma as não lidas das conversas que a pessoa vê.
--  4. O aparelho fica com quem entrou por último; cada um só vê os próprios aparelhos.
--  5. Operador e quem não atende WhatsApp não registram aparelho.
--
-- Rodar:  npm run test:db   (transação desfeita no final)
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000aa01', 'admin@push.local',     '{"nome":"Admin [push]"}'),
  ('00000000-0000-0000-0000-00000000ae01', 'adm@push.local',       '{"nome":"ADM [push]"}'),
  ('00000000-0000-0000-0000-00000000af01', 'fin@push.local',       '{"nome":"Financeiro [push]"}'),
  ('00000000-0000-0000-0000-00000000ab01', 'vend@push.local',      '{"nome":"Vendedor [push]"}'),
  ('00000000-0000-0000-0000-00000000ab02', 'vend2@push.local',     '{"nome":"Vendedor sem whats [push]"}'),
  ('00000000-0000-0000-0000-00000000ad01', 'oper@push.local',      '{"nome":"Operador [push]"}');
update public.perfis set papel = 'admin' where id = '00000000-0000-0000-0000-00000000aa01';
update public.perfis set papel = 'administrativo', atende_whatsapp = true where id = '00000000-0000-0000-0000-00000000ae01';
update public.perfis set papel = 'financeiro', atende_whatsapp = true where id = '00000000-0000-0000-0000-00000000af01';
update public.perfis set papel = 'vendedor', atende_whatsapp = true where id = '00000000-0000-0000-0000-00000000ab01';
update public.perfis set papel = 'vendedor' where id = '00000000-0000-0000-0000-00000000ab02';
update public.perfis set papel = 'operador', atende_whatsapp = true where id = '00000000-0000-0000-0000-00000000ad01';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

insert into public.wa_numeros (phone_number_id, waba_id, numero_exibicao, nome)
values ('3000000000001', '4000000000001', '+55 48 0000-0000', 'Push [teste]');
create temp table conv on commit drop as
select conversa_id as id from public.crm_receber_mensagem('3000000000001', '5548977770001', 'Ana',
  'wamid.push1', 'texto', 'Oi', null, null, null, null, now());
grant select on conv to authenticated;

-- 1. Regra igual nas situações: primeiro contato, com o vendedor, setor administrativo
--    com o financeiro.
create function pg_temp.conferir(situacao text) returns void language plpgsql as $$
declare
  u uuid;
  na_tela boolean;
  no_servidor boolean;
begin
  for u in select id from public.perfis where email like '%@push.local' loop
    perform pg_temp.como(u::text);
    set local role authenticated;
    select privado.pode_ver_conversa_id((select id from conv)) into na_tela;
    reset role;
    select privado.usuario_ve_conversa(u, c.responsavel_id, c.setor) into no_servidor
      from public.wa_conversas c where c.id = (select id from conv);
    assert na_tela = no_servidor,
      format('%s: tela=%s servidor=%s para %s', situacao, na_tela, no_servidor,
             (select nome from public.perfis where id = u));
  end loop;
end $$;

select pg_temp.conferir('primeiro contato');
update public.wa_conversas set responsavel_id = '00000000-0000-0000-0000-00000000ab01', setor = 'comercial'
 where id = (select id from conv);
select pg_temp.conferir('com o vendedor');
update public.wa_conversas set responsavel_id = '00000000-0000-0000-0000-00000000af01', setor = 'administrativo'
 where id = (select id from conv);
select pg_temp.conferir('setor administrativo com o financeiro');
-- Volta para o primeiro contato.
update public.wa_conversas set responsavel_id = null, setor = null where id = (select id from conv);

-- 5. Operador e quem não atende não registram aparelho.
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-00000000ad01');
do $$ begin
  begin
    perform public.crm_registrar_aparelho('https://push.exemplo/op', 'x', 'y', 'teste');
    assert false, 'Operador não deveria registrar aparelho';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.como('00000000-0000-0000-0000-00000000ab02');
do $$ begin
  begin
    perform public.crm_registrar_aparelho('https://push.exemplo/v2', 'x', 'y', 'teste');
    assert false, 'Quem não atende WhatsApp não deveria registrar aparelho';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Aparelhos: admin, ADM, financeiro e vendedor.
select pg_temp.como('00000000-0000-0000-0000-00000000aa01');
select public.crm_registrar_aparelho('https://push.exemplo/admin', 'k', 'a', 'iPhone');
select pg_temp.como('00000000-0000-0000-0000-00000000ae01');
select public.crm_registrar_aparelho('https://push.exemplo/adm', 'k', 'a', 'Computador');
select pg_temp.como('00000000-0000-0000-0000-00000000af01');
select public.crm_registrar_aparelho('https://push.exemplo/fin', 'k', 'a', 'Computador');
select pg_temp.como('00000000-0000-0000-0000-00000000ab01');
select public.crm_registrar_aparelho('https://push.exemplo/vend', 'k', 'a', 'Android');

-- 4. Cada um só vê os próprios aparelhos.
do $$ begin
  assert (select count(*) from public.push_inscricoes) = 1, 'Vendedor deveria ver só o aparelho dele';
end $$;
reset role;

create function pg_temp.recebem() returns text language sql as $$
  select coalesce(string_agg(p.nome, ', ' order by p.nome), '')
    from public.crm_destinatarios_push((select id from conv)) d
    join public.perfis p on p.id = d.usuario_id
$$;

-- Primeiro contato: admin e ADM.
do $$ begin
  assert pg_temp.recebem() = 'ADM [push], Admin [push]', 'Primeiro contato: ' || pg_temp.recebem();
end $$;

-- 3. Número do ícone.
do $$ begin
  assert (select nao_lidas_total from public.crm_destinatarios_push((select id from conv))
           where usuario_id = '00000000-0000-0000-0000-00000000aa01') = 1, 'Admin deveria ter 1 não lida';
end $$;

-- 2. Preferências.
insert into public.preferencias_notificacao (usuario_id, ativo) values ('00000000-0000-0000-0000-00000000ae01', false);
insert into public.preferencias_notificacao (usuario_id, apenas_minhas, mostrar_previa)
values ('00000000-0000-0000-0000-00000000aa01', true, false);
do $$ begin
  assert pg_temp.recebem() = '', 'ADM desligou e admin só quer as dele: ' || pg_temp.recebem();
end $$;

update public.wa_conversas set responsavel_id = '00000000-0000-0000-0000-00000000aa01' where id = (select id from conv);
do $$ begin
  assert pg_temp.recebem() = 'Admin [push]', 'Admin responsável deveria receber: ' || pg_temp.recebem();
  assert not (select mostrar_previa from public.crm_destinatarios_push((select id from conv))),
    'Sem prévia deveria vir com mostrar_previa = false';
end $$;

update public.wa_conversas set responsavel_id = '00000000-0000-0000-0000-00000000ab01' where id = (select id from conv);
do $$ begin
  assert pg_temp.recebem() = 'Vendedor [push]', 'Só o vendedor responsável: ' || pg_temp.recebem();
end $$;

-- 4. O aparelho do vendedor passa para o financeiro (trocou o login no mesmo celular).
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-00000000af01');
select public.crm_registrar_aparelho('https://push.exemplo/vend', 'k2', 'a2', 'Android');
reset role;
do $$ begin
  assert (select usuario_id from public.push_inscricoes where endpoint = 'https://push.exemplo/vend')
         = '00000000-0000-0000-0000-00000000af01', 'O aparelho deveria ficar com quem entrou por último';
  assert pg_temp.recebem() = '', 'Ninguém recebe: o vendedor ficou sem aparelho';
end $$;

-- Ninguém do navegador consulta os destinatários.
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-00000000aa01');
do $$ begin
  begin
    perform public.crm_destinatarios_push((select id from conv));
    assert false, 'O navegador não deveria consultar os destinatários';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

select 'crm_push: tudo certo' as resultado;
rollback;
