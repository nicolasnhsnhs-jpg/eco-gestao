-- =============================================================================
-- Auditoria: registro de quem criou, alterou ou apagou informações importantes
-- =============================================================================

create table public.auditoria (
  id           bigint generated always as identity primary key,
  tabela       text not null,
  registro_id  uuid,
  -- Cliente relacionado, para mostrar o histórico completo na ficha do cliente.
  cliente_id   uuid,
  acao         text not null check (acao in ('insert', 'update', 'delete')),
  dados_antes  jsonb,
  dados_depois jsonb,
  -- Sem chave estrangeira de propósito: o histórico nunca pode ser apagado junto.
  usuario_id   uuid,
  em           timestamptz not null default now()
);

create index auditoria_registro_idx on public.auditoria (tabela, registro_id, em desc);
create index auditoria_cliente_idx on public.auditoria (cliente_id, em desc);

comment on table public.auditoria is
  'Histórico de alterações. Só recebe dados pela função de auditoria; ninguém edita nem apaga.';

-- Uma única função serve para todas as tabelas auditadas.
create function privado.registrar_auditoria()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_antes   jsonb;
  v_depois  jsonb;
  v_linha   jsonb;
  v_cliente uuid;
begin
  -- Campos técnicos que não interessam no histórico.
  if tg_op <> 'INSERT' then
    v_antes := to_jsonb(old) - 'busca_texto';
  end if;
  if tg_op <> 'DELETE' then
    v_depois := to_jsonb(new) - 'busca_texto';
  end if;

  -- Atualização que não mudou nada além do carimbo: não registra.
  if tg_op = 'UPDATE'
     and (v_antes - 'atualizado_em' - 'atualizado_por')
       = (v_depois - 'atualizado_em' - 'atualizado_por') then
    return new;
  end if;

  v_linha := coalesce(v_depois, v_antes);
  v_cliente := case
    when tg_table_name = 'clientes' then (v_linha ->> 'id')::uuid
    else (v_linha ->> 'cliente_id')::uuid
  end;

  insert into public.auditoria (tabela, registro_id, cliente_id, acao, dados_antes, dados_depois, usuario_id)
  values (tg_table_name, (v_linha ->> 'id')::uuid, v_cliente, lower(tg_op), v_antes, v_depois, auth.uid());

  return coalesce(new, old);
end
$$;

revoke execute on function privado.registrar_auditoria() from public, authenticated;

create trigger auditoria
  after insert or update or delete on public.perfis
  for each row execute function privado.registrar_auditoria();

alter table public.auditoria enable row level security;

create policy "admin e financeiro consultam a auditoria"
  on public.auditoria for select to authenticated
  using (privado.tem_acesso_total());

revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;

grant all on public.auditoria to service_role;
