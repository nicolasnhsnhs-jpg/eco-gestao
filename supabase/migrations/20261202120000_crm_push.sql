-- =============================================================================
-- Notificações push do CRM (Web Push com VAPID: iPhone com o app na tela de início,
-- Android e computador).
--
--   push_inscricoes            um registro por aparelho (o endereço que o serviço de
--                              push da Apple/Google deu para aquele aparelho)
--   preferencias_notificacao   o que cada pessoa quer receber
--   push_enviados              o que já foi mandado: a mesma mensagem nunca é
--                              notificada duas vezes no mesmo aparelho
--
-- Quem recebe: quem pode ver a conversa (a mesma regra do CRM), com as notificações
-- ligadas. Com "só as minhas", só quando a pessoa é a responsável pela conversa.
-- =============================================================================

create table public.push_inscricoes (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  endpoint         text not null unique check (endpoint ~ '^https://'),
  p256dh           text not null,
  auth             text not null,
  -- Ex.: "iPhone · app na tela de início". Só para a pessoa reconhecer o aparelho.
  dispositivo      text,
  criado_em        timestamptz not null default now(),
  ultimo_acesso_em timestamptz not null default now(),
  ultimo_envio_em  timestamptz,
  ultimo_erro      text
);

create index push_inscricoes_usuario_idx on public.push_inscricoes (usuario_id);

create table public.preferencias_notificacao (
  usuario_id     uuid primary key default auth.uid() references public.perfis (id) on delete cascade,
  ativo          boolean not null default true,
  -- Desligado: a notificação diz só "Nova mensagem no WhatsApp" (sem nome nem texto).
  mostrar_previa boolean not null default true,
  -- Ligado: só as conversas em que a pessoa é a responsável.
  apenas_minhas  boolean not null default false,
  atualizado_em  timestamptz not null default now()
);

create table public.push_enviados (
  mensagem_id  uuid not null references public.wa_mensagens (id) on delete cascade,
  inscricao_id uuid not null references public.push_inscricoes (id) on delete cascade,
  enviado_em   timestamptz not null default now(),
  primary key (mensagem_id, inscricao_id)
);

create index push_enviados_em_idx on public.push_enviados (enviado_em);

-- -----------------------------------------------------------------------------
-- Permissões: cada pessoa só mexe nos próprios aparelhos e preferências.
-- -----------------------------------------------------------------------------

alter table public.push_inscricoes enable row level security;
alter table public.preferencias_notificacao enable row level security;
alter table public.push_enviados enable row level security;

revoke all on public.push_inscricoes, public.preferencias_notificacao, public.push_enviados
  from anon, authenticated;
grant all on public.push_inscricoes, public.preferencias_notificacao, public.push_enviados
  to service_role;

grant select, delete on public.push_inscricoes to authenticated;
create policy "meus aparelhos" on public.push_inscricoes for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy "apagar meus aparelhos" on public.push_inscricoes for delete to authenticated
  using (usuario_id = (select auth.uid()));

grant select, insert, update on public.preferencias_notificacao to authenticated;
create policy "minhas preferências" on public.preferencias_notificacao for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy "criar minhas preferências" on public.preferencias_notificacao for insert to authenticated
  with check (usuario_id = (select auth.uid()));
create policy "alterar minhas preferências" on public.preferencias_notificacao for update to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Registrar este aparelho para a pessoa logada. Se o aparelho estava com outra pessoa
-- (trocou o login no mesmo celular), passa a ser só de quem entrou agora.
-- -----------------------------------------------------------------------------
create function public.crm_registrar_aparelho(
  p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not privado.pode_usar_crm() then
    raise exception 'Seu usuário não usa o atendimento pelo WhatsApp.' using errcode = '42501';
  end if;
  insert into public.push_inscricoes (usuario_id, endpoint, p256dh, auth, dispositivo)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_dispositivo, 120))
  on conflict (endpoint) do update
     set usuario_id = excluded.usuario_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         dispositivo = excluded.dispositivo,
         ultimo_acesso_em = now(),
         ultimo_erro = null
  returning id into v_id;
  return v_id;
end
$$;

-- Ao sair do sistema: este aparelho para de receber (vale para qualquer dono do registro,
-- porque quem tem o endereço é o próprio aparelho).
create function public.crm_remover_aparelho(p_endpoint text)
returns void
language sql security definer
set search_path = ''
as $$
  delete from public.push_inscricoes where endpoint = p_endpoint
$$;

revoke execute on function public.crm_registrar_aparelho(text, text, text, text),
  public.crm_remover_aparelho(text) from public, anon;
grant execute on function public.crm_registrar_aparelho(text, text, text, text),
  public.crm_remover_aparelho(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Quem vê a conversa, para um usuário qualquer (o servidor não tem auth.uid()).
-- É a mesma regra de privado.pode_usar_crm + privado.pode_ver_conversa.
-- -----------------------------------------------------------------------------
create function privado.usuario_ve_conversa(
  usuario uuid, responsavel_id uuid, setor public.setor_atendimento
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select p.ativo and p.papel <> 'operador' and (p.papel = 'admin' or p.atende_whatsapp)
       and (p.papel = 'admin'
            or responsavel_id = p.id
            or (p.papel = 'administrativo' and (responsavel_id is null or setor = 'administrativo')))
      from public.perfis p where p.id = usuario
  ), false)
$$;

revoke execute on function privado.usuario_ve_conversa(uuid, uuid, public.setor_atendimento) from public, authenticated;

-- Aparelhos que devem receber a notificação de uma mensagem nova, com o total de não
-- lidas de cada pessoa (o número no ícone do app).
create function public.crm_destinatarios_push(p_conversa uuid)
returns table (
  inscricao_id uuid, usuario_id uuid, endpoint text, p256dh text, auth text,
  mostrar_previa boolean, nao_lidas_total bigint
)
language sql stable security definer
set search_path = ''
as $$
  with conversa as (
    select id, responsavel_id, setor from public.wa_conversas where id = p_conversa
  ),
  pessoas as (
    select p.id, coalesce(pr.mostrar_previa, true) as mostrar_previa
      from public.perfis p
      cross join conversa c
      left join public.preferencias_notificacao pr on pr.usuario_id = p.id
     where privado.usuario_ve_conversa(p.id, c.responsavel_id, c.setor)
       and coalesce(pr.ativo, true)
       and (not coalesce(pr.apenas_minhas, false) or c.responsavel_id = p.id)
  )
  select i.id, i.usuario_id, i.endpoint, i.p256dh, i.auth, pe.mostrar_previa,
         (select coalesce(sum(w.nao_lidas), 0) from public.wa_conversas w
           where w.status <> 'finalizada' and w.nao_lidas > 0
             and privado.usuario_ve_conversa(pe.id, w.responsavel_id, w.setor))
    from pessoas pe
    join public.push_inscricoes i on i.usuario_id = pe.id
$$;

revoke execute on function public.crm_destinatarios_push(uuid) from public, anon, authenticated;
grant execute on function public.crm_destinatarios_push(uuid) to service_role;

-- O registro do que já foi enviado só serve para não repetir: some depois de 30 dias.
select cron.schedule(
  'limpar-push-enviados',
  '50 3 * * *',
  $$delete from public.push_enviados where enviado_em < now() - interval '30 days'$$
);
