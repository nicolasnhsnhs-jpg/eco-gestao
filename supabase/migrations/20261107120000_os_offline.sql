-- =============================================================================
-- Ordens de Serviço (OS-5): envio sem internet
--
-- O celular do operador guarda tudo e envia por uma fila quando pega sinal. Com
-- sinal fraco, uma resposta pode se perder e a fila manda de novo: aqui a
-- conclusão repetida pelo mesmo operador passa a ser aceita sem erro.
-- (Produtos, insetos e arquivos já são enviados com "ignorar se já existe".)
-- =============================================================================

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
  if v_os.status not in ('agendada', 'em_execucao') then
    raise exception 'Esta OS não está aberta.' using errcode = '23514';
  end if;

  v_falta := privado.pendencias_os(p_os);
  if cardinality(v_falta) > 0 then
    raise exception 'Falta preencher: %.', array_to_string(v_falta, ', ') using errcode = '23514';
  end if;

  select * into v_exec from public.os_execucao where os_id = p_os;
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

  perform set_config('app.os_transicao', 'sim', true);
  update public.ordens_servico
     set status = 'concluida', concluida_em = now(), concluida_por = auth.uid(),
         servico_id = v_servico
   where id = p_os;
  perform set_config('app.os_transicao', '', true);
end
$$;

