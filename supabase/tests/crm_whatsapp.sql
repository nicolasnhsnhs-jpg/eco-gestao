-- =============================================================================
-- CRM do WhatsApp: quem vê cada conversa e as regras de recebimento e envio.
--
--  1. Mensagem recebida cria contato e conversa e liga ao cliente pelo WhatsApp
--     (mesmo quando a Meta manda o celular sem o 9).
--  2. O mesmo webhook duas vezes não duplica a mensagem nem soma não lida.
--  3. Primeiro contato (sem responsável): admin e ADM veem; financeiro e vendedor não.
--  4. Sem a permissão "atende WhatsApp", ninguém além do admin entra; operador nunca.
--  5. Transferir: admin e ADM sim; vendedor não; só para quem atende pelo WhatsApp.
--  6. Conversa do setor administrativo aparece para o ADM mesmo com outro responsável.
--  7. Cliente voltando depois de finalizar: volta para o primeiro contato.
--  8. Status das mensagens enviadas só anda para a frente.
--  9. Notas e mensagens seguem a regra da conversa; eventos brutos ninguém lê.
-- 10. Quem responde o primeiro contato vira o responsável.
--
-- Rodar:  npm run test:db   (transação desfeita no final)
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000009a01', 'admin@crm.local',      '{"nome":"Admin [crm]"}'),
  ('00000000-0000-0000-0000-000000009e01', 'adm@crm.local',        '{"nome":"ADM [crm]"}'),
  ('00000000-0000-0000-0000-000000009f01', 'financeiro@crm.local', '{"nome":"Financeiro [crm]"}'),
  ('00000000-0000-0000-0000-000000009b01', 'vendedor@crm.local',   '{"nome":"Vendedor [crm]"}'),
  ('00000000-0000-0000-0000-000000009b02', 'vendedor2@crm.local',  '{"nome":"Vendedor 2 [crm]"}'),
  ('00000000-0000-0000-0000-000000009c01', 'recepcao@crm.local',   '{"nome":"Recepção [crm]"}'),
  ('00000000-0000-0000-0000-000000009d01', 'operador@crm.local',   '{"nome":"Operador [crm]"}');
update public.perfis set papel = 'admin' where id = '00000000-0000-0000-0000-000000009a01';
update public.perfis set papel = 'administrativo', atende_whatsapp = true where id = '00000000-0000-0000-0000-000000009e01';
update public.perfis set papel = 'financeiro', atende_whatsapp = true where id = '00000000-0000-0000-0000-000000009f01';
update public.perfis set papel = 'vendedor', atende_whatsapp = true where id = '00000000-0000-0000-0000-000000009b01';
update public.perfis set papel = 'vendedor', atende_whatsapp = true where id = '00000000-0000-0000-0000-000000009b02';
update public.perfis set papel = 'recepcao' where id = '00000000-0000-0000-0000-000000009c01';
update public.perfis set papel = 'operador', atende_whatsapp = true where id = '00000000-0000-0000-0000-000000009d01';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

-- Quantas conversas do teste a pessoa enxerga.
create function pg_temp.vejo() returns bigint language sql as $$
  select count(*) from public.wa_conversas c
    join public.wa_contatos k on k.id = c.contato_id where k.wa_id = '554888600001';
$$;

insert into public.wa_numeros (id, phone_number_id, waba_id, numero_exibicao, nome)
values ('00000000-0000-0000-0000-00000000a001', '1000000000001', '2000000000001', '+55 48 98860-8723', 'Eco SC [crm]');

insert into public.clientes (id, tipo_pessoa, nome, whatsapp)
values ('00000000-0000-0000-0000-00000000c901', 'PF', 'Cliente [crm]', '48988600001');

-- 1. Recebe (a Meta manda sem o 9: 55 48 8860-0001) e liga ao cliente.
create temp table r on commit drop as
select * from public.crm_receber_mensagem('1000000000001', '554888600001', 'Maria', 'wamid.crm1',
  'texto', 'Olá, quero um orçamento', null, null, null, null, now() - interval '1 minute');

grant select on r to authenticated;

do $$
declare v record;
begin
  select * into v from r;
  assert v.nova, 'A primeira mensagem deveria ser nova';
  assert (select k.cliente_id from public.wa_contatos k where k.wa_id = '554888600001')
         = '00000000-0000-0000-0000-00000000c901', 'O contato deveria estar ligado ao cliente';
  assert (select nao_lidas from public.wa_conversas where id = v.conversa_id) = 1, 'Deveria ter 1 não lida';
  assert (select ultima_mensagem_previa from public.wa_conversas where id = v.conversa_id) = 'Olá, quero um orçamento';
end $$;

-- 2. Mesmo webhook de novo.
do $$
declare v record;
begin
  select * into v from public.crm_receber_mensagem('1000000000001', '554888600001', 'Maria', 'wamid.crm1',
    'texto', 'Olá, quero um orçamento', null, null, null, null, now());
  assert not v.nova, 'Mensagem repetida não deveria ser nova';
  assert (select count(*) from public.wa_mensagens where wamid = 'wamid.crm1') = 1, 'Não deveria duplicar';
  assert (select nao_lidas from public.wa_conversas where id = v.conversa_id) = 1, 'Não deveria somar não lida';
end $$;

-- Número desconhecido: erro (o webhook guarda o evento e avisa).
do $$ begin
  begin
    perform public.crm_receber_mensagem('999', '5548988600002', null, 'wamid.crmx', 'texto', 'oi',
      null, null, null, null, now());
    assert false, 'Número não cadastrado deveria dar erro';
  exception when no_data_found then null;
  end;
end $$;

-- 3 e 4. Primeiro contato.
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-000000009a01');
do $$ begin assert pg_temp.vejo() = 1, 'Admin deveria ver o primeiro contato'; end $$;
select pg_temp.como('00000000-0000-0000-0000-000000009e01');
do $$ begin
  assert pg_temp.vejo() = 1, 'ADM deveria ver o primeiro contato';
  assert (select count(*) from public.wa_mensagens where wamid = 'wamid.crm1') = 1, 'ADM deveria ver a mensagem';
  assert (select count(*) from public.wa_contatos where wa_id = '554888600001') = 1, 'ADM deveria ver o contato';
end $$;
select pg_temp.como('00000000-0000-0000-0000-000000009f01');
do $$ begin assert pg_temp.vejo() = 0, 'Financeiro não deveria ver o primeiro contato'; end $$;
select pg_temp.como('00000000-0000-0000-0000-000000009b01');
do $$ begin
  assert pg_temp.vejo() = 0, 'Vendedor não deveria ver o primeiro contato';
  assert (select count(*) from public.wa_mensagens where wamid = 'wamid.crm1') = 0, 'Vendedor não deveria ver a mensagem';
end $$;
select pg_temp.como('00000000-0000-0000-0000-000000009d01');
do $$ begin assert pg_temp.vejo() = 0, 'Operador nunca usa o CRM'; end $$;
-- Eventos brutos: ninguém lê pelo navegador.
select pg_temp.como('00000000-0000-0000-0000-000000009a01');
do $$ begin
  begin
    perform count(*) from public.wa_eventos;
    assert false, 'Ninguém deveria ler os eventos brutos';
  exception when insufficient_privilege then null;
  end;
end $$;
-- Gravar mensagem direto: não.
do $$ begin
  begin
    perform public.crm_receber_mensagem('1000000000001', '5548988600009', null, 'wamid.crmz', 'texto', 'x',
      null, null, null, null, now());
    assert false, 'O navegador não deveria gravar mensagem';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 5. Transferências.
select pg_temp.como('00000000-0000-0000-0000-000000009e01');
do $$ begin
  begin
    perform public.crm_transferir((select conversa_id from r), '00000000-0000-0000-0000-000000009c01');
    assert false, 'Não deveria transferir para quem não atende pelo WhatsApp';
  exception when check_violation then null;
  end;
  begin
    perform public.crm_transferir((select conversa_id from r), '00000000-0000-0000-0000-000000009d01');
    assert false, 'Não deveria transferir para operador';
  exception when check_violation then null;
  end;
end $$;
select public.crm_transferir((select conversa_id from r), '00000000-0000-0000-0000-000000009b01',
                             'comercial', 'Pediu orçamento');
do $$ begin assert pg_temp.vejo() = 0, 'ADM não deveria ver depois de passar para o vendedor'; end $$;

select pg_temp.como('00000000-0000-0000-0000-000000009b01');
do $$ begin
  assert pg_temp.vejo() = 1, 'Vendedor deveria ver a conversa dele';
  assert (select count(*) from public.wa_transferencias where conversa_id = (select conversa_id from r)) = 1;
  begin
    perform public.crm_transferir((select conversa_id from r), '00000000-0000-0000-0000-000000009b02');
    assert false, 'Vendedor não transfere';
  exception when insufficient_privilege then null;
  end;
end $$;
-- Nota do vendedor na conversa dele: pode.
insert into public.wa_notas (conversa_id, texto) select conversa_id, 'Cliente quer visita amanhã' from r;

select pg_temp.como('00000000-0000-0000-0000-000000009b02');
do $$ begin
  assert pg_temp.vejo() = 0, 'Outro vendedor não deveria ver';
  assert (select count(*) from public.wa_notas where conversa_id = (select conversa_id from r)) = 0;
  begin
    insert into public.wa_notas (conversa_id, texto) select conversa_id, 'intruso' from r;
    assert false, 'Outro vendedor não deveria anotar';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.crm_status((select conversa_id from r), 'finalizada');
    assert false, 'Outro vendedor não deveria finalizar';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 6. Setor administrativo aparece para o ADM.
select pg_temp.como('00000000-0000-0000-0000-000000009a01');
select public.crm_transferir((select conversa_id from r), '00000000-0000-0000-0000-000000009f01', 'administrativo');
select pg_temp.como('00000000-0000-0000-0000-000000009e01');
do $$ begin assert pg_temp.vejo() = 1, 'ADM deveria ver conversa do setor administrativo'; end $$;
select pg_temp.como('00000000-0000-0000-0000-000000009f01');
do $$ begin assert pg_temp.vejo() = 1, 'Financeiro deveria ver a conversa direcionada a ele'; end $$;
select pg_temp.como('00000000-0000-0000-0000-000000009b01');
do $$ begin assert pg_temp.vejo() = 0, 'Vendedor perdeu a conversa ao ser transferida'; end $$;

-- 7. Financeiro finaliza; o cliente volta → primeiro contato de novo.
select pg_temp.como('00000000-0000-0000-0000-000000009f01');
select public.crm_status((select conversa_id from r), 'finalizada');
reset role;
select public.crm_receber_mensagem('1000000000001', '554888600001', 'Maria', 'wamid.crm2',
  'imagem', null, 'midia123', 'image/jpeg', null, null, now());
do $$
declare c public.wa_conversas;
begin
  select * into c from public.wa_conversas where id = (select conversa_id from r);
  assert c.status = 'aberta', 'Deveria reabrir';
  assert c.responsavel_id is null, 'Deveria voltar para o primeiro contato';
  assert c.setor is null, 'Setor deveria limpar';
  assert c.ultimo_responsavel_id = '00000000-0000-0000-0000-000000009f01', 'Deveria lembrar o último responsável';
  assert c.ultima_mensagem_previa = '📷 Foto';
end $$;

-- 10. ADM responde o primeiro contato e vira o responsável.
select public.crm_registrar_envio((select conversa_id from r), '00000000-0000-0000-0000-000000009e01',
  'texto', 'Bom dia! Já te ajudo.', null, null, null, null);
update public.wa_mensagens set wamid = 'wamid.saida1'
 where conversa_id = (select conversa_id from r) and direcao = 'saida';
do $$ begin
  assert (select responsavel_id from public.wa_conversas where id = (select conversa_id from r))
         = '00000000-0000-0000-0000-000000009e01', 'Quem respondeu deveria virar o responsável';
  assert (select nao_lidas from public.wa_conversas where id = (select conversa_id from r)) = 0;
end $$;

-- 8. Status fora de ordem.
select public.crm_atualizar_status('wamid.saida1', 'lida', now(), null);
select public.crm_atualizar_status('wamid.saida1', 'entregue', now(), null);
do $$ begin
  assert (select status from public.wa_mensagens where wamid = 'wamid.saida1') = 'lida',
    'Entregue depois de lida não deveria voltar o status';
end $$;
select public.crm_atualizar_status('wamid.saida1', 'falhou', now(), '131047: janela fechada');
do $$ begin
  assert (select status from public.wa_mensagens where wamid = 'wamid.saida1') = 'falhou';
  assert (select erro from public.wa_mensagens where wamid = 'wamid.saida1') like '131047%';
end $$;

-- Telefones do wa_id
do $$ begin
  assert privado.telefones_do_wa_id('5548988608723') = array['48988608723', '4888608723'];
  assert privado.telefones_do_wa_id('554888608723') = array['4888608723', '48988608723'];
  assert privado.telefones_do_wa_id('554832221234') = array['4832221234'];
  assert privado.telefones_do_wa_id('14155550123') = array[]::text[];
end $$;

-- Dois clientes com o mesmo número: não liga sozinho.
insert into public.clientes (tipo_pessoa, nome, telefone) values ('PF', 'Duplo A [crm]', '48988600077'), ('PF', 'Duplo B [crm]', '48988600077');
do $$ begin assert privado.cliente_do_wa_id('5548988600077') is null, 'Com dois cadastros não deveria escolher'; end $$;

select 'crm_whatsapp: tudo certo' as resultado;
rollback;
