-- =============================================================================
-- Cliente com mais de um e-mail e mais de um telefone.
--
-- O primeiro de cada continua em "email" e "telefone" (é o que NFS-e, boleto e
-- busca já usam). Os demais ficam nas listas "emails_extras" e
-- "telefones_extras". O envio da nota manda para todos os e-mails.
-- =============================================================================

create function privado.emails_validos(lista text[])
returns boolean
language sql immutable
set search_path = ''
as $$
  select coalesce(bool_and(e ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'), true) from unnest(lista) e
$$;

create function privado.telefones_validos(lista text[])
returns boolean
language sql immutable
set search_path = ''
as $$
  select coalesce(bool_and(t ~ '^\d{10,11}$'), true) from unnest(lista) t
$$;

alter table public.clientes
  add column emails_extras    text[] not null default '{}'
    constraint emails_extras_validos check (privado.emails_validos(emails_extras)),
  add column telefones_extras text[] not null default '{}'
    constraint telefones_extras_validos check (privado.telefones_validos(telefones_extras));

-- A busca também acha o cliente pelos telefones extras.
create or replace function privado.antes_salvar_cliente()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- Vendedor responsável precisa ser um usuário ativo que não seja da recepção nem do ADM.
  if new.vendedor_responsavel_id is not null
     and (tg_op = 'INSERT' or new.vendedor_responsavel_id is distinct from old.vendedor_responsavel_id)
     and not exists (
       select 1 from public.perfis p
       where p.id = new.vendedor_responsavel_id and p.ativo
         and p.papel not in ('recepcao', 'administrativo')
     ) then
    raise exception 'O vendedor responsável precisa ser um usuário ativo da equipe comercial.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    -- Troca de vendedor: só o admin. Exceção: definir o primeiro vendedor de um
    -- cliente que ainda não tem (recepção, ADM e financeiro também podem).
    if new.vendedor_responsavel_id is distinct from old.vendedor_responsavel_id then
      if not (
        privado.e_admin()
        or (old.vendedor_responsavel_id is null
            and (privado.tem_acesso_gestao() or privado.meu_papel() = 'recepcao'))
      ) then
        raise exception 'Somente o administrador pode trocar o vendedor responsável.'
          using errcode = '42501';
      end if;

      insert into public.transferencias_cliente
        (cliente_id, vendedor_anterior_id, vendedor_novo_id, motivo, feito_por)
      values (
        new.id, old.vendedor_responsavel_id, new.vendedor_responsavel_id,
        nullif(current_setting('app.motivo_transferencia', true), ''), auth.uid()
      );
    end if;

    if new.anonimizado_em is distinct from old.anonimizado_em
       and current_setting('app.anonimizando', true) is distinct from 'sim' then
      raise exception 'Use a função de anonimização.' using errcode = '42501';
    end if;
  end if;

  new.busca_texto := privado.sem_acento(
    concat_ws(' ', new.nome, new.nome_fantasia, new.cpf_cnpj, new.telefone, new.whatsapp,
              array_to_string(new.telefones_extras, ' '))
  );
  return new;
end
$$;

-- Anonimização (LGPD) também apaga os e-mails e telefones extras.
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
