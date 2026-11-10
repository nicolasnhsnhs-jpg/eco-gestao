-- =============================================================================
-- Agenda do dia.
--
--  1. Administrador e vendedor criam o dia, linhas e alteram.
--  2. ADM só consulta: vê, mas não cria, altera nem apaga.
--  3. Operador e recepção não veem nem mexem.
--  4. Apagar o dia leva as linhas junto.
--  5. Cadastro de técnicos e veículos: administrador cadastra; ADM e vendedor só veem.
--  6. Viagem de vários dias: a linha aparece nos dias seguintes e acompanha as mudanças.
--
-- Rodar:  npm run test:db   (transação desfeita no final)
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000a9001', 'admin@agenda.local', '{"nome":"Admin [agenda]"}'),
  ('00000000-0000-0000-0000-0000000a9002', 'vend@agenda.local',  '{"nome":"Vendedor [agenda]"}'),
  ('00000000-0000-0000-0000-0000000a9003', 'op@agenda.local',    '{"nome":"Operador [agenda]"}'),
  ('00000000-0000-0000-0000-0000000a9004', 'rec@agenda.local',   '{"nome":"Recepção [agenda]"}'),
  ('00000000-0000-0000-0000-0000000a9005', 'adm@agenda.local',   '{"nome":"ADM [agenda]"}');
update public.perfis set papel = 'admin'          where id = '00000000-0000-0000-0000-0000000a9001';
update public.perfis set papel = 'vendedor'       where id = '00000000-0000-0000-0000-0000000a9002';
update public.perfis set papel = 'operador'       where id = '00000000-0000-0000-0000-0000000a9003';
update public.perfis set papel = 'recepcao'       where id = '00000000-0000-0000-0000-0000000a9004';
update public.perfis set papel = 'administrativo' where id = '00000000-0000-0000-0000-0000000a9005';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- 1. Administrador cria o dia e uma linha; vendedor altera.
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

-- 2. ADM vê, mas não mexe.
select pg_temp.como('00000000-0000-0000-0000-0000000a9005');
do $$ begin
  if not exists (select 1 from public.agenda_itens where id = '00000000-0000-0000-0000-0000000a9101') then
    raise exception 'ADM deveria ver a agenda';
  end if;
  begin
    insert into public.agenda_dias (data) values ('2099-01-07');
    raise exception 'ADM não deveria criar dia';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.agenda_itens (data, hora, descricao) values ('2099-01-05', '08:00', 'X');
    raise exception 'ADM não deveria criar linha';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.agenda_tecnicos (numero, nome) values (9902, 'X');
    raise exception 'ADM não deveria cadastrar técnico';
  exception when insufficient_privilege then null;
  end;
end $$;
update public.agenda_itens set veiculo = 'X', realizado = true where id = '00000000-0000-0000-0000-0000000a9101';
update public.agenda_dias set mensagem = 'X' where data = '2099-01-05';
delete from public.agenda_itens where id = '00000000-0000-0000-0000-0000000a9101';

-- 3. Operador e recepção: não veem e não alteram.
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
  if (select veiculo || realizado::text from public.agenda_itens
       where id = '00000000-0000-0000-0000-0000000a9101') is distinct from 'ON7false' then
    raise exception 'ADM ou operador conseguiu alterar a linha';
  end if;
  if (select mensagem from public.agenda_dias where data = '2099-01-05') = 'X' then
    raise exception 'ADM conseguiu alterar o dia';
  end if;
end $$;

-- 4. Apagar o dia leva as linhas.
delete from public.agenda_dias where data = '2099-01-05';
do $$ begin
  if exists (select 1 from public.agenda_itens where data = '2099-01-05') then
    raise exception 'as linhas deveriam sumir com o dia';
  end if;
end $$;

-- 5. Cadastro de técnicos e veículos.
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

select pg_temp.como('00000000-0000-0000-0000-0000000a9005');
update public.agenda_veiculos set placa = 'Mudou' where codigo = 'ZZ99';

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
  if (select placa from public.agenda_veiculos where codigo = 'ZZ99') <> 'AAA 0A00' then
    raise exception 'ADM conseguiu alterar o veículo';
  end if;
end $$;

-- 6. Viagem de vários dias.
do $$ begin
  if privado.datas_do_periodo('09/11 a 12/11', '2026-11-10')
     <> array['2026-11-09','2026-11-10','2026-11-11','2026-11-12']::date[] then
    raise exception 'intervalo errado';
  end if;
  if privado.datas_do_periodo('09/11 e 10/11', '2026-11-10') <> array['2026-11-09','2026-11-10']::date[] then
    raise exception 'lista errada';
  end if;
  if privado.datas_do_periodo('30/12 a 02/01', '2026-12-30') <> array['2026-12-30','2026-12-31','2027-01-01','2027-01-02']::date[] then
    raise exception 'virada de ano errada';
  end if;
  if privado.datas_do_periodo('Manhã', '2026-11-10') <> '{}'::date[] then
    raise exception 'sem datas deveria dar vazio';
  end if;
end $$;

insert into public.agenda_dias (data, mensagem) values ('2099-03-02', 'Boa viagem!');
insert into public.agenda_itens (id, data, hora, descricao, periodo, tecnicos, veiculo)
  values ('00000000-0000-0000-0000-0000000a9201', '2099-03-02', '07:30', 'SUSEPE 14: Rota', '02/03 a 04/03', '{5}', 'ON7');
do $$ begin
  if (select count(*) from public.agenda_itens where descricao = 'SUSEPE 14: Rota') <> 3 then
    raise exception 'a viagem deveria aparecer nos 3 dias';
  end if;
  if (select mensagem from public.agenda_dias where data = '2099-03-04') <> 'Boa viagem!' then
    raise exception 'o dia novo deveria copiar a mensagem do anterior';
  end if;
end $$;

-- Marca R no último dia e muda o veículo no primeiro: o veículo vai junto, o R fica.
update public.agenda_itens set realizado = true where data = '2099-03-04' and descricao = 'SUSEPE 14: Rota';
update public.agenda_itens set veiculo = 'ON9' where id = '00000000-0000-0000-0000-0000000a9201';
do $$ begin
  if exists (select 1 from public.agenda_itens where descricao = 'SUSEPE 14: Rota' and veiculo <> 'ON9') then
    raise exception 'a mudança deveria ir para os outros dias';
  end if;
  if (select realizado from public.agenda_itens where data = '2099-03-04' and descricao = 'SUSEPE 14: Rota') is not true then
    raise exception 'o R é de cada dia';
  end if;
end $$;

-- Encurta o período: o dia 03 sai; o 04 fica porque já está realizado.
update public.agenda_itens set periodo = '02/03 a 02/03' where id = '00000000-0000-0000-0000-0000000a9201';
do $$ begin
  if exists (select 1 from public.agenda_itens where data = '2099-03-03') then
    raise exception 'a cópia fora do período deveria sumir';
  end if;
  if not exists (select 1 from public.agenda_itens where data = '2099-03-04') then
    raise exception 'a cópia já realizada deveria ficar';
  end if;
end $$;

-- Linha igual já lançada no dia seguinte é aproveitada (não duplica).
insert into public.agenda_dias (data) values ('2099-04-06'), ('2099-04-07');
insert into public.agenda_itens (data, hora, descricao) values ('2099-04-07', '07:30', 'Santa Maria: Rota');
insert into public.agenda_itens (data, hora, descricao, periodo)
  values ('2099-04-06', '07:30', 'Santa Maria: Rota', '06/04 e 07/04');
do $$ begin
  if (select count(*) from public.agenda_itens where data = '2099-04-07') <> 1 then
    raise exception 'a linha igual deveria ser aproveitada';
  end if;
end $$;

select 'agenda: ok' as resultado;

rollback;
