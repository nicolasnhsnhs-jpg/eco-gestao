-- =============================================================================
-- Escritório corrige a descrição e as observações do ADM de uma O.S já começada
-- ou concluída (pedido de 25/11/2026). Ex.: "reservatório de 10m³" que era 28m³.
-- Depois que a O.S começa, a tela "Editar OS" some e a concluída fica travada
-- (privado.antes_salvar_os); esta função abre exceção só para esses dois textos.
-- Com p_proximas, a O.S salva também muda (vale para as próximas visitas).
-- =============================================================================

create or replace function public.os_corrigir_descricao(
  os             uuid,
  descricao      text,
  observacoes    text,
  para_proximas  boolean default false
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_os public.ordens_servico;
begin
  if not privado.pode_gerir_os() then
    raise exception 'Só o escritório corrige a descrição da OS.' using errcode = '42501';
  end if;
  select * into v_os from public.ordens_servico s where s.id = os_corrigir_descricao.os;
  if not found then
    raise exception 'OS não encontrada.' using errcode = 'P0002';
  end if;
  if v_os.status = 'cancelada' then
    raise exception 'OS cancelada não é corrigida.' using errcode = '23514';
  end if;
  if char_length(btrim(coalesce(descricao, ''))) < 3 then
    raise exception 'Descreva o serviço.' using errcode = '23514';
  end if;

  perform set_config('app.os_transicao', 'sim', true);
  update public.ordens_servico s
     set descricao = btrim(os_corrigir_descricao.descricao),
         observacoes_adm = nullif(btrim(observacoes), '')
   where s.id = v_os.id;
  perform set_config('app.os_transicao', '', true);

  if para_proximas and v_os.modelo_id is not null then
    update public.os_modelos m
       set descricao = btrim(os_corrigir_descricao.descricao),
           observacoes_adm_padrao = nullif(btrim(observacoes), '')
     where m.id = v_os.modelo_id;
  end if;
end
$$;

revoke execute on function public.os_corrigir_descricao(uuid, text, text, boolean) from public, anon;
grant execute on function public.os_corrigir_descricao(uuid, text, text, boolean) to authenticated;
