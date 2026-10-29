-- =============================================================================
-- Fase 6: o que a recepção vê dos serviços
--   - histórico de serviços do cliente SEM valores (para responder "quando foi a
--     última limpeza?" ao telefone);
--   - os vencimentos (datas, sem dinheiro).
-- =============================================================================

-- Vencimentos não têm valores: a recepção também vê.
drop policy "ver vencimentos" on public.vencimentos_servico;
create policy "ver vencimentos" on public.vencimentos_servico for select to authenticated
  using (privado.pode_ver_servico_linha(cliente_id) or privado.meu_papel() = 'recepcao');

-- Histórico de serviços sem valor. A parte privilegiada (ler a tabela de serviços,
-- que a recepção não acessa) fica no esquema privado, fora da API; ela só devolve
-- colunas sem dinheiro.
create function privado.servicos_sem_valor(p_cliente uuid)
returns table (
  id                 uuid,
  data_execucao      date,
  status             public.status_servico,
  tipo_servico       text,
  endereco           text,
  numero_certificado text,
  vendedor           text
)
language sql stable security definer
set search_path = ''
as $$
  select s.id, s.data_execucao, s.status, t.nome,
         coalesce(e.apelido, e.logradouro || coalesce(', ' || e.numero, '')),
         s.numero_certificado, p.nome
    from public.servicos s
    join public.tipos_servico t on t.id = s.tipo_servico_id
    left join public.enderecos e on e.id = s.endereco_id
    left join public.perfis p on p.id = s.vendedor_id
   where s.cliente_id = p_cliente
   order by s.data_execucao desc
   limit 100
$$;

revoke execute on function privado.servicos_sem_valor(uuid) from public;
grant execute on function privado.servicos_sem_valor(uuid) to authenticated;

-- Função pública: roda com a permissão de quem chama. Só devolve algo se a
-- pessoa enxerga o cliente (a regra de RLS de clientes vale aqui).
create function public.servicos_do_cliente_sem_valor(cliente uuid)
returns table (
  id                 uuid,
  data_execucao      date,
  status             public.status_servico,
  tipo_servico       text,
  endereco           text,
  numero_certificado text,
  vendedor           text
)
language plpgsql stable security invoker
set search_path = ''
as $$
begin
  if not privado.pode_ver_cliente(cliente) then
    return;
  end if;
  return query select * from privado.servicos_sem_valor(cliente);
end
$$;

revoke execute on function public.servicos_do_cliente_sem_valor(uuid) from public, anon;
grant execute on function public.servicos_do_cliente_sem_valor(uuid) to authenticated;
