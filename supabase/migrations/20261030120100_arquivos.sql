-- =============================================================================
-- Arquivos (drive interno): PDFs de propostas, documentos do cliente e, na
-- Fase 4, certificados, relatórios e fotos. Os arquivos ficam num "bucket"
-- PRIVADO do Supabase Storage; esta tabela guarda as informações de cada um.
-- =============================================================================

create type public.categoria_arquivo as enum (
  'proposta', 'certificado', 'relatorio', 'foto_antes', 'foto_depois',
  'comprovante', 'nota_fiscal', 'contrato', 'outro'
);

create table public.arquivos (
  id              uuid primary key default gen_random_uuid(),
  -- Caminho no Storage: clientes/<cliente_id>/<id>-<nome>
  caminho_storage text not null unique,
  nome_original   text not null,
  tipo_mime       text,
  tamanho_bytes   bigint check (tamanho_bytes >= 0),
  categoria       public.categoria_arquivo not null default 'outro',
  -- Todo arquivo pertence a um cliente (facilita a ficha e as permissões).
  cliente_id      uuid not null references public.clientes (id) on delete cascade,
  proposta_id     uuid references public.propostas (id) on delete cascade,
  lancamento_id   uuid references public.lancamentos (id) on delete cascade,
  descricao       text,
  enviado_por     uuid not null default auth.uid() references public.perfis (id),
  criado_em       timestamptz not null default now(),

  constraint no_maximo_um_vinculo check (num_nonnulls(proposta_id, lancamento_id) <= 1),
  constraint caminho_do_cliente check (caminho_storage like 'clientes/' || cliente_id || '/%')
);

create index arquivos_cliente_idx on public.arquivos (cliente_id, criado_em desc);
create index arquivos_proposta_idx on public.arquivos (proposta_id);
create index arquivos_lancamento_idx on public.arquivos (lancamento_id);

create function privado.antes_salvar_arquivo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.enviado_por := auth.uid();
  new.criado_em := now();
  -- O arquivo da proposta é do mesmo cliente da proposta.
  if new.proposta_id is not null and not exists (
    select 1 from public.propostas p where p.id = new.proposta_id and p.cliente_id = new.cliente_id
  ) then
    raise exception 'A proposta não é deste cliente.' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger antes_salvar before insert on public.arquivos
  for each row execute function privado.antes_salvar_arquivo();
create trigger auditoria after insert or update or delete on public.arquivos
  for each row execute function privado.registrar_auditoria();

-- -----------------------------------------------------------------------------
-- Permissões: quem vê o cliente vê os documentos gerais dele; arquivos de
-- proposta seguem a regra das propostas; comprovantes, a do financeiro.
-- -----------------------------------------------------------------------------

alter table public.arquivos enable row level security;

create function privado.pode_ver_arquivo(cliente_id uuid, proposta_id uuid, lancamento_id uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select privado.pode_ver_cliente(cliente_id)
     and (proposta_id is null or privado.pode_ver_proposta(proposta_id))
     and (lancamento_id is null or privado.tem_acesso_total())
$$;

grant execute on function privado.pode_ver_arquivo(uuid, uuid, uuid) to authenticated;

create policy "ver arquivos" on public.arquivos for select to authenticated
  using (privado.pode_ver_arquivo(cliente_id, proposta_id, lancamento_id));
create policy "enviar arquivos" on public.arquivos for insert to authenticated
  with check (privado.pode_ver_arquivo(cliente_id, proposta_id, lancamento_id));
-- Apagar: quem enviou, ou Admin/Financeiro.
create policy "apagar arquivos" on public.arquivos for delete to authenticated
  using (
    privado.pode_ver_arquivo(cliente_id, proposta_id, lancamento_id)
    and (enviado_por = (select auth.uid()) or privado.tem_acesso_total())
  );

revoke all on public.arquivos from anon, authenticated;
grant select, insert, delete on public.arquivos to authenticated;
grant update (descricao, categoria) on public.arquivos to authenticated;
create policy "descrever arquivos" on public.arquivos for update to authenticated
  using (privado.pode_ver_arquivo(cliente_id, proposta_id, lancamento_id))
  with check (privado.pode_ver_arquivo(cliente_id, proposta_id, lancamento_id));
grant all on public.arquivos to service_role;

-- -----------------------------------------------------------------------------
-- Storage: bucket privado, até 20 MB por arquivo, só tipos comuns de documento e foto
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'arquivos', 'arquivos', false, 20 * 1024 * 1024,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
);

-- Pasta clientes/<cliente_id>/…  →  o 2º pedaço do caminho é o cliente.
create function privado.cliente_do_caminho(caminho text)
returns uuid
language sql immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(caminho))[1] = 'clientes'
     and (storage.foldername(caminho))[2] ~ '^[0-9a-f-]{36}$'
    then (storage.foldername(caminho))[2]::uuid
  end
$$;

grant execute on function privado.cliente_do_caminho(text) to authenticated;

-- Baixar: só se a pessoa enxerga o registro do arquivo (que aplica todas as regras acima).
create policy "baixar arquivos do sistema" on storage.objects for select to authenticated
  using (
    bucket_id = 'arquivos'
    and exists (select 1 from public.arquivos a where a.caminho_storage = name)
  );

-- Enviar: só para a pasta de um cliente que a pessoa enxerga.
create policy "enviar arquivos do sistema" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'arquivos'
    and privado.pode_ver_cliente(privado.cliente_do_caminho(name))
  );

-- Apagar: quem enviou, ou Admin/Financeiro.
create policy "apagar arquivos do sistema" on storage.objects for delete to authenticated
  using (
    bucket_id = 'arquivos'
    and (owner_id = (select auth.uid())::text or privado.tem_acesso_total())
    and privado.pode_ver_cliente(privado.cliente_do_caminho(name))
  );

-- -----------------------------------------------------------------------------
-- Avisos: proposta enviada há 7 dias sem resposta → aviso ao vendedor
-- -----------------------------------------------------------------------------

alter table public.avisos add column proposta_id uuid references public.propostas (id) on delete cascade;

create function privado.gerar_avisos_propostas()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  insert into public.avisos (destinatario_id, tipo, titulo, mensagem, link, proposta_id, chave_unica)
  select
    p.vendedor_id,
    'proposta_sem_resposta',
    'Proposta sem resposta há ' || (privado.hoje() - p.data_envio) || ' dias',
    concat_ws(' · ', 'Nº ' || p.numero, coalesce(c.nome_fantasia, c.nome),
      'enviada em ' || to_char(p.data_envio, 'DD/MM/YYYY')),
    '/propostas/' || p.id,
    p.id,
    'proposta:' || p.id
  from public.propostas p
  join public.clientes c on c.id = p.cliente_id
  where p.status = 'enviada'
    and privado.hoje() - p.data_envio >= 7
  on conflict (chave_unica) do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end
$$;

revoke execute on function privado.gerar_avisos_propostas() from public;
grant execute on function privado.gerar_avisos_propostas() to authenticated;

-- Respondida (aprovada/recusada): o aviso se resolve sozinho.
create function privado.resolver_avisos_proposta()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status <> 'enviada' then
    update public.avisos set resolvido_em = now()
     where proposta_id = new.id and resolvido_em is null;
  end if;
  return new;
end
$$;

revoke execute on function privado.resolver_avisos_proposta() from public, authenticated;

create trigger resolver_avisos after update on public.propostas
  for each row execute function privado.resolver_avisos_proposta();

-- "Atualizar avisos" passa a gerar também os de propostas (para qualquer perfil;
-- cada aviso vai para o vendedor da proposta).
create or replace function public.atualizar_avisos()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_total integer := 0;
begin
  if privado.meu_papel() is null then
    return 0;
  end if;
  if privado.tem_acesso_total() then
    v_total := privado.gerar_avisos_financeiro();
  end if;
  return v_total + privado.gerar_avisos_propostas();
end
$$;

select cron.schedule(
  'gerar-avisos-propostas',
  '5 9 * * *',
  $$select privado.gerar_avisos_propostas()$$
);
