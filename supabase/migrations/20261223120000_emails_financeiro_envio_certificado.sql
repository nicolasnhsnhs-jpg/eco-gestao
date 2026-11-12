-- =============================================================================
-- E-mails do financeiro separados e envio do certificado ao cliente.
--
-- Alguns clientes recebem a nota e o boleto num e-mail e o certificado e a OS em
-- outro (e não querem que um caia no outro). Com "emails_financeiro" preenchido:
--   - nota, boleto e o e-mail que vai na NFS-e usam SÓ essa lista;
--   - certificado e OS usam SÓ o e-mail principal e os extras.
-- Vazio (o padrão), tudo vai para o e-mail principal e os extras, como antes.
--
-- O certificado guarda quando, para quem e com quais OS foi enviado (pelo adm@).
-- =============================================================================

alter table public.clientes
  add column emails_financeiro text[] not null default '{}'
    constraint emails_financeiro_validos check (privado.emails_validos(emails_financeiro));

comment on column public.clientes.emails_financeiro is
  'Preenchido: nota e boleto vão só para estes e-mails; certificado e OS, só para email/emails_extras.';

-- Para onde vai a nota: o e-mail do financeiro, se separado; senão o do cliente ou,
-- sem ele, o do contato principal.
create or replace function privado.email_do_cliente(p_cliente_id uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when cardinality(c.emails_financeiro) > 0 then c.emails_financeiro[1]
    else coalesce(
      nullif(trim(c.email), ''),
      (select nullif(trim(k.email), '') from public.contatos_cliente k
        where k.cliente_id = c.id and nullif(trim(k.email), '') is not null
        order by k.principal desc, k.criado_em limit 1))
  end
  from public.clientes c where c.id = p_cliente_id
$$;

-- Anonimização (LGPD) também apaga os e-mails do financeiro.
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
         emails_extras = '{}',
         emails_financeiro = '{}',
         telefone = null,
         telefones_extras = '{}',
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

-- Envio do certificado (e das OS) ao cliente. Só a função "documentos" grava aqui.
alter table public.certificados
  add column enviado_em      timestamptz,
  add column enviado_para    text,
  add column enviado_por     uuid references public.perfis (id) on delete set null,
  -- Números das OS que foram juntas no e-mail (ex.: "OS-2026-0012, OS-2026-0013").
  add column enviado_com_os  text,
  add column erro_envio      text;
