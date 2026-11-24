-- =============================================================================
-- Cronograma (Serviços > Cronograma).
--
--  1. Recepção (SAC) monta a rota no mês, põe as unidades e muda as datas.
--  2. Pela tela ninguém grava o envio por e-mail (só a função); o aviso à mão, sim.
--  3. Vendedor e operador não veem nem mexem.
--  4. A mesma rota não é montada duas vezes no mesmo mês; o mês começa no dia 1.
--  5. O registro de e-mail aceita o tipo "cronograma".
--  6. Um só "Fora de rota" (cronograma sem rota) por mês.
--
-- Rodar:  npm run test:db   (transação desfeita no final)
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000c7001', 'rec@crono.local',  '{"nome":"Recepção [crono]"}'),
  ('00000000-0000-0000-0000-0000000c7002', 'vend@crono.local', '{"nome":"Vendedor [crono]"}'),
  ('00000000-0000-0000-0000-0000000c7003', 'op@crono.local',   '{"nome":"Operador [crono]"}');
update public.perfis set papel = 'recepcao' where id = '00000000-0000-0000-0000-0000000c7001';
update public.perfis set papel = 'vendedor' where id = '00000000-0000-0000-0000-0000000c7002';
update public.perfis set papel = 'operador' where id = '00000000-0000-0000-0000-0000000c7003';

insert into public.clientes (id, tipo_pessoa, nome, email) values
  ('00000000-0000-0000-0000-0000000c7101', 'PJ', 'Cliente [crono]', 'cliente@crono.local');
insert into public.os_rotas (id, nome) values
  ('00000000-0000-0000-0000-0000000c7201', 'Rota [crono]');

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- 1. Recepção monta e altera.
select pg_temp.como('00000000-0000-0000-0000-0000000c7001');
insert into public.cronograma_rotas (id, rota_id, mes, datas) values
  ('00000000-0000-0000-0000-0000000c7301', '00000000-0000-0000-0000-0000000c7201',
   '2099-12-01', '{2099-12-10,2099-12-25}');
insert into public.cronograma_itens (id, cronograma_id, cliente_id, servicos, ordem, so_visita) values
  ('00000000-0000-0000-0000-0000000c7401', '00000000-0000-0000-0000-0000000c7301',
   '00000000-0000-0000-0000-0000000c7101', '{Controle de pragas}', 0, 1);
update public.cronograma_rotas set datas = '{2099-12-11,2099-12-26}', horario = 'Manhã'
  where id = '00000000-0000-0000-0000-0000000c7301';
update public.cronograma_itens set datas = '{2099-12-27}', so_visita = null, observacoes = 'X'
  where id = '00000000-0000-0000-0000-0000000c7401';

-- 2. Aviso à mão pode; envio por e-mail, não.
update public.cronograma_itens
   set aviso_manual_em = now(), aviso_manual_por = '00000000-0000-0000-0000-0000000c7001',
       aviso_manual_obs = 'WhatsApp'
 where id = '00000000-0000-0000-0000-0000000c7401';
do $$ begin
  if (select datas from public.cronograma_itens where id = '00000000-0000-0000-0000-0000000c7401')
     <> '{2099-12-27}' then
    raise exception 'recepção deveria alterar as datas da unidade';
  end if;
  begin
    update public.cronograma_itens set enviado_em = now()
      where id = '00000000-0000-0000-0000-0000000c7401';
    raise exception 'pela tela não se grava o envio';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.cronograma_rotas (rota_id, mes) values
      ('00000000-0000-0000-0000-0000000c7201', '2099-12-01');
    raise exception 'a rota não pode ser montada duas vezes no mês';
  exception when unique_violation then null;
  end;
  insert into public.cronograma_rotas (rota_id, mes) values (null, '2099-12-01');
  begin
    insert into public.cronograma_rotas (rota_id, mes) values (null, '2099-12-01');
    raise exception 'um só "Fora de rota" por mês';
  exception when unique_violation then null;
  end;
  begin
    insert into public.cronograma_rotas (rota_id, mes) values
      ('00000000-0000-0000-0000-0000000c7201', '2099-11-15');
    raise exception 'o mês tem que começar no dia 1';
  exception when check_violation then null;
  end;
end $$;

-- 3. Vendedor e operador não veem nem mexem.
select pg_temp.como('00000000-0000-0000-0000-0000000c7002');
update public.cronograma_rotas set horario = 'Y' where id = '00000000-0000-0000-0000-0000000c7301';
do $$ begin
  if exists (select 1 from public.cronograma_rotas) or exists (select 1 from public.cronograma_itens) then
    raise exception 'vendedor não deveria ver o cronograma';
  end if;
  begin
    insert into public.cronograma_rotas (rota_id, mes) values
      ('00000000-0000-0000-0000-0000000c7201', '2099-10-01');
    raise exception 'vendedor não deveria montar rota';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.como('00000000-0000-0000-0000-0000000c7003');
do $$ begin
  if exists (select 1 from public.cronograma_itens) then
    raise exception 'operador não deveria ver o cronograma';
  end if;
end $$;

-- 4/5. Como a função (service role): grava o envio e o registro do e-mail.
reset role;
do $$
declare v_email uuid;
begin
  if (select horario from public.cronograma_rotas where id = '00000000-0000-0000-0000-0000000c7301')
     <> 'Manhã' then
    raise exception 'vendedor não deveria ter alterado o horário';
  end if;
  insert into public.emails_enviados (setor, tipo, cliente_id, cliente_nome, para, assunto)
    values ('administrativo', 'cronograma', '00000000-0000-0000-0000-0000000c7101',
            'Cliente [crono]', 'cliente@crono.local', 'Datas')
    returning id into v_email;
  update public.cronograma_itens
     set enviado_em = now(), enviado_para = 'cliente@crono.local',
         datas_enviadas = '{2099-12-27}', email_id = v_email
   where id = '00000000-0000-0000-0000-0000000c7401';
end $$;

-- Apagar o mês leva as unidades junto.
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000c7001');
delete from public.cronograma_rotas where id = '00000000-0000-0000-0000-0000000c7301';
reset role;
do $$ begin
  if exists (select 1 from public.cronograma_itens where id = '00000000-0000-0000-0000-0000000c7401') then
    raise exception 'apagar o mês deveria levar as unidades';
  end if;
end $$;

select 'cronograma: ok' as resultado;

rollback;
