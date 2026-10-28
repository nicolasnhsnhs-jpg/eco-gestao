-- =============================================================================
-- Avisos da Fase 4:
--   1. Serviço perto de vencer → para o vendedor responsável pelo cliente
--      (sem vendedor: para o administrador), X dias antes.
--   2. Serviço concluído com valor e sem conta a receber → para o financeiro.
-- =============================================================================

create function privado.gerar_avisos_servicos()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_hoje  date := privado.hoje();
  v_total integer := 0;
  v_n     integer;
begin
  -- 1. Vencimentos (um aviso por ciclo: a chave inclui a data do vencimento).
  insert into public.avisos
    (destinatario_id, papel_destino, tipo, titulo, mensagem, link, vencimento_id, chave_unica)
  select
    c.vendedor_responsavel_id,
    case when c.vendedor_responsavel_id is null then 'admin'::public.papel end,
    'servico_vencendo',
    case
      when t.tipo_vencimento = 'certificado' then 'Certificado vencendo: ' || t.nome
      else 'Hora de refazer: ' || t.nome
    end,
    concat_ws(' · ',
      coalesce(c.nome_fantasia, c.nome),
      e.apelido,
      case when v.proxima_data < v_hoje then 'venceu em ' else 'vence em ' end
        || to_char(v.proxima_data, 'DD/MM/YYYY')
    ),
    '/clientes/' || c.id,
    v.id,
    'vencimento:' || v.id || ':' || v.proxima_data
  from public.vencimentos_servico v
  join public.clientes c on c.id = v.cliente_id
  join public.tipos_servico t on t.id = v.tipo_servico_id
  left join public.enderecos e on e.id = v.endereco_id
  where v.ativo
    and c.ativo
    and v.proxima_data is not null
    and v.proxima_data - v.antecedencia_aviso_dias <= v_hoje
    -- Já tem o próximo serviço agendado? Então não precisa avisar.
    and not exists (
      select 1 from public.servicos s
       where s.cliente_id = v.cliente_id
         and s.endereco_id is not distinct from v.endereco_id
         and s.tipo_servico_id = v.tipo_servico_id
         and s.status = 'agendado'
         and s.data_execucao > v.data_ultimo_servico
    )
  on conflict (chave_unica) do nothing;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  -- 2. Serviços concluídos que ainda não viraram conta a receber.
  insert into public.avisos (papel_destino, tipo, titulo, mensagem, link, servico_id, chave_unica)
  select
    'financeiro',
    'servico_a_faturar',
    'Serviço concluído: lançar conta a receber',
    concat_ws(' · ', t.nome, coalesce(c.nome_fantasia, c.nome),
      'R$ ' || replace(replace(replace(to_char(s.valor, 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.'),
      'feito em ' || to_char(s.data_execucao, 'DD/MM/YYYY')),
    '/servicos/' || s.id,
    s.id,
    'faturar:' || s.id
  from public.servicos s
  join public.clientes c on c.id = s.cliente_id
  join public.tipos_servico t on t.id = s.tipo_servico_id
  where s.status = 'realizado'
    and coalesce(s.valor, 0) > 0
    and not exists (
      select 1 from public.lancamentos l where l.servico_id = s.id and l.status <> 'cancelado'
    )
  on conflict (chave_unica) do nothing;
  get diagnostics v_n = row_count;

  return v_total + v_n;
end
$$;

revoke execute on function privado.gerar_avisos_servicos() from public;
grant execute on function privado.gerar_avisos_servicos() to authenticated;

-- Resolução automática
create function privado.resolver_avisos_servicos()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'vencimentos_servico' then
    -- Novo serviço realizado (a data mudou) ou vencimento desativado: o aviso antigo sai.
    if new.data_ultimo_servico is distinct from old.data_ultimo_servico
       or new.periodicidade_meses is distinct from old.periodicidade_meses
       or not new.ativo then
      update public.avisos set resolvido_em = now()
       where vencimento_id = new.id and resolvido_em is null;
    end if;
  elsif tg_table_name = 'servicos' then
    -- Agendou o próximo serviço desse local: o aviso de vencimento sai.
    if new.status = 'agendado' then
      update public.avisos a set resolvido_em = now()
        from public.vencimentos_servico v
       where a.vencimento_id = v.id and a.resolvido_em is null
         and v.cliente_id = new.cliente_id
         and v.endereco_id is not distinct from new.endereco_id
         and v.tipo_servico_id = new.tipo_servico_id;
    end if;
    -- Deixou de ser "realizado com valor": não há mais o que faturar.
    if new.status <> 'realizado' or coalesce(new.valor, 0) = 0 then
      update public.avisos set resolvido_em = now()
       where servico_id = new.id and tipo = 'servico_a_faturar' and resolvido_em is null;
    end if;
  elsif tg_table_name = 'lancamentos' then
    if new.servico_id is not null and new.status <> 'cancelado' then
      update public.avisos set resolvido_em = now()
       where servico_id = new.servico_id and tipo = 'servico_a_faturar' and resolvido_em is null;
    end if;
  end if;
  return null;
end
$$;

revoke execute on function privado.resolver_avisos_servicos() from public, authenticated;

create trigger resolver_avisos after update on public.vencimentos_servico
  for each row execute function privado.resolver_avisos_servicos();
create trigger resolver_avisos after insert or update on public.servicos
  for each row execute function privado.resolver_avisos_servicos();
create trigger resolver_avisos_servico after insert or update on public.lancamentos
  for each row execute function privado.resolver_avisos_servicos();

create or replace function public.atualizar_avisos()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_total integer := 0;
begin
  if privado.meu_papel() is null then
    return 0;
  end if;
  if privado.tem_acesso_total() then
    v_total := privado.gerar_avisos_financeiro();
  end if;
  return v_total + privado.gerar_avisos_propostas() + privado.gerar_avisos_servicos();
end
$$;

select cron.schedule(
  'gerar-avisos-servicos',
  '10 9 * * *',
  $$select privado.gerar_avisos_servicos()$$
);
