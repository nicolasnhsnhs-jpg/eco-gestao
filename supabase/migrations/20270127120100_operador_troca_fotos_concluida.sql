-- =============================================================================
-- Operador troca as próprias fotos depois de concluir (pedido de 23/11/2026): um
-- operador mandou fotos erradas e só percebeu depois de concluir a OS; o botão de
-- apagar sumia e o administrador teve que apagar por ele.
--
-- Agora, com a OS concluída mas ainda não conferida pelo escritório, o operador da
-- OS pode apagar as fotos que ele mesmo mandou e mandar outras. Só fotos (geral,
-- antes e depois): a assinatura do cliente continua travada ao concluir. Depois que
-- o escritório confere, ninguém mexe (como antes: só reabrindo a OS).
--
-- privado.arquivo_de_os_travada é a de 20261220120000_os_treinamento.sql, liberando
-- as fotos da OS concluída e não conferida.
-- =============================================================================

create or replace function privado.arquivo_de_os_travada()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if old.os_id is not null and exists (
    select 1 from public.ordens_servico s
     where s.id = old.os_id and not s.treinamento
       and (s.status = 'conferida'
            or (s.status = 'concluida'
                and old.categoria not in ('foto_os', 'foto_antes', 'foto_depois')))
  ) then
    raise exception 'Esta OS já foi concluída: só as fotos podem ser trocadas, e só até o escritório conferir.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end
$$;

-- A OS aceita troca de fotos do operador: aberta ou concluída e não conferida.
create function privado.os_aceita_fotos(os uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ordens_servico s
     where s.id = os and s.status in ('agendada', 'em_execucao', 'concluida')
  )
$$;

grant execute on function privado.os_aceita_fotos(uuid) to authenticated;

-- Tabela arquivos -------------------------------------------------------------

drop policy "operador envia arquivos da OS" on public.arquivos;
create policy "operador envia arquivos da OS" on public.arquivos for insert to authenticated
  with check (
    os_id is not null and privado.os_e_minha(os_id)
    and (
      (privado.os_aberta(os_id) and categoria in ('foto_os', 'foto_antes', 'foto_depois', 'assinatura'))
      or (privado.os_aceita_fotos(os_id) and categoria in ('foto_os', 'foto_antes', 'foto_depois'))
    )
  );

drop policy "operador apaga os próprios arquivos da OS" on public.arquivos;
create policy "operador apaga os próprios arquivos da OS" on public.arquivos for delete
  to authenticated
  using (
    os_id is not null and privado.os_e_minha(os_id)
    and enviado_por = (select auth.uid())
    and (
      privado.os_aberta(os_id)
      or (privado.os_aceita_fotos(os_id) and categoria in ('foto_os', 'foto_antes', 'foto_depois'))
    )
  );

-- Storage (o arquivo em si) --------------------------------------------------------
-- A categoria não está no Storage; quem decide é a regra da tabela acima (a tela
-- só apaga/envia o arquivo junto com o registro).

drop policy "operador envia arquivos da OS" on storage.objects;
create policy "operador envia arquivos da OS" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'arquivos'
    and privado.os_e_minha(privado.os_do_caminho(name))
    and privado.os_aceita_fotos(privado.os_do_caminho(name))
    and exists (
      select 1 from public.ordens_servico s
       where s.id = privado.os_do_caminho(name)
         and s.cliente_id = privado.cliente_do_caminho(name)
    )
  );

drop policy "operador apaga arquivos da OS" on storage.objects;
create policy "operador apaga arquivos da OS" on storage.objects for delete to authenticated
  using (
    bucket_id = 'arquivos'
    and owner_id = (select auth.uid())::text
    and privado.os_e_minha(privado.os_do_caminho(name))
    and privado.os_aceita_fotos(privado.os_do_caminho(name))
  );
