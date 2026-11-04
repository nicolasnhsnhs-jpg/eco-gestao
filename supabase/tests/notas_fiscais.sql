-- =============================================================================
-- Testes de vencimento em dia fixo nos contratos e de notas fiscais.
-- Transação desfeita no final (rollback): nada fica no banco.
-- Rodar:  npm run test:db
-- =============================================================================

begin;

update public.configuracoes set valor = '1' where chave = 'contrato_dia_util_cobranca';

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'financeiro@teste.local', '{"nome":"Financeiro Teste"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'vend.a@teste.local',     '{"nome":"Vendedor A"}');
update public.perfis set papel = 'financeiro' where id = '00000000-0000-0000-0000-0000000000f1';
update public.perfis set papel = 'vendedor'   where id = '00000000-0000-0000-0000-0000000000b1';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.mes(deslocamento int) returns date language sql as $$
  select (date_trunc('month', privado.hoje()) + make_interval(months => deslocamento))::date
$$;

insert into public.clientes (id, tipo_pessoa, nome, vendedor_responsavel_id) values
  ('00000000-0000-0000-0000-00000000c0a1', 'PJ', 'Cliente com nota [teste]', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000c0a2', 'PJ', 'Outro cliente [teste]', null);

-- =============================================================================
-- Vencimento
-- =============================================================================
do $$ begin
  assert privado.vencimento_contrato('2026-11-01', 10::smallint, true, null) = '2026-12-10',
    'Dia 10 do mês seguinte: nota de nov vence 10/12';
  assert privado.vencimento_contrato('2026-11-01', 30::smallint, false, null) = '2026-11-30',
    'Dia 30 no mesmo mês';
  assert privado.vencimento_contrato('2027-01-01', 31::smallint, true, null) = '2027-02-28',
    'Dia 31 em fevereiro vira o último dia do mês';
  assert privado.vencimento_contrato('2026-11-01', null, false, null) = public.dia_util(2026, 11, 1),
    'Sem dia fixo continua no dia útil padrão';
  assert privado.vencimento_contrato('2026-11-01', null, true, 5::smallint) = public.dia_util(2026, 11, 5),
    'Sem dia fixo, "mês seguinte" não muda nada (o dia útil é do próprio mês)';
end $$;

select pg_temp.como('00000000-0000-0000-0000-0000000000f1');

insert into public.contratos
  (id, cliente_id, descricao, valor_mensal, data_inicio, dia_vencimento, vence_mes_seguinte) values
  ('00000000-0000-0000-0000-0000000c0a01', '00000000-0000-0000-0000-00000000c0a1',
   'Controle de pragas [teste]', 500, pg_temp.mes(-2), 6, true);
select privado.gerar_cobrancas_contratos(pg_temp.mes(0));

do $$
declare
  v_venc date;
begin
  select vencimento into v_venc from public.lancamentos
   where contrato_id = '00000000-0000-0000-0000-0000000c0a01' and competencia = pg_temp.mes(0);
  assert v_venc = (pg_temp.mes(1) + 5), 'A mensalidade do mês deveria vencer no dia 6 do mês seguinte';
end $$;

-- Trocar o dia recalcula a mensalidade em aberto.
update public.contratos set dia_vencimento = 15, vence_mes_seguinte = false
 where id = '00000000-0000-0000-0000-0000000c0a01';
do $$ begin
  assert (select vencimento from public.lancamentos
           where contrato_id = '00000000-0000-0000-0000-0000000c0a01' and competencia = pg_temp.mes(0))
         = pg_temp.mes(0) + 14, 'Mudando para dia 15 do mesmo mês, a mensalidade em aberto acompanha';
end $$;

-- =============================================================================
-- Notas fiscais
-- =============================================================================

-- Nota de contrato ligada à mensalidade: o número vai para a conta a receber.
insert into public.notas_fiscais
  (id, tipo, cliente_id, contrato_id, lancamento_id, numero, numero_dps, data_emissao, competencia,
   descricao, valor_servico)
select '00000000-0000-0000-0000-00000000f001', 'contrato', '00000000-0000-0000-0000-00000000c0a1',
       '00000000-0000-0000-0000-0000000c0a01', l.id, '9001', 'DPS-TESTE-1', pg_temp.mes(0),
       pg_temp.mes(0) + 9, 'Contrato de controle de pragas [teste]', 500
  from public.lancamentos l
 where l.contrato_id = '00000000-0000-0000-0000-0000000c0a01' and l.competencia = pg_temp.mes(0);

do $$ begin
  assert (select competencia from public.notas_fiscais where id = '00000000-0000-0000-0000-00000000f001')
         = pg_temp.mes(0), 'A competência é guardada como o dia 1 do mês';
  assert (select numero_nota_fiscal from public.lancamentos l
            join public.notas_fiscais n on n.lancamento_id = l.id
           where n.id = '00000000-0000-0000-0000-00000000f001') = '9001',
    'O número da nota deveria aparecer na conta a receber';
end $$;

-- Aditivo: a mensalidade com nota emitida mantém o valor da nota; a seguinte muda.
select privado.gerar_cobrancas_contratos(pg_temp.mes(1));
update public.contratos set valor_mensal = 600 where id = '00000000-0000-0000-0000-0000000c0a01';
do $$ begin
  assert (select valor from public.lancamentos
           where contrato_id = '00000000-0000-0000-0000-0000000c0a01' and competencia = pg_temp.mes(0))
         = 500, 'A mensalidade com nota emitida deveria continuar com o valor da nota';
  assert (select valor from public.lancamentos
           where contrato_id = '00000000-0000-0000-0000-0000000c0a01' and competencia = pg_temp.mes(1))
         = 600, 'A mensalidade seguinte, sem nota, deveria ir para o novo valor';
end $$;

-- Nota de contrato sem contrato: recusada (só a cancelada pode).
do $$ begin
  begin
    insert into public.notas_fiscais (tipo, cliente_id, data_emissao, competencia, descricao, valor_servico)
    values ('contrato', '00000000-0000-0000-0000-00000000c0a1', pg_temp.mes(0), pg_temp.mes(0), 'Sem contrato [teste]', 10);
    raise exception 'deveria ter recusado';
  exception when check_violation then null;
  end;
end $$;

-- Avulsa com contrato: recusada.
do $$ begin
  begin
    insert into public.notas_fiscais (tipo, cliente_id, contrato_id, data_emissao, competencia, descricao, valor_servico)
    values ('avulsa', '00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000c0a01',
            pg_temp.mes(0), pg_temp.mes(0), 'Avulsa com contrato [teste]', 10);
    raise exception 'deveria ter recusado';
  exception when check_violation then null;
  end;
end $$;

-- Contrato de outro cliente: recusado.
do $$ begin
  begin
    insert into public.notas_fiscais (tipo, cliente_id, contrato_id, data_emissao, competencia, descricao, valor_servico)
    values ('contrato', '00000000-0000-0000-0000-00000000c0a2', '00000000-0000-0000-0000-0000000c0a01',
            pg_temp.mes(0), pg_temp.mes(0), 'Contrato de outro [teste]', 10);
    raise exception 'deveria ter recusado';
  exception when check_violation then null;
  end;
end $$;

-- Avulsa e cancelada sem contrato: aceitas.
insert into public.notas_fiscais (tipo, status, cliente_id, data_emissao, competencia, descricao, valor_servico) values
  ('avulsa', 'emitida', '00000000-0000-0000-0000-00000000c0a2', pg_temp.mes(0), pg_temp.mes(0), 'Serviço avulso [teste]', 300),
  ('contrato', 'cancelada', '00000000-0000-0000-0000-00000000c0a2', pg_temp.mes(0), pg_temp.mes(0), 'Cancelada [teste]', 300);

-- Vendedor não enxerga notas (são do financeiro).
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.notas_fiscais) = 0, 'Vendedor não deveria ver notas fiscais';
end $$;
reset role;

select 'notas_fiscais: ok' as resultado;

rollback;
