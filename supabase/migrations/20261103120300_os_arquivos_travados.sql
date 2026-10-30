-- =============================================================================
-- Ordens de Serviço (OS-1): fotos e assinaturas de uma OS concluída não podem ser
-- apagadas nem trocadas (nem pelo escritório). Só depois da reabertura (admin).
-- =============================================================================

create function privado.arquivo_de_os_travada()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.os_id is not null and exists (
    select 1 from public.ordens_servico s
     where s.id = old.os_id and s.status in ('concluida', 'conferida')
  ) then
    raise exception 'Esta OS já foi concluída: as fotos e assinaturas ficam guardadas como estão.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end
$$;

revoke execute on function privado.arquivo_de_os_travada() from public, authenticated;

create trigger os_travada before update or delete on public.arquivos
  for each row execute function privado.arquivo_de_os_travada();
