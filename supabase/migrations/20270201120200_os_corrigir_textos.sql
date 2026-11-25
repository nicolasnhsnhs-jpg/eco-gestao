-- =============================================================================
-- O escritório corrige o português da OS concluída (pedido de 25/11/2026).
--
-- Depois de concluída, a execução fica travada (ninguém mexe no que o técnico
-- registrou). Esta função abre uma exceção só para TEXTO: observações, resultado,
-- comentários do checklist e observações dos pontos. Não muda números, códigos,
-- horários, fotos nem assinaturas. Fica na auditoria (gatilho de os_execucao).
-- =============================================================================

/**
 * execucao: {"observacoes": "...", "resultado": "...", "motivo_nao_realizado": "..."}
 *   (só as chaves que mudaram);
 * checklist: [{"caminho": ["comentarios_roedores"], "valor": "..."}] — o caminho
 *   precisa já existir e ser texto;
 * pontos: [{"id": "<os_pontos.id>", "observacao": "..."}].
 * Devolve quantos textos foram trocados.
 */
create or replace function public.os_corrigir_textos(
  os        uuid,
  execucao  jsonb default '{}',
  checklist jsonb default '[]',
  pontos    jsonb default '[]'
)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status public.status_os;
  v_chave  text;
  v_item   jsonb;
  v_total  integer := 0;
  v_linhas integer;
  v_check  jsonb;
begin
  if not privado.pode_gerir_os() then
    raise exception 'Só o escritório corrige os textos da OS.' using errcode = '42501';
  end if;
  select status into v_status from public.ordens_servico where id = os;
  if not found then
    raise exception 'OS não encontrada.' using errcode = 'P0002';
  end if;
  if v_status not in ('concluida', 'conferida') then
    raise exception 'A OS ainda está aberta: o técnico corrige na própria execução.'
      using errcode = '23514';
  end if;

  -- Campos de texto da execução.
  for v_chave in select jsonb_object_keys(coalesce(execucao, '{}')) loop
    if v_chave not in ('observacoes', 'resultado', 'motivo_nao_realizado') then
      raise exception 'Campo % não é texto livre.', v_chave using errcode = '22023';
    end if;
    if jsonb_typeof(execucao -> v_chave) not in ('string', 'null') then
      raise exception 'O campo % precisa ser texto.', v_chave using errcode = '22023';
    end if;
  end loop;
  if execucao is not null and execucao <> '{}' then
    update public.os_execucao e
       set observacoes = case when execucao ? 'observacoes'
                              then nullif(btrim(execucao ->> 'observacoes'), '') else e.observacoes end,
           resultado = case when execucao ? 'resultado'
                            then nullif(btrim(execucao ->> 'resultado'), '') else e.resultado end,
           motivo_nao_realizado = case when execucao ? 'motivo_nao_realizado'
                                       then nullif(btrim(execucao ->> 'motivo_nao_realizado'), '')
                                       else e.motivo_nao_realizado end
     where e.os_id = os;
    v_total := v_total + (select count(*) from jsonb_object_keys(execucao));
  end if;

  -- Textos dentro do checklist: só troca o que já é texto.
  if jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) > 0 then
    select e.checklist into v_check from public.os_execucao e where e.os_id = os;
    for v_item in select * from jsonb_array_elements(checklist) loop
      if jsonb_typeof(v_item -> 'caminho') <> 'array'
         or jsonb_typeof(v_check #> array(select jsonb_array_elements_text(v_item -> 'caminho')))
            is distinct from 'string'
         or jsonb_typeof(v_item -> 'valor') <> 'string' then
        raise exception 'Só dá para corrigir textos que já existem no checklist.' using errcode = '22023';
      end if;
      v_check := jsonb_set(
        v_check,
        array(select jsonb_array_elements_text(v_item -> 'caminho')),
        to_jsonb(btrim(v_item ->> 'valor')));
      v_total := v_total + 1;
    end loop;
    update public.os_execucao set checklist = v_check where os_id = os;
  end if;

  -- Observações dos pontos.
  if jsonb_typeof(pontos) = 'array' then
    for v_item in select * from jsonb_array_elements(pontos) loop
      if jsonb_typeof(v_item -> 'observacao') not in ('string', 'null') then
        raise exception 'A observação do ponto precisa ser texto.' using errcode = '22023';
      end if;
      update public.os_pontos
         set observacao = nullif(btrim(v_item ->> 'observacao'), '')
       where id = (v_item ->> 'id')::uuid and os_id = os;
      get diagnostics v_linhas = row_count;
      if v_linhas = 0 then
        raise exception 'Ponto que não é desta OS.' using errcode = '42501';
      end if;
      v_total := v_total + 1;
    end loop;
  end if;

  return v_total;
end
$$;

revoke execute on function public.os_corrigir_textos(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.os_corrigir_textos(uuid, jsonb, jsonb, jsonb) to authenticated;
