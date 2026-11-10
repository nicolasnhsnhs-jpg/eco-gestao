-- =============================================================================
-- Agenda do dia.
--
--  1. ADM e vendedor criam o dia, linhas e alteram.
--  2. Operador e recepção não veem nem mexem.
--  3. Apagar o dia leva as linhas junto.
--  4. Cadastro de técnicos e veículos: ADM cadastra, vendedor só vê, operador nem vê.
--
-- Rodar:  npm run test:db   (transação desfeita no final)
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000a9001', 'adm@agenda.local',  '{"nome":"ADM [agenda]"}'),
  ('00000000-0000-0000-0000-0000000a9002', 'vend@agenda.local', '{"nome":"Vendedor [agenda]"}'),
  ('00000000-0000-0000-0000-0000000a9003', 'op@agenda.local',   '{"nome":"Operador [agenda]"}'),
  ('00000000-0000-0000-0000-0000000a9004', 'rec@agenda.local',  '{"nome":"Recepção [agenda]"}');
update public.perfis set papel = 'administrativo' where id = '00000000-0000-0000-0000-0000000a9001';
update public.perfis set papel = 'vendedor'       where id = '00000000-0000-0000-0000-0000000a9002';
update public.perfis set papel = 'operador'       where id = '00000000-0000-0000-0000-0000000a9003';
update public.perfis set papel = 'recepcao'       where id = '00000000-0000-0000-0000-0000000a9004';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- 1. ADM cria o dia e uma linha; vendedor altera.
select pg_temp.como('00000000-0000-0000-0000-0000000a9001');
insert into public.agenda_dias (data, escalas) values ('2099-01-05', '[{"inicio":"06:30","fim":"16h","tecnicos":[5]}]');
insert into public.agenda_itens (id, data, hora, descricao, tecnicos, veiculo)
  values ('00000000-0000-0000-0000-0000000a9101', '2099-01-05', '06:30', 'SUSEPE 12: Rota', '{15}', 'K05');

select pg_temp.como('00000000-0000-0000-0000-0000000a9002');
update public.agenda_itens set veiculo = 'ON7' where id = '00000000-0000-0000-0000-0000000a9101';
do $$ begin
  if (select veiculo from public.agenda_itens where id = '00000000-0000-0000-0000-0000000a9101') <> 'ON7' then
    raise exception 'vendedor deveria alterar a linha';
  end if;
end $$;

-- 2. Operador e recepção: não veem e não alteram.
select pg_temp.como('00000000-0000-0000-0000-0000000a9003');
do $$ begin
  if exists (select 1 from public.agenda_itens) or exists (select 1 from public.agenda_dias) then
    raise exception 'operador não deveria ver a agenda';
  end if;
end $$;
update public.agenda_itens set veiculo = 'X' where id = '00000000-0000-0000-0000-0000000a9101';
do $$ begin
  begin
    insert into public.agenda_dias (data) values ('2099-01-06');
    raise exception 'operador não deveria criar dia';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.como('00000000-0000-0000-0000-0000000a9004');
do $$ begin
  if exists (select 1 from public.agenda_itens) then
    raise exception 'recepção não deveria ver a agenda';
  end if;
end $$;

select pg_temp.como('00000000-0000-0000-0000-0000000a9001');
do $$ begin
  if (select veiculo from public.agenda_itens where id = '00000000-0000-0000-0000-0000000a9101') <> 'ON7' then
    raise exception 'operador conseguiu alterar a linha';
  end if;
end $$;

-- 3. Apagar o dia leva as linhas.
delete from public.agenda_dias where data = '2099-01-05';
do $$ begin
  if exists (select 1 from public.agenda_itens where data = '2099-01-05') then
    raise exception 'as linhas deveriam sumir com o dia';
  end if;
end $$;

-- 4. Cadastro de técnicos e veículos.
select pg_temp.como('00000000-0000-0000-0000-0000000a9001');
insert into public.agenda_tecnicos (numero, nome, cnh) values (9901, 'Técnico [teste]', 'AB');
insert into public.agenda_veiculos (codigo, placa, tem_sem_parar) values ('ZZ99', 'AAA 0A00', false);

select pg_temp.como('00000000-0000-0000-0000-0000000a9002');
do $$ begin
  if not exists (select 1 from public.agenda_tecnicos where numero = 9901) then
    raise exception 'vendedor deveria ver os técnicos';
  end if;
  begin
    insert into public.agenda_veiculos (codigo) values ('ZZ98');
    raise exception 'vendedor não deveria cadastrar veículo';
  exception when insufficient_privilege then null;
  end;
end $$;
update public.agenda_tecnicos set nome = 'Mudou' where numero = 9901;

select pg_temp.como('00000000-0000-0000-0000-0000000a9003');
do $$ begin
  if exists (select 1 from public.agenda_tecnicos) or exists (select 1 from public.agenda_veiculos) then
    raise exception 'operador não deveria ver o cadastro';
  end if;
end $$;

select pg_temp.como('00000000-0000-0000-0000-0000000a9001');
do $$ begin
  if (select nome from public.agenda_tecnicos where numero = 9901) <> 'Técnico [teste]' then
    raise exception 'vendedor conseguiu alterar o técnico';
  end if;
end $$;

select 'agenda: ok' as resultado;

rollback;
