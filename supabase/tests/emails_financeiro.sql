-- =============================================================================
-- E-mails do financeiro separados: a nota vai só para eles; sem separar, como antes.
-- Transação desfeita no final (rollback): nada fica no banco.
-- =============================================================================

begin;

insert into public.clientes (id, tipo_pessoa, nome, email, emails_extras, emails_financeiro) values
  ('00000000-0000-0000-0000-00000000e0a1', 'PJ', 'Separado [teste]', 'qualidade@cliente.test',
   '{tecnico@cliente.test}', '{nf@cliente.test,contas@cliente.test}'),
  ('00000000-0000-0000-0000-00000000e0a2', 'PJ', 'Junto [teste]', 'geral@cliente.test', '{}', '{}'),
  ('00000000-0000-0000-0000-00000000e0a3', 'PJ', 'Só financeiro [teste]', null, '{}', '{nf@so.test}');

do $$ begin
  assert privado.email_do_cliente('00000000-0000-0000-0000-00000000e0a1') = 'nf@cliente.test',
    'Separado: a nota vai para o e-mail do financeiro, não para o principal';
  assert privado.email_do_cliente('00000000-0000-0000-0000-00000000e0a2') = 'geral@cliente.test',
    'Sem separar: continua no e-mail principal';
  assert privado.email_do_cliente('00000000-0000-0000-0000-00000000e0a3') = 'nf@so.test',
    'Só com o do financeiro: a nota tem para onde ir';
end $$;

-- E-mail inválido na lista do financeiro é recusado.
do $$ begin
  begin
    update public.clientes set emails_financeiro = '{nao-e-email}'
     where id = '00000000-0000-0000-0000-00000000e0a2';
    raise exception 'deveria ter recusado';
  exception when check_violation then null;
  end;
end $$;

select 'emails_financeiro: ok' as resultado;

rollback;
