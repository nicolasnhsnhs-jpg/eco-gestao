-- =============================================================================
-- Permissão "atribuir vendedor": um usuário marcado (ex.: um vendedor de
-- confiança) pode definir o vendedor responsável de clientes que ainda NÃO têm
-- vendedor. Trocar o vendedor de quem já tem continua sendo só do admin.
--
-- A marca fica em perfis.pode_atribuir_vendedor e só o admin altera (regra
-- "só o admin altera perfis").
-- =============================================================================

alter table public.perfis
  add column pode_atribuir_vendedor boolean not null default false;

grant update (pode_atribuir_vendedor) on public.perfis to authenticated;

create function privado.pode_atribuir_vendedor()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(
    (select p.pode_atribuir_vendedor from public.perfis p
      where p.id = (select auth.uid()) and p.ativo),
    false)
$$;

grant execute on function privado.pode_atribuir_vendedor() to authenticated;

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
    -- cliente que ainda não tem (recepção, ADM, financeiro e quem tem a
    -- permissão "atribuir vendedor" também podem).
    if new.vendedor_responsavel_id is distinct from old.vendedor_responsavel_id then
      if not (
        privado.e_admin()
        or (old.vendedor_responsavel_id is null
            and (privado.tem_acesso_gestao()
                 or privado.meu_papel() = 'recepcao'
                 or privado.pode_atribuir_vendedor()))
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

-- transferir_cliente passa a aceitar também quem pode atribuir vendedor, mas só
-- para cliente sem vendedor. "security definer" porque o vendedor não tem
-- permissão (RLS) de alterar um cliente fora da carteira dele; a checagem fica aqui.
create or replace function public.transferir_cliente(cliente uuid, novo_vendedor uuid, motivo text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_atual uuid;
begin
  select c.vendedor_responsavel_id into v_atual from public.clientes c where c.id = cliente;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;

  if not (privado.e_admin() or (v_atual is null and privado.pode_atribuir_vendedor())) then
    raise exception 'Somente o administrador pode transferir clientes.' using errcode = '42501';
  end if;

  perform set_config('app.motivo_transferencia', coalesce(motivo, ''), true);
  update public.clientes set vendedor_responsavel_id = novo_vendedor where id = cliente;
end
$$;

revoke execute on function public.transferir_cliente(uuid, uuid, text) from public, anon;
grant execute on function public.transferir_cliente(uuid, uuid, text) to authenticated;
