-- =============================================================================
-- Certificados de contrato de antes do sistema (planilha) → aviso ao ADM 14 dias antes.
--  1. Vence em até 14 dias (ou já venceu) → avisa; mais longe → não avisa.
--  2. Sem cliente ligado também avisa (o ADM resolve à mão).
--  3. Ligado a cliente: emitir no sistema o certificado seguinte resolve o aviso.
--  4. Rodar de novo não duplica.
-- Transação desfeita no final.
-- =============================================================================

begin;

insert into public.clientes (id, tipo_pessoa, nome) values
  ('00000000-0000-0000-0000-00000000ca01', 'PJ', 'Mercado [anteriores]');
insert into public.contratos (id, cliente_id, descricao, valor_mensal, data_inicio)
values ('00000000-0000-0000-0000-0000000ca001', '00000000-0000-0000-0000-00000000ca01',
        'CICR semestral [anteriores]', 500, privado.hoje() - 200);

insert into public.certificados_anteriores (id, nome, servico, validade, cliente_id, tipo_servico_id)
select v.id::uuid, v.nome, 'CICR', privado.hoje() + v.dias, v.cliente::uuid, t.id
  from (values
    ('00000000-0000-0000-0000-0000000aa001', 'Mercado Centro', 10, '00000000-0000-0000-0000-00000000ca01'),
    ('00000000-0000-0000-0000-0000000aa002', 'Veículo ABC1D23', -3, null),
    ('00000000-0000-0000-0000-0000000aa003', 'Mercado Longe', 40, '00000000-0000-0000-0000-00000000ca01')
  ) v(id, nome, dias, cliente)
  cross join public.tipos_servico t where t.nome = 'Controle de pragas';

select privado.gerar_avisos_certificados();
select privado.gerar_avisos_certificados();

do $$ begin
  assert (select count(*) from public.avisos where certificado_anterior_id = '00000000-0000-0000-0000-0000000aa001'
          and papel_destino = 'administrativo' and resolvido_em is null) = 1,
    'Vence em 10 dias: um aviso para o ADM (sem duplicar)';
  assert (select count(*) from public.avisos where certificado_anterior_id = '00000000-0000-0000-0000-0000000aa002'
          and titulo like '%vencido%') = 1,
    'Já vencido e sem cliente ligado: avisa como vencido';
  assert not exists (select 1 from public.avisos where certificado_anterior_id = '00000000-0000-0000-0000-0000000aa003'),
    'Vence em 40 dias: ainda não avisa';
end $$;

-- Emitiu o novo certificado do cliente no sistema: o aviso some.
insert into public.certificados (numero, cliente_id, tipo_servico_id, titulo, servico_descrito,
  data_execucao, tipo_validade, validade_meses, validade)
select '', '00000000-0000-0000-0000-00000000ca01', t.id, 'CONTROLE DE PRAGAS', 'CICR',
       privado.hoje(), 'contrato', 6, privado.hoje() + 180
  from public.tipos_servico t where t.nome = 'Controle de pragas';

do $$ begin
  assert (select count(*) from public.avisos where certificado_anterior_id = '00000000-0000-0000-0000-0000000aa001'
          and resolvido_em is null) = 0,
    'Novo certificado emitido: aviso do anterior resolvido';
  assert (select count(*) from public.avisos where certificado_anterior_id = '00000000-0000-0000-0000-0000000aa002'
          and resolvido_em is null) = 1,
    'O sem cliente continua aberto';
end $$;

select 'certificados_anteriores: ok' as resultado;

rollback;
