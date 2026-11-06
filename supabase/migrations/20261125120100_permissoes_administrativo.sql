-- =============================================================================
-- Permissões do perfil ADM ("administrativo").
--
-- O ADM vê e cuida de tudo o que não é dinheiro: clientes, propostas, contratos,
-- serviços e vencimentos, OS (inclusive as O.S de contrato), calculadora de
-- orçamentos, avisos e certificados.
-- NÃO vê: financeiro (lançamentos, contas, cartões, investimentos, notas fiscais,
-- boletos, antecipações, comissões, configurações) nem a gestão de usuários.
--
-- Como funciona: até aqui "tem_acesso_total()" (admin + financeiro) servia para
-- as duas coisas. Agora existem duas funções:
--   tem_acesso_total()  → admin + financeiro: continua guardando o financeiro.
--   tem_acesso_gestao() → admin + financeiro + administrativo: cadastros e operação.
-- Só as regras que não são financeiras passam a usar a nova função.
-- =============================================================================

-- Admin, Financeiro e ADM cuidam de todos os cadastros e da operação.
create function privado.tem_acesso_gestao()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(privado.meu_papel() in ('admin', 'financeiro', 'administrativo'), false)
$$;

revoke execute on function privado.tem_acesso_gestao() from public;
grant execute on function privado.tem_acesso_gestao() to authenticated;

-- -----------------------------------------------------------------------------
-- Clientes, propostas, serviços/contratos/vencimentos e OS
-- -----------------------------------------------------------------------------

create or replace function privado.pode_ver_cliente_linha(vendedor_responsavel_id uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select privado.tem_acesso_gestao()
      or privado.meu_papel() = 'recepcao'
      or (privado.meu_papel() = 'vendedor' and vendedor_responsavel_id = (select auth.uid()))
$$;

create or replace function privado.pode_ver_proposta_linha(vendedor_id uuid, cliente_id uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select privado.tem_acesso_gestao()
      or (privado.meu_papel() = 'vendedor'
          and (vendedor_id = (select auth.uid()) or privado.pode_ver_cliente(cliente_id)))
$$;

-- Vale para serviços, contratos e vencimentos.
create or replace function privado.pode_ver_servico_linha(cliente_id uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select privado.tem_acesso_gestao()
      or (privado.meu_papel() = 'vendedor' and privado.pode_ver_cliente(cliente_id))
$$;

-- Quem agenda e acompanha as OS no escritório.
create or replace function privado.pode_gerir_os()
returns boolean
language sql stable
set search_path = ''
as $$
  select privado.tem_acesso_gestao() or coalesce(privado.meu_papel() = 'recepcao', false)
$$;

drop policy "cadastrar propostas" on public.propostas;
create policy "cadastrar propostas" on public.propostas for insert to authenticated
  with check (
    privado.tem_acesso_gestao()
    or (privado.meu_papel() = 'vendedor' and vendedor_id = (select auth.uid())
        and privado.pode_ver_cliente(cliente_id))
  );

drop policy "alterar atendimentos" on public.atendimentos;
create policy "alterar atendimentos" on public.atendimentos for update to authenticated
  using (usuario_id = (select auth.uid()) or privado.tem_acesso_gestao())
  with check (privado.pode_ver_cliente(cliente_id));

drop policy "apagar atendimentos" on public.atendimentos;
create policy "apagar atendimentos" on public.atendimentos for delete to authenticated
  using (usuario_id = (select auth.uid()) or privado.tem_acesso_gestao());

drop policy "admin e financeiro veem transferências" on public.transferencias_cliente;
create policy "gestão vê transferências" on public.transferencias_cliente for select to authenticated
  using (privado.tem_acesso_gestao());

-- Arquivos: quem cuida dos cadastros pode apagar arquivos enviados por outra pessoa.
-- (Arquivo de lançamento continua só do financeiro: pode_ver_arquivo cuida disso.)
drop policy "apagar arquivos" on public.arquivos;
create policy "apagar arquivos" on public.arquivos for delete to authenticated
  using (
    privado.pode_ver_arquivo(cliente_id, proposta_id, lancamento_id)
    and privado.pode_ver_arquivo_servico(servico_id)
    and (enviado_por = (select auth.uid()) or privado.tem_acesso_gestao())
  );

drop policy "apagar arquivos do sistema" on storage.objects;
create policy "apagar arquivos do sistema" on storage.objects for delete to authenticated
  using (
    bucket_id = 'arquivos'
    and (owner_id = (select auth.uid())::text or privado.tem_acesso_gestao())
    and privado.pode_ver_cliente(privado.cliente_do_caminho(name))
  );

-- Tipos de serviço e veículos (cadastros da operação).
drop policy "acesso total cadastra tipos" on public.tipos_servico;
create policy "gestão cadastra tipos" on public.tipos_servico for insert to authenticated
  with check (privado.tem_acesso_gestao());
drop policy "acesso total altera tipos" on public.tipos_servico;
create policy "gestão altera tipos" on public.tipos_servico for update to authenticated
  using (privado.tem_acesso_gestao()) with check (privado.tem_acesso_gestao());

drop policy "acesso total cadastra veículos" on public.veiculos;
create policy "gestão cadastra veículos" on public.veiculos for insert to authenticated
  with check (privado.tem_acesso_gestao());
drop policy "acesso total altera veículos" on public.veiculos;
create policy "gestão altera veículos" on public.veiculos for update to authenticated
  using (privado.tem_acesso_gestao()) with check (privado.tem_acesso_gestao());

-- Calculadora de orçamentos: o ADM usa (lê os custos), mas só o admin altera.
drop policy "admin e vendedor veem custos" on public.custos_orcamento;
create policy "quem orça vê custos" on public.custos_orcamento for select to authenticated
  using (coalesce(privado.meu_papel() in ('admin', 'vendedor', 'administrativo'), false));

-- -----------------------------------------------------------------------------
-- Cliente: o ADM pode definir o primeiro vendedor (como recepção e financeiro),
-- mas ele mesmo não pode ser o vendedor responsável (não é da equipe comercial).
-- -----------------------------------------------------------------------------
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
    concat_ws(' ', new.nome, new.nome_fantasia, new.cpf_cnpj, new.telefone, new.whatsapp)
  );
  return new;
end
$$;

-- -----------------------------------------------------------------------------
-- Avisos: o ADM recebe os avisos do próprio perfil e os que vão para o
-- administrador (hoje: serviço vencendo de cliente sem vendedor). Os avisos do
-- financeiro (notas, comissões, contas) continuam só com admin e financeiro.
-- -----------------------------------------------------------------------------
create or replace function privado.aviso_e_meu(destinatario_id uuid, papel_destino public.papel)
returns boolean
language sql stable
set search_path = ''
as $$
  select destinatario_id = (select auth.uid())
      or papel_destino = privado.meu_papel()
      or (papel_destino in ('admin', 'financeiro') and privado.tem_acesso_total())
      or (papel_destino = 'admin' and privado.meu_papel() = 'administrativo')
$$;
