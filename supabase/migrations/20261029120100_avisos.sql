-- =============================================================================
-- Central de avisos (cobranças, recebimentos do dia e, nas próximas fases,
-- serviços vencendo) e a tarefa diária que gera os avisos.
-- =============================================================================

create table public.avisos (
  id              uuid primary key default gen_random_uuid(),
  -- Para quem: uma pessoa específica OU um perfil inteiro (ex.: todo o financeiro).
  destinatario_id uuid references public.perfis (id),
  papel_destino   public.papel,
  tipo            text not null,
  titulo          text not null,
  mensagem        text,
  -- Endereço da tela que resolve o aviso (ex.: /financeiro/lancamentos/...).
  link            text,
  lancamento_id   uuid references public.lancamentos (id) on delete cascade,
  -- Impede o mesmo aviso de ser criado duas vezes.
  chave_unica     text not null unique,
  lido_em         timestamptz,
  resolvido_em    timestamptz,
  criado_em       timestamptz not null default now(),

  constraint destino_definido check ((destinatario_id is null) <> (papel_destino is null))
);

create index avisos_abertos_idx on public.avisos (criado_em desc) where resolvido_em is null;

alter table public.avisos enable row level security;

-- Avisos do perfil "financeiro" também aparecem para o administrador.
create function privado.aviso_e_meu(destinatario_id uuid, papel_destino public.papel)
returns boolean
language sql stable
set search_path = ''
as $$
  select destinatario_id = (select auth.uid())
      or papel_destino = privado.meu_papel()
      or (papel_destino in ('admin', 'financeiro') and privado.tem_acesso_total())
$$;

grant execute on function privado.aviso_e_meu(uuid, public.papel) to authenticated;

create policy "ver os próprios avisos" on public.avisos for select to authenticated
  using (privado.aviso_e_meu(destinatario_id, papel_destino));
create policy "marcar os próprios avisos" on public.avisos for update to authenticated
  using (privado.aviso_e_meu(destinatario_id, papel_destino))
  with check (privado.aviso_e_meu(destinatario_id, papel_destino));

revoke all on public.avisos from anon, authenticated;
grant select on public.avisos to authenticated;
-- Pela tela, só dá para marcar como lido ou resolvido.
grant update (lido_em, resolvido_em) on public.avisos to authenticated;
grant all on public.avisos to service_role;

-- -----------------------------------------------------------------------------
-- Geração dos avisos do financeiro
-- -----------------------------------------------------------------------------

create function privado.gerar_avisos_financeiro()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_hoje  date := privado.hoje();
  v_total integer;
begin
  -- O aviso de "vence hoje" de ontem é substituído pelo de "atrasado".
  update public.avisos a
     set resolvido_em = now()
    from public.lancamentos l
   where a.lancamento_id = l.id
     and a.chave_unica like 'hoje:%'
     and a.resolvido_em is null
     and l.vencimento < v_hoje;

  insert into public.avisos (papel_destino, tipo, titulo, mensagem, link, lancamento_id, chave_unica)
  select
    'financeiro',
    case
      when l.vencimento < v_hoje and l.tipo = 'entrada' then 'cobranca_atrasada'
      when l.vencimento < v_hoje then 'pagamento_atrasado'
      when l.tipo = 'entrada' then 'confirmar_recebimento'
      else 'confirmar_pagamento'
    end,
    case
      when l.vencimento < v_hoje and l.tipo = 'entrada' then 'Cobrança atrasada'
      when l.vencimento < v_hoje then 'Pagamento atrasado'
      when l.tipo = 'entrada' then 'Confirmar recebimento de hoje'
      else 'Pagamento vence hoje'
    end,
    concat_ws(' · ',
      l.descricao,
      coalesce(c.nome_fantasia, c.nome, f.nome),
      'R$ ' || replace(replace(replace(to_char(l.valor, 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.'),
      'venc. ' || to_char(l.vencimento, 'DD/MM/YYYY')
    ),
    '/financeiro/lancamentos/' || l.id,
    l.id,
    -- Um aviso para "vence hoje" e outro, se continuar em aberto, para "atrasado".
    case when l.vencimento < v_hoje then 'atrasado:' else 'hoje:' end || l.id
  from public.lancamentos l
  left join public.clientes c on c.id = l.cliente_id
  left join public.fornecedores f on f.id = l.fornecedor_id
  where l.status in ('pendente', 'agendado')
    and l.vencimento <= v_hoje
  on conflict (chave_unica) do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end
$$;

-- A tela do financeiro pode pedir para atualizar os avisos na hora (não precisa esperar a madrugada).
create function public.atualizar_avisos()
returns integer
language plpgsql
set search_path = ''
as $$
begin
  if not privado.tem_acesso_total() then
    return 0;
  end if;
  return privado.gerar_avisos_financeiro();
end
$$;

-- A função interna é "security definer" e fica no esquema privado (fora da API);
-- a pública só repassa a chamada para quem tem acesso total.
revoke execute on function privado.gerar_avisos_financeiro() from public;
grant execute on function privado.gerar_avisos_financeiro() to authenticated;
revoke execute on function public.atualizar_avisos() from public, anon;
grant execute on function public.atualizar_avisos() to authenticated;

-- Quando o lançamento é confirmado, cancelado ou tem o vencimento adiado,
-- os avisos dele são resolvidos sozinhos.
create function privado.resolver_avisos_lancamento()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status in ('realizado', 'cancelado') or new.vencimento > privado.hoje() then
    update public.avisos
       set resolvido_em = now()
     where lancamento_id = new.id and resolvido_em is null;
  end if;
  return new;
end
$$;

revoke execute on function privado.resolver_avisos_lancamento() from public, authenticated;

create trigger resolver_avisos after update on public.lancamentos
  for each row execute function privado.resolver_avisos_lancamento();

-- -----------------------------------------------------------------------------
-- Tarefa diária: todo dia às 6h (horário de Brasília = 9h UTC)
-- -----------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule(
  'gerar-avisos-financeiro',
  '0 9 * * *',
  $$select privado.gerar_avisos_financeiro()$$
);
