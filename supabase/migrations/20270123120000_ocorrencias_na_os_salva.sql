-- =============================================================================
-- Ocorrências na O.S salva (modelo do local), antes de agendar a visita.
--
-- O ADM abre a O.S salva do cliente (cliente + endereço + serviço) e já escreve as
-- ocorrências ali. Elas ficam abertas para o local, e a próxima OS agendada (pelo
-- "Agendar visita", pela rota ou pela Nova OS) já nasce com elas — quem faz isso é
-- o gatilho privado.ocorrencias_na_os_nova (20270119120000_os_varias_ocorrencias.sql).
--
-- A lista que a tela manda é a das ocorrências abertas do local:
--   com id   → muda o texto;
--   sem id   → ocorrência nova do local (sem OS de origem); entra também nas OS
--              do local já agendadas e ainda não começadas;
--   fora da lista → a que nunca foi para nenhuma OS é apagada; a que já foi é dada
--              como sanada e sai das OS ainda não começadas (igual à OS).
-- Só o escritório (privado.pode_gerir_os).
-- =============================================================================

create or replace function privado.salvar_ocorrencias_local(p_modelo uuid, p_itens jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_mod    public.os_modelos;
  v_item   jsonb;
  v_texto  text;
  v_id     uuid;
  v_manter uuid[] := '{}';
begin
  if not privado.pode_gerir_os() then
    raise exception 'Somente o escritório muda as ocorrências.' using errcode = '42501';
  end if;
  select * into v_mod from public.os_modelos where id = p_modelo;
  if v_mod.id is null or not privado.pode_ver_cliente(v_mod.cliente_id) then
    raise exception 'O.S salva não encontrada.' using errcode = '23514';
  end if;
  if jsonb_typeof(coalesce(p_itens, '[]')) <> 'array' then
    raise exception 'Lista de ocorrências inválida.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]')) loop
    v_texto := nullif(trim(v_item ->> 'texto'), '');
    continue when v_texto is null;
    v_id := nullif(v_item ->> 'id', '')::uuid;
    if v_id is not null and exists (
      select 1 from public.ocorrencias o
       where o.id = v_id and o.sanada_em is null
         and o.cliente_id = v_mod.cliente_id
         and o.tipo_servico_id = v_mod.tipo_servico_id
         and o.endereco_id is not distinct from v_mod.endereco_id
    ) then
      update public.ocorrencias set texto = v_texto where id = v_id and texto <> v_texto;
    else
      insert into public.ocorrencias (cliente_id, endereco_id, tipo_servico_id, texto)
      values (v_mod.cliente_id, v_mod.endereco_id, v_mod.tipo_servico_id, v_texto)
      returning id into v_id;
      -- As OS do local já agendadas (e não começadas) também recebem.
      insert into public.os_ocorrencias (os_id, ocorrencia_id)
      select s.id, v_id
        from public.ordens_servico s
       where s.cliente_id = v_mod.cliente_id
         and s.tipo_servico_id = v_mod.tipo_servico_id
         and s.endereco_id is not distinct from v_mod.endereco_id
         and s.status in ('rascunho', 'agendada')
      on conflict do nothing;
    end if;
    v_manter := array_append(v_manter, v_id);
  end loop;

  -- As abertas do local que saíram da lista.
  for v_id in
    select o.id from public.ocorrencias o
     where o.sanada_em is null
       and o.cliente_id = v_mod.cliente_id
       and o.tipo_servico_id = v_mod.tipo_servico_id
       and o.endereco_id is not distinct from v_mod.endereco_id
       and not (o.id = any (v_manter))
  loop
    -- Só nas OS ainda não começadas e sem resposta: some delas.
    delete from public.os_ocorrencias l
     using public.ordens_servico s
     where l.ocorrencia_id = v_id and s.id = l.os_id and s.status in ('rascunho', 'agendada')
       and not privado.ocorrencia_respondida(l.os_id, v_id);
    if not exists (select 1 from public.os_ocorrencias l where l.ocorrencia_id = v_id) then
      delete from public.ocorrencias where id = v_id;
    else
      update public.ocorrencias set sanada_em = now() where id = v_id;
    end if;
  end loop;
end
$$;

revoke execute on function privado.salvar_ocorrencias_local(uuid, jsonb) from public;
grant execute on function privado.salvar_ocorrencias_local(uuid, jsonb) to authenticated;

create function public.salvar_ocorrencias_local(modelo uuid, itens jsonb)
returns void
language sql security invoker
set search_path = ''
as $$
  select privado.salvar_ocorrencias_local(modelo, itens)
$$;

revoke execute on function public.salvar_ocorrencias_local(uuid, jsonb) from public, anon;
grant execute on function public.salvar_ocorrencias_local(uuid, jsonb) to authenticated;
