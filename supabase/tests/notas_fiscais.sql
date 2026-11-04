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

-- =============================================================================
-- Rascunhos do mês e envio pendente
-- =============================================================================

do $$ begin
  assert privado.descricao_proximo_mes(
           'MÊS REFERÊNCIA NOVEMBRO/2026 - VENCIMENTO EM 10/12/2026 - IMPLANTADO EM 01/03/2025',
           '2026-11-01', '2026-12-01', '2026-12-10', '2027-01-10')
         = 'MÊS REFERÊNCIA DEZEMBRO/2026 - VENCIMENTO EM 10/01/2027 - IMPLANTADO EM 01/03/2025',
    'A descrição deveria avançar mês e vencimento, sem mexer na implantação';
end $$;

-- A nota do mês 0 tem impostos; o rascunho do mês 1 copia com o valor novo (600).
update public.notas_fiscais
   set vencimento = pg_temp.mes(1) + 14, valor_pis = 3.25, pis_cofins_retidos = true,
       descricao = 'Controle de pragas - vencimento em ' || to_char(pg_temp.mes(1) + 14, 'DD/MM/YYYY')
 where id = '00000000-0000-0000-0000-00000000f001';

-- (Conta só o contrato do teste: o banco de desenvolvimento pode ter outros.)
select privado.gerar_rascunhos_notas(pg_temp.mes(1));
select privado.gerar_rascunhos_notas(pg_temp.mes(1));
do $$ begin
  assert (select count(*) from public.notas_fiscais
           where contrato_id = '00000000-0000-0000-0000-0000000c0a01' and status = 'rascunho') = 1,
    'Deveria montar um rascunho, e rodar de novo não duplica';
end $$;

do $$
declare
  r public.notas_fiscais;
  v_lanc public.lancamentos;
begin
  select * into r from public.notas_fiscais
   where contrato_id = '00000000-0000-0000-0000-0000000c0a01' and status = 'rascunho';
  select * into v_lanc from public.lancamentos
   where contrato_id = '00000000-0000-0000-0000-0000000c0a01' and competencia = pg_temp.mes(1);
  assert r.competencia = pg_temp.mes(1), 'Rascunho no mês seguinte';
  assert r.lancamento_id = v_lanc.id, 'Ligado à mensalidade do mês';
  assert r.valor_servico = 600 and r.valor_pis = 3.90, 'Valor novo e PIS na mesma proporção';
  assert r.vencimento = v_lanc.vencimento, 'Vencimento da mensalidade';
  assert r.descricao like '%' || to_char(v_lanc.vencimento, 'DD/MM/YYYY'), 'Data nova na descrição';
  assert exists (select 1 from public.avisos where chave_unica = 'rascunhos:' || to_char(pg_temp.mes(1), 'YYYY-MM')),
    'Aviso de notas para conferir';
  assert (select numero_nota_fiscal from public.lancamentos where id = v_lanc.id) is null,
    'Rascunho não marca número na conta a receber';
end $$;

-- Aditivo com rascunho aberto: o rascunho acompanha.
update public.contratos set valor_mensal = 700 where id = '00000000-0000-0000-0000-0000000c0a01';
do $$ begin
  assert (select valor_servico from public.notas_fiscais
           where contrato_id = '00000000-0000-0000-0000-0000000c0a01' and status = 'rascunho') = 700,
    'O rascunho deveria ir para o valor do aditivo';
end $$;

-- Nota emitida com PDF, cliente sem e-mail: aviso de envio pendente; enviada: resolvido.
insert into public.arquivos (id, caminho_storage, nome_original, categoria, cliente_id)
values ('00000000-0000-0000-0000-00000000a0f1',
        'clientes/00000000-0000-0000-0000-00000000c0a1/nf.pdf', 'nf.pdf', 'nota_fiscal',
        '00000000-0000-0000-0000-00000000c0a1');
update public.notas_fiscais set arquivo_pdf_id = '00000000-0000-0000-0000-00000000a0f1'
 where id = '00000000-0000-0000-0000-00000000f001';
do $$ begin
  assert exists (select 1 from public.avisos where chave_unica = 'envio_nota:00000000-0000-0000-0000-00000000f001'
                  and resolvido_em is null), 'Sem e-mail: aviso de envio pendente';
end $$;
update public.notas_fiscais set enviada_em = now() where id = '00000000-0000-0000-0000-00000000f001';
do $$ begin
  assert (select resolvido_em from public.avisos
           where chave_unica = 'envio_nota:00000000-0000-0000-0000-00000000f001') is not null,
    'Enviada à mão: aviso resolvido';
end $$;

-- Emissão pelo sistema: trava (ninguém manda a mesma nota duas vezes) e número da DPS.
do $$
declare
  v_id  uuid := (select id from public.notas_fiscais
                  where status = 'rascunho' and contrato_id = '00000000-0000-0000-0000-0000000c0a01');
  v_num text;
begin
  assert public.travar_emissao_nota(v_id), 'Primeira chamada pega a nota';
  assert not public.travar_emissao_nota(v_id), 'Segunda chamada, com a primeira emitindo, não pega';
  update public.notas_fiscais set emitindo_em = now() - interval '3 minutes' where id = v_id;
  assert public.travar_emissao_nota(v_id), 'Trava esquecida há mais de 2 min é liberada';
  assert not public.travar_emissao_nota('00000000-0000-0000-0000-00000000f001'),
    'Nota já emitida não é travada para emitir';

  select numero into v_num from public.reservar_numero_dps(v_id, 'homologacao', '2');
  assert v_num is not null, 'Ensaio recebe um número';
  assert (select numero_dps from public.notas_fiscais where id = v_id) is null,
    'Ensaio (homologação) não muda a nota';

  select numero into v_num from public.reservar_numero_dps(v_id, 'producao', '2');
  assert (select numero_dps from public.notas_fiscais where id = v_id) = v_num
     and (select serie_dps from public.notas_fiscais where id = v_id) = '2',
    'Produção grava série e número na nota';
  assert (select numero from public.reservar_numero_dps(v_id, 'producao', '2')) = v_num,
    'Nova tentativa usa o mesmo número (a Sefin não duplica a nota)';
end $$;

-- Só a função (chave secreta) mexe na numeração.
select pg_temp.como('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;
do $$ begin
  begin
    perform public.reservar_numero_dps('00000000-0000-0000-0000-00000000f001', 'producao', '2');
    assert false, 'Financeiro não deveria reservar número direto';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.nfse_numeracao;
    assert false, 'Financeiro não deveria ler a numeração';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Mudou o CEP sem mandar o código IBGE novo: o antigo é apagado.
insert into public.enderecos (id, cliente_id, cep, logradouro, cidade, uf, codigo_ibge) values
  ('00000000-0000-0000-0000-00000000e0a1', '00000000-0000-0000-0000-00000000c0a1', '93260000',
   'Rua Teste', 'Esteio', 'RS', '4307708');
update public.enderecos set cep = '90010000' where id = '00000000-0000-0000-0000-00000000e0a1';
do $$ begin
  assert (select codigo_ibge from public.enderecos where id = '00000000-0000-0000-0000-00000000e0a1') is null,
    'CEP novo sem código: o código antigo deveria sumir';
end $$;

-- Rascunho pode ser descartado; nota emitida não.
delete from public.notas_fiscais where status = 'rascunho' and contrato_id = '00000000-0000-0000-0000-0000000c0a01';

-- Vendedor não enxerga notas (são do financeiro).
select pg_temp.como('00000000-0000-0000-0000-0000000000b1');
set local role authenticated;
do $$ begin
  assert (select count(*) from public.notas_fiscais) = 0, 'Vendedor não deveria ver notas fiscais';
end $$;
reset role;

select 'notas_fiscais: ok' as resultado;

rollback;
