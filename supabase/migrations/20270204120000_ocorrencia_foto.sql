-- =============================================================================
-- Foto na ocorrência (pedido de 26/11/2026).
--
-- O ADM anexa uma foto à ocorrência (na OS, na Nova OS ou na O.S salva) e o
-- técnico vê a foto junto da ocorrência na OS do celular.
--
-- A foto fica no Storage em clientes/<cliente>/ocorrencias/<id>-<nome> e o
-- caminho em ocorrencias.foto_caminho. A tela manda {"id", "texto", "foto"}:
--   "foto" com caminho → anexa/troca;  "foto": null → tira;  sem "foto" → não mexe.
-- Ver a foto: quem enxerga a ocorrência (o técnico da OS) e o escritório.
-- O resto das funções é igual ao de 20270119120000 e 20270123120000.
-- =============================================================================

alter table public.ocorrencias
  add column foto_caminho text check (char_length(foto_caminho) <= 500);

comment on column public.ocorrencias.foto_caminho is
  'Foto anexada pelo escritório (Storage, bucket arquivos): clientes/<cliente>/ocorrencias/...';

-- Caminho da foto que veio da tela, conferindo que é da pasta de ocorrências do cliente.
create or replace function privado.foto_da_ocorrencia(p_item jsonb, p_cliente uuid)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v_foto text := nullif(btrim(p_item ->> 'foto'), '');
begin
  if v_foto is not null
     and v_foto not like 'clientes/' || p_cliente::text || '/ocorrencias/%' then
    raise exception 'Foto da ocorrência inválida.' using errcode = '22023';
  end if;
  return v_foto;
end
$$;

revoke execute on function privado.foto_da_ocorrencia(jsonb, uuid) from public;
grant execute on function privado.foto_da_ocorrencia(jsonb, uuid) to authenticated;

-- Baixar a foto: quem enxerga a ocorrência (RLS de ocorrencias: técnico da OS e
-- escritório). O escritório vê também a que acabou de enviar e ainda não salvou.
create policy "ver foto da ocorrência" on storage.objects for select to authenticated
  using (
    bucket_id = 'arquivos'
    and (storage.foldername(name))[3] = 'ocorrencias'
    and (
      exists (select 1 from public.ocorrencias o where o.foto_caminho = name)
      or (privado.pode_gerir_os() and privado.pode_ver_cliente(privado.cliente_do_caminho(name)))
    )
  );

create index ocorrencias_foto_idx on public.ocorrencias (foto_caminho)
  where foto_caminho is not null;

create or replace function privado.salvar_ocorrencias_os(p_os uuid, p_itens jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_os     public.ordens_servico;
  v_item   jsonb;
  v_texto  text;
  v_id     uuid;
  v_manter uuid[] := '{}';
  v_foto   text;
begin
  if not privado.pode_gerir_os() then
    raise exception 'Somente o escritório muda as ocorrências.' using errcode = '42501';
  end if;
  select * into v_os from public.ordens_servico where id = p_os;
  if v_os.id is null then
    raise exception 'OS não encontrada.' using errcode = '23514';
  end if;
  if jsonb_typeof(coalesce(p_itens, '[]')) <> 'array' then
    raise exception 'Lista de ocorrências inválida.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]')) loop
    v_texto := nullif(trim(v_item ->> 'texto'), '');
    continue when v_texto is null;
    v_id := nullif(v_item ->> 'id', '')::uuid;
    v_foto := privado.foto_da_ocorrencia(v_item, v_os.cliente_id);
    if v_id is not null and exists (
      select 1 from public.os_ocorrencias where os_id = p_os and ocorrencia_id = v_id
    ) then
      update public.ocorrencias set texto = v_texto where id = v_id and texto <> v_texto;
      if v_item ? 'foto' then
        update public.ocorrencias set foto_caminho = v_foto
         where id = v_id and foto_caminho is distinct from v_foto;
      end if;
    else
      insert into public.ocorrencias
        (cliente_id, endereco_id, tipo_servico_id, texto, os_origem_id, foto_caminho)
      values (v_os.cliente_id, v_os.endereco_id, v_os.tipo_servico_id, v_texto, p_os, v_foto)
      returning id into v_id;
      insert into public.os_ocorrencias (os_id, ocorrencia_id) values (p_os, v_id);
    end if;
    v_manter := array_append(v_manter, v_id);
  end loop;

  -- As que saíram da lista.
  for v_id in
    select ocorrencia_id from public.os_ocorrencias
     where os_id = p_os and not (ocorrencia_id = any (v_manter))
  loop
    delete from public.os_ocorrencias where os_id = p_os and ocorrencia_id = v_id;
    if exists (
      select 1 from public.ocorrencias o
       where o.id = v_id and o.os_origem_id = p_os
         and not exists (select 1 from public.os_ocorrencias l where l.ocorrencia_id = o.id)
    ) then
      delete from public.ocorrencias where id = v_id;
    else
      update public.ocorrencias
         set sanada_em = coalesce(sanada_em, now()), sanada_na_os_id = coalesce(sanada_na_os_id, p_os)
       where id = v_id;
      -- Também some das OS que ainda não começaram.
      delete from public.os_ocorrencias l
       using public.ordens_servico s
       where l.ocorrencia_id = v_id and s.id = l.os_id and s.status in ('rascunho', 'agendada')
         and not privado.ocorrencia_respondida(l.os_id, v_id);
    end if;
    -- Tira a resposta do técnico a ela, se houver.
    update public.os_execucao
       set ocorrencias_resultado = ocorrencias_resultado - v_id::text
     where os_id = p_os and ocorrencias_resultado ? v_id::text;
  end loop;
end
$$;

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
  v_foto   text;
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
    v_foto := privado.foto_da_ocorrencia(v_item, v_mod.cliente_id);
    if v_id is not null and exists (
      select 1 from public.ocorrencias o
       where o.id = v_id and o.sanada_em is null
         and o.cliente_id = v_mod.cliente_id
         and o.tipo_servico_id = v_mod.tipo_servico_id
         and o.endereco_id is not distinct from v_mod.endereco_id
    ) then
      update public.ocorrencias set texto = v_texto where id = v_id and texto <> v_texto;
      if v_item ? 'foto' then
        update public.ocorrencias set foto_caminho = v_foto
         where id = v_id and foto_caminho is distinct from v_foto;
      end if;
    else
      insert into public.ocorrencias (cliente_id, endereco_id, tipo_servico_id, texto, foto_caminho)
      values (v_mod.cliente_id, v_mod.endereco_id, v_mod.tipo_servico_id, v_texto, v_foto)
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
