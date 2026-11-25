-- =============================================================================
-- ADM principal reabre O.S concluída (pedido de 25/11/2026).
--
-- A regra de 20270128120300 dizia que o ADM principal reabre ordens de serviço,
-- mas privado.reabrir_os (20261103120200) ainda só aceitava o Administrador.
-- Agora: Administrador ou ADM principal (ativo). O ADM normal continua barrado.
-- O resto é igual ao de 20261103120200_ordens_servico.sql.
-- =============================================================================

create or replace function privado.e_adm_principal()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.papel = 'administrativo' and p.adm_principal
       from public.perfis p
      where p.id = (select auth.uid()) and p.ativo),
    false)
$$;

revoke execute on function privado.e_adm_principal() from public;
grant execute on function privado.e_adm_principal() to authenticated;

create or replace function privado.reabrir_os(p_os uuid, p_motivo text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (privado.e_admin() or privado.e_adm_principal()) then
    raise exception 'Somente o Administrador ou o ADM principal pode reabrir uma OS.'
      using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Informe o motivo da reabertura.' using errcode = '23514';
  end if;
  perform set_config('app.os_transicao', 'sim', true);
  update public.ordens_servico
     set status = 'em_execucao', reaberta_em = now(), reaberta_por = auth.uid(),
         motivo_reabertura = trim(p_motivo)
   where id = p_os and status in ('concluida', 'conferida');
  if not found then
    raise exception 'Só dá para reabrir uma OS concluída.' using errcode = '23514';
  end if;
  perform set_config('app.os_transicao', '', true);
end
$$;
