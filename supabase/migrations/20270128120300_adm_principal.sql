-- =============================================================================
-- ADM principal x ADM normal (pedido de 24/11/2026).
--
-- O perfil "ADM" (administrativo) passa a ter dois níveis:
--   - ADM principal (perfis.adm_principal): faz tudo o que o ADM fazia até hoje,
--     inclusive apagar, cancelar e reabrir ordens de serviço e ver valores.
--   - ADM normal (o padrão): trabalha normalmente (agenda, emite OS, certificados,
--     relatórios, cadastros), mas não apaga, cancela nem desativa nada, e não vê
--     valores (a tela esconde).
-- Quem marca o ADM principal é o Administrador, na tela de Usuários.
--
-- As travas ficam no banco (não só na tela): políticas restritivas de exclusão e
-- gatilhos que barram cancelar, reabrir e desativar.
-- =============================================================================

alter table public.perfis
  add column adm_principal boolean not null default false;

comment on column public.perfis.adm_principal is
  'ADM principal: o ADM que pode apagar, cancelar, reabrir e ver valores.';

grant update (adm_principal) on public.perfis to authenticated;

/** O usuário logado é ADM normal (administrativo sem ser o principal)? */
create or replace function privado.adm_restrito()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.papel = 'administrativo' and not p.adm_principal
       from public.perfis p
      where p.id = (select auth.uid()) and p.ativo),
    false)
$$;

revoke execute on function privado.adm_restrito() from public;
grant execute on function privado.adm_restrito() to authenticated;

create or replace function privado.barrar_adm_normal(p_acao text)
returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if privado.adm_restrito() then
    raise exception 'Só o ADM principal pode %. Peça ao ADM principal ou ao Administrador.', p_acao
      using errcode = '42501';
  end if;
end
$$;

revoke execute on function privado.barrar_adm_normal(text) from public;
grant execute on function privado.barrar_adm_normal(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Exclusões: políticas restritivas (somam às que já existem)
-- -----------------------------------------------------------------------------

create policy "ADM normal não apaga" on public.arquivos
  as restrictive for delete to authenticated using (not privado.adm_restrito());
create policy "ADM normal não apaga arquivos" on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'arquivos' or not privado.adm_restrito());
create policy "ADM normal não apaga" on public.enderecos
  as restrictive for delete to authenticated using (not privado.adm_restrito());
create policy "ADM normal não apaga" on public.contatos_cliente
  as restrictive for delete to authenticated using (not privado.adm_restrito());
create policy "ADM normal não apaga" on public.atendimentos
  as restrictive for delete to authenticated using (not privado.adm_restrito());
create policy "ADM normal não apaga" on public.descricoes_contrato
  as restrictive for delete to authenticated using (not privado.adm_restrito());
create policy "ADM normal não apaga" on public.os_rotas
  as restrictive for delete to authenticated using (not privado.adm_restrito());
create policy "ADM normal não apaga" on public.os_rota_modelos
  as restrictive for delete to authenticated using (not privado.adm_restrito());

-- -----------------------------------------------------------------------------
-- Cancelar, reabrir e desativar: gatilhos
-- -----------------------------------------------------------------------------

create or replace function privado.adm_normal_os()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if not old.treinamento then
      perform privado.barrar_adm_normal('apagar ordem de serviço');
    end if;
    return old;
  end if;
  if new.status = 'cancelada' and old.status <> 'cancelada' then
    perform privado.barrar_adm_normal('cancelar ordem de serviço');
  elsif old.status in ('concluida', 'conferida') and new.status in ('agendada', 'em_execucao', 'rascunho')
     or (old.status = 'conferida' and new.status = 'concluida') then
    perform privado.barrar_adm_normal('reabrir ordem de serviço');
  end if;
  return new;
end
$$;

create trigger adm_normal before update of status or delete on public.ordens_servico
  for each row execute function privado.adm_normal_os();

create or replace function privado.adm_normal_desativar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  case tg_table_name
    when 'certificados' then
      if new.cancelado_em is not null and old.cancelado_em is null then
        perform privado.barrar_adm_normal('cancelar certificado');
      end if;
    when 'contratos' then
      if new.status <> old.status and new.status in ('encerrado', 'suspenso') then
        perform privado.barrar_adm_normal('encerrar ou suspender contrato');
      end if;
    when 'servicos' then
      if new.status = 'cancelado' and old.status <> 'cancelado' then
        perform privado.barrar_adm_normal('cancelar serviço');
      end if;
    when 'clientes' then
      if old.ativo and not new.ativo then
        perform privado.barrar_adm_normal('desativar cliente');
      end if;
    when 'os_modelos' then
      if old.ativo and not new.ativo then
        perform privado.barrar_adm_normal('desativar O.S salva');
      end if;
    when 'pontos_controle' then
      if old.ativo and not new.ativo then
        perform privado.barrar_adm_normal('tirar ponto da O.S salva');
      end if;
  end case;
  return new;
end
$$;

create trigger adm_normal before update of cancelado_em on public.certificados
  for each row execute function privado.adm_normal_desativar();
create trigger adm_normal before update of status on public.contratos
  for each row execute function privado.adm_normal_desativar();
create trigger adm_normal before update of status on public.servicos
  for each row execute function privado.adm_normal_desativar();
create trigger adm_normal before update of ativo on public.clientes
  for each row execute function privado.adm_normal_desativar();
create trigger adm_normal before update of ativo on public.os_modelos
  for each row execute function privado.adm_normal_desativar();
create trigger adm_normal before update of ativo on public.pontos_controle
  for each row execute function privado.adm_normal_desativar();
