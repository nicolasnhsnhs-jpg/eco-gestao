-- =============================================================================
-- Anonimização (LGPD): a função chamada pela tela deixa de rodar com privilégio
-- elevado. Só a limpeza da auditoria precisa de privilégio, e ela passa para o
-- esquema "privado", que não é exposto pela API.
-- =============================================================================

create function privado.limpar_auditoria_cliente(cliente uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.e_admin() then
    raise exception 'Somente o administrador pode anonimizar clientes.' using errcode = '42501';
  end if;
  -- O histórico continua mostrando quem fez o quê e quando, mas sem os dados pessoais.
  update public.auditoria
     set dados_antes = case when dados_antes is null then null else '{"anonimizado": true}'::jsonb end,
         dados_depois = case when dados_depois is null then null else '{"anonimizado": true}'::jsonb end
   where cliente_id = cliente;
end
$$;

revoke execute on function privado.limpar_auditoria_cliente(uuid) from public;
grant execute on function privado.limpar_auditoria_cliente(uuid) to authenticated;

create or replace function public.anonimizar_cliente(cliente uuid)
returns void
language plpgsql security invoker
set search_path = ''
as $$
begin
  if not privado.e_admin() then
    raise exception 'Somente o administrador pode anonimizar clientes.' using errcode = '42501';
  end if;
  perform set_config('app.anonimizando', 'sim', true);

  update public.clientes
     set nome = 'Cliente anonimizado',
         nome_fantasia = null,
         cpf_cnpj = null,
         inscricao_estadual = null,
         email = null,
         telefone = null,
         whatsapp = null,
         observacoes = null,
         origem = null,
         ativo = false,
         anonimizado_em = now()
   where id = cliente and anonimizado_em is null;
  if not found then
    raise exception 'Cliente não encontrado ou já anonimizado.' using errcode = 'P0002';
  end if;

  delete from public.contatos_cliente where cliente_id = cliente;
  update public.enderecos
     set apelido = null, logradouro = 'Endereço removido', numero = null,
         complemento = null, cep = null, bairro = null
   where cliente_id = cliente;
  update public.atendimentos set resumo = 'Registro anonimizado' where cliente_id = cliente;

  perform privado.limpar_auditoria_cliente(cliente);
end
$$;
