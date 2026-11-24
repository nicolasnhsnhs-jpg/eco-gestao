-- =============================================================================
-- OS de implantação (pedido de 24/11/2026).
--
-- O ADM agenda a OS escolhendo cliente, endereço e serviço, e marca "implantação".
-- Em campo, o técnico cadastra os pontos que está instalando: área, número, forma
-- de iscagem e tipo de isca (parafinada, porta-cola, mecânico…), armadilhas
-- luminosas, feromônio e armadilhas de moscas. Os pontos vão direto para a O.S
-- salva (pontos_controle do modelo da OS) e entram também na própria OS. Quando o
-- técnico conclui, o ADM revisa na conferência e a O.S salva fica pronta para os
-- próximos atendimentos.
--
-- O técnico não escreve em pontos_controle diretamente (só o escritório): ele usa
-- as duas funções abaixo, que só valem para OS de implantação aberta e dele.
-- =============================================================================

alter table public.ordens_servico
  add column implantacao boolean not null default false;

comment on column public.ordens_servico.implantacao is
  'OS de implantação: o técnico cadastra em campo os pontos da O.S salva.';

grant update (implantacao) on public.ordens_servico to authenticated;

-- Confere se quem chama pode mexer nos pontos desta OS de implantação; devolve o modelo.
create or replace function privado.modelo_da_implantacao(p_os uuid)
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_os public.ordens_servico%rowtype;
begin
  select * into v_os from public.ordens_servico where id = p_os;
  if not found then
    raise exception 'OS não encontrada.' using errcode = 'P0002';
  end if;
  if not v_os.implantacao then
    raise exception 'Esta OS não é de implantação: os pontos são cadastrados pelo escritório.'
      using errcode = '42501';
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

revoke execute on function privado.modelo_da_implantacao(uuid) from public;

/**
 * Cadastra pontos na O.S salva e na OS. pontos: [{tipo, numero, area,
 * forma_iscagem, tipo_isca, modelo_armadilha}]. Devolve quantos entraram.
 */
create or replace function public.implantacao_adicionar_pontos(os uuid, pontos jsonb)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_modelo uuid := privado.modelo_da_implantacao(os);
  v_total integer;
begin
  if jsonb_typeof(pontos) <> 'array' or jsonb_array_length(pontos) = 0 then
    raise exception 'Nenhum ponto para cadastrar.' using errcode = '22023';
  end if;
  if jsonb_array_length(pontos) > 500 then
    raise exception 'No máximo 500 pontos de uma vez.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(pontos) p
     where p ->> 'tipo' not in ('porta_isca', 'armadilha_luminosa', 'feromonio', 'armadilha_moscas')
  ) then
    raise exception 'Tipo de ponto que não se cadastra na implantação.' using errcode = '22023';
  end if;

  insert into public.pontos_controle (modelo_id, tipo, numero, area, forma_iscagem, tipo_isca, modelo_armadilha)
  select v_modelo,
         (p ->> 'tipo')::public.tipo_ponto,
         (p ->> 'numero')::integer,
         btrim(p ->> 'area'),
         case when p ->> 'tipo' = 'porta_isca' then nullif(p ->> 'forma_iscagem', '') end,
         case when p ->> 'tipo' = 'porta_isca' then nullif(p ->> 'tipo_isca', '') end,
         case when p ->> 'tipo' = 'armadilha_luminosa' then nullif(p ->> 'modelo_armadilha', '') end
    from jsonb_array_elements(pontos) p;
  get diagnostics v_total = row_count;

  -- Entram na OS os pontos da O.S salva que ela ainda não tem. Não é o escritório
  -- incluindo ponto com o técnico em campo: sem o aviso "ponto novo".
  perform privado.inserir_pontos_os(os, true);
  update public.os_pontos set incluido_na_execucao = false
   where os_id = os and incluido_na_execucao;
  return v_total;
end
$$;

/** Tira um ponto cadastrado por engano (da O.S salva e da OS). */
create or replace function public.implantacao_remover_ponto(os uuid, ponto uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_modelo uuid := privado.modelo_da_implantacao(os);
begin
  if not exists (select 1 from public.pontos_controle where id = ponto and modelo_id = v_modelo) then
    raise exception 'Este ponto não é desta OS.' using errcode = '42501';
  end if;
  delete from public.os_pontos where os_id = os and ponto_id = ponto;
  -- Ponto que já tem histórico em outra OS só sai de uso; o novo some de vez.
  if exists (select 1 from public.os_pontos where ponto_id = ponto) then
    update public.pontos_controle set ativo = false where id = ponto;
  else
    delete from public.pontos_controle where id = ponto;
  end if;
end
$$;

revoke execute on function public.implantacao_adicionar_pontos(uuid, jsonb) from public, anon;
revoke execute on function public.implantacao_remover_ponto(uuid, uuid) from public, anon;
grant execute on function public.implantacao_adicionar_pontos(uuid, jsonb) to authenticated;
grant execute on function public.implantacao_remover_ponto(uuid, uuid) to authenticated;
