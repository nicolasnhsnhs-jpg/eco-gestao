-- =============================================================================
-- OS: "Serviço não realizado".
--
-- O técnico chega e não dá para fazer o serviço (ninguém para acompanhar, empresa
-- em auditoria…). Ele marca "Serviço não realizado", escreve o motivo e conclui:
-- nada do formulário é obrigatório e a OS fica CANCELADA, com o motivo registrado
-- (o escritório vê e reagenda). Não registra serviço realizado.
--
-- concluir_os é igual ao de 20261220120000_os_treinamento.sql, mais o desvio.
-- Mesma regra no celular: src/features/os/operador/ExecucaoPage.tsx (finalizar).
-- =============================================================================

alter table public.os_execucao
  add column nao_realizado        boolean not null default false,
  add column motivo_nao_realizado text;

grant update (nao_realizado, motivo_nao_realizado) on public.os_execucao to authenticated;

create or replace function privado.concluir_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_os      public.ordens_servico;
  v_exec    public.os_execucao;
  v_falta   text[];
  v_servico uuid;
  v_nomes   text;
begin
  if not (privado.os_e_minha(p_os) or privado.e_admin()) then
    raise exception 'Esta OS não está atribuída a você.' using errcode = '42501';
  end if;
  select * into v_os from public.ordens_servico where id = p_os for update;
  -- Já concluída por este operador: a resposta da 1ª tentativa se perdeu no sinal
  -- fraco e a fila mandou de novo. Não é erro.
  if v_os.status in ('concluida', 'conferida') and v_os.concluida_por = auth.uid() then
    return;
  end if;
  if v_os.status = 'cancelada' and v_os.cancelada_por = auth.uid() then
    return;
  end if;
  if v_os.status not in ('agendada', 'em_execucao') then
    raise exception 'Esta OS não está aberta.' using errcode = '23514';
  end if;

  select * into v_exec from public.os_execucao where os_id = p_os;

  -- Serviço não realizado: só o motivo é obrigatório e a OS fica cancelada.
  if v_exec.nao_realizado then
    if char_length(trim(coalesce(v_exec.motivo_nao_realizado, ''))) < 5 then
      raise exception 'Falta preencher: motivo do serviço não realizado.' using errcode = '23514';
    end if;
    perform set_config('app.os_transicao', 'sim', true);
    update public.ordens_servico
       set status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(),
           motivo_cancelamento = 'Serviço não realizado: ' || trim(v_exec.motivo_nao_realizado)
     where id = p_os;
    perform set_config('app.os_transicao', '', true);
    return;
  end if;

  v_falta := privado.pendencias_os(p_os);
  if cardinality(v_falta) > 0 then
    raise exception 'Falta preencher: %.', array_to_string(v_falta, ', ') using errcode = '23514';
  end if;

  if v_os.treinamento then
    v_servico := null;
  else
    select string_agg(p.nome, ', ' order by p.nome) into v_nomes
      from public.os_operadores o join public.perfis p on p.id = o.operador_id
     where o.os_id = p_os;

    if v_os.servico_id is null then
      insert into public.servicos
        (cliente_id, endereco_id, tipo_servico_id, data_execucao, status, tecnicos, observacoes)
      values
        (v_os.cliente_id, v_os.endereco_id, v_os.tipo_servico_id, v_exec.data, 'realizado',
         v_nomes, 'Registrado pela ' || v_os.numero)
      returning id into v_servico;
    else
      v_servico := v_os.servico_id;
      update public.servicos
         set data_execucao = v_exec.data, status = 'realizado', tecnicos = v_nomes
       where id = v_servico;
    end if;
  end if;

  perform set_config('app.os_transicao', 'sim', true);
  update public.ordens_servico
     set status = 'concluida', concluida_em = now(), concluida_por = auth.uid(),
         servico_id = v_servico
   where id = p_os;
  perform set_config('app.os_transicao', '', true);
end
$$;
