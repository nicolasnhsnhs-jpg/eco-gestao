-- =============================================================================
-- Análise de água: o técnico nomeia os pontos de coleta em campo (pedido de 25/11/2026).
--
-- O escritório não sabe de onde vai sair a amostra ("Torneira da cozinha",
-- "Banheiro"…): quem diz é o técnico, na hora do serviço. Ele adiciona o ponto, corrige
-- o nome ou tira o ponto que não usa mais. Os pontos ficam na O.S salva do local (como
-- os do escritório) e aparecem nas próximas coletas, com a data da coleta anterior.
--
-- O técnico não escreve em pontos_controle diretamente (só o escritório): estas funções
-- valem só para OS de análise de água aberta e dele.
-- =============================================================================

-- Confere se quem chama pode mexer nos pontos de coleta desta OS; devolve o modelo.
create or replace function privado.modelo_da_coleta(p_os uuid)
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_os   public.ordens_servico%rowtype;
  v_form public.formulario_os;
begin
  select * into v_os from public.ordens_servico where id = p_os;
  if not found then
    raise exception 'OS não encontrada.' using errcode = 'P0002';
  end if;
  select formulario_os into v_form from public.tipos_servico where id = v_os.tipo_servico_id;
  if v_form is distinct from 'agua' then
    raise exception 'Esta OS não é de análise de água.' using errcode = '42501';
  end if;
  if not (privado.os_e_minha(p_os) or privado.pode_gerir_os()) then
    raise exception 'Esta OS não é sua.' using errcode = '42501';
  end if;
  if v_os.status not in ('agendada', 'em_execucao') then
    raise exception 'Esta OS já foi concluída: os pontos agora são revisados pelo escritório.'
      using errcode = '23514';
  end if;
  if v_os.modelo_id is null then
    raise exception 'Esta OS não tem O.S salva para guardar os pontos.' using errcode = '23514';
  end if;
  return v_os.modelo_id;
end
$$;

revoke execute on function privado.modelo_da_coleta(uuid) from public;

create or replace function privado.nome_do_ponto_coleta(p_area text)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_area, ''));
begin
  if char_length(v) < 2 then
    raise exception 'Diga onde foi a coleta (ex.: Torneira da cozinha).' using errcode = '22023';
  end if;
  if char_length(v) > 80 then
    raise exception 'Nome do ponto muito longo (até 80 letras).' using errcode = '22023';
  end if;
  return v;
end
$$;

/** Adiciona um ponto de coleta com o nome dado pelo técnico (na O.S salva e na OS). */
create or replace function public.coleta_adicionar_ponto(os uuid, area text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_modelo uuid := privado.modelo_da_coleta(os);
  v_nome   text := privado.nome_do_ponto_coleta(area);
  v_id     uuid;
begin
  if exists (
    select 1 from public.os_pontos p
     where p.os_id = os and p.tipo = 'ponto_coleta' and lower(btrim(p.area)) = lower(v_nome)
  ) then
    raise exception 'Já tem um ponto com esse nome nesta coleta.' using errcode = '23505';
  end if;

  insert into public.pontos_controle (modelo_id, tipo, numero, area)
  values (
    v_modelo, 'ponto_coleta',
    coalesce((select max(numero) from public.pontos_controle
               where modelo_id = v_modelo and tipo = 'ponto_coleta'), 0) + 1,
    v_nome)
  returning id into v_id;

  -- Entra na OS o ponto novo. É o próprio técnico: sem o aviso "ponto novo".
  perform privado.inserir_pontos_os(os, true);
  update public.os_pontos set incluido_na_execucao = false
   where os_id = os and incluido_na_execucao;
  return v_id;
end
$$;

/** Corrige o nome do ponto (na OS e na O.S salva; as coletas antigas ficam como estavam). */
create or replace function public.coleta_renomear_ponto(os uuid, ponto uuid, area text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_modelo uuid := privado.modelo_da_coleta(os);
  v_nome   text := privado.nome_do_ponto_coleta(area);
begin
  if not exists (
    select 1 from public.pontos_controle
     where id = ponto and modelo_id = v_modelo and tipo = 'ponto_coleta'
  ) then
    raise exception 'Este ponto não é desta OS.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.os_pontos p
     where p.os_id = os and p.tipo = 'ponto_coleta' and p.ponto_id <> ponto
       and lower(btrim(p.area)) = lower(v_nome)
  ) then
    raise exception 'Já tem um ponto com esse nome nesta coleta.' using errcode = '23505';
  end if;
  update public.pontos_controle set area = v_nome where id = ponto;
  update public.os_pontos set area = v_nome where os_id = os and ponto_id = ponto;
end
$$;

/** Tira o ponto que não se usa mais (da OS e da O.S salva; o histórico fica). */
create or replace function public.coleta_remover_ponto(os uuid, ponto uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_modelo uuid := privado.modelo_da_coleta(os);
begin
  if not exists (
    select 1 from public.pontos_controle
     where id = ponto and modelo_id = v_modelo and tipo = 'ponto_coleta'
  ) then
    raise exception 'Este ponto não é desta OS.' using errcode = '42501';
  end if;
  delete from public.os_pontos where os_id = os and ponto_id = ponto;
  -- Ponto que já tem coleta em outra OS só sai de uso; o novo some de vez.
  if exists (select 1 from public.os_pontos where ponto_id = ponto) then
    update public.pontos_controle set ativo = false where id = ponto;
  else
    delete from public.pontos_controle where id = ponto;
  end if;
end
$$;

revoke execute on function public.coleta_adicionar_ponto(uuid, text),
  public.coleta_renomear_ponto(uuid, uuid, text),
  public.coleta_remover_ponto(uuid, uuid) from public, anon;
grant execute on function public.coleta_adicionar_ponto(uuid, text),
  public.coleta_renomear_ponto(uuid, uuid, text),
  public.coleta_remover_ponto(uuid, uuid) to authenticated;
