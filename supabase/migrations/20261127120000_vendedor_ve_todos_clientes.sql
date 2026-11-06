-- =============================================================================
-- Vendedor passa a ver TODOS os clientes (só para consulta).
--
-- Antes de prospectar alguém, o vendedor pesquisa se o cliente já existe e quem
-- já atende. Por isso ele enxerga o cadastro de qualquer cliente: dados,
-- endereços, contatos e o vendedor responsável.
--
-- O que NÃO muda:
--   - Ele só altera (e cadastra para si) os clientes da própria carteira.
--   - Propostas: continua vendo só as dele (e as dos clientes da carteira dele).
--   - Serviços, contratos, vencimentos, OS, atendimentos, arquivos e
--     certificados continuam só dos clientes da carteira dele.
--
-- Como: até aqui pode_ver_cliente(cliente) dependia da regra de leitura da
-- tabela clientes. Como essa regra abre agora, pode_ver_cliente passa a checar
-- a carteira explicitamente (pode_ver_cliente_linha), e assim todas as regras
-- que já usam pode_ver_cliente continuam iguais.
-- =============================================================================

-- "Este cliente é da minha carteira?" (admin/financeiro/ADM e recepção: todos;
-- vendedor: só os dele). É o que vale para tudo além do cadastro.
create or replace function privado.pode_ver_cliente(cliente uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1 from public.clientes c
     where c.id = cliente
       and privado.pode_ver_cliente_linha(c.vendedor_responsavel_id)
  )
$$;

-- "Posso consultar o cadastro deste cliente?" Segue a regra de leitura de clientes.
create function privado.pode_consultar_cliente(cliente uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from public.clientes c where c.id = cliente)
$$;

grant execute on function privado.pode_consultar_cliente(uuid) to authenticated;

drop policy "ver clientes" on public.clientes;
create policy "ver clientes" on public.clientes for select to authenticated
  using (
    privado.pode_ver_cliente_linha(vendedor_responsavel_id)
    or coalesce(privado.meu_papel() = 'vendedor', false)
  );

drop policy "ver endereços" on public.enderecos;
create policy "ver endereços" on public.enderecos for select to authenticated
  using (privado.pode_consultar_cliente(cliente_id));

drop policy "ver contatos" on public.contatos_cliente;
create policy "ver contatos" on public.contatos_cliente for select to authenticated
  using (privado.pode_consultar_cliente(cliente_id));
