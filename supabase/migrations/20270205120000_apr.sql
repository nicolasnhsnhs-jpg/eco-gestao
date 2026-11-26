-- =============================================================================
-- APR — Análise Preliminar de Risco (pedido de 26/11/2026).
--
-- O escritório emite a APR em Documentos > Emissão de APR: escolhe o cliente, o
-- modelo (limpeza de reservatório, limpeza de coifa…), a data e os técnicos que vão
-- fazer o serviço. Cada técnico vê a APR em "Pendências" no celular e assina com o
-- dedo. Quando todos assinam, a APR fica concluída e o escritório baixa o PDF e
-- manda ao cliente por e-mail (à mão, sem envio automático).
--
--   public.aprs               a análise (dados do cliente copiados na hora, etapas)
--   public.apr_participantes  quem precisa assinar e a assinatura de cada um
--
-- As etapas ficam gravadas na própria APR (jsonb): mudar o modelo depois não mexe
-- nas APRs já emitidas. A assinatura é um PNG no Storage (bucket arquivos) em
-- clientes/<cliente>/apr/<apr>/<técnico>-….png.
-- Número: "Nº 28/2026" — sequência por ano (numero / ano).
-- =============================================================================

create table public.aprs (
  id                   uuid primary key default gen_random_uuid(),
  numero               integer not null,
  ano                  integer not null,
  modelo               text not null check (modelo in ('reservatorio', 'coifa', 'outro')),
  titulo               text not null check (char_length(btrim(titulo)) between 3 and 200),
  descricao_atividade  text check (char_length(descricao_atividade) <= 2000),
  cliente_id           uuid not null references public.clientes (id) on delete restrict,
  endereco_id          uuid references public.enderecos (id) on delete set null,
  -- Copiados na emissão (o técnico não enxerga o cadastro de clientes).
  cliente_nome         text not null,
  cliente_documento    text,
  local                text check (char_length(local) <= 300),
  endereco_texto       text check (char_length(endereco_texto) <= 500),
  data                 date not null,
  -- [{"etapa", "riscos", "medidas", "o_que_pode_dar_errado", "acoes"}]
  etapas               jsonb not null check (jsonb_typeof(etapas) = 'array'),
  -- ["Capacete com jugular", …]
  epis                 jsonb not null default '[]' check (jsonb_typeof(epis) = 'array'),
  observacoes          text check (char_length(observacoes) <= 4000),
  status               text not null default 'pendente'
                         check (status in ('pendente', 'concluida', 'cancelada')),
  concluida_em         timestamptz,
  cancelada_em         timestamptz,
  motivo_cancelamento  text,
  criado_em            timestamptz not null default now(),
  criado_por           uuid references public.perfis (id),
  atualizado_em        timestamptz not null default now(),
  atualizado_por       uuid references public.perfis (id),
  unique (ano, numero)
);

comment on table public.aprs is 'Análise Preliminar de Risco emitida pelo escritório e assinada pelos técnicos.';

create index aprs_cliente_idx on public.aprs (cliente_id, data desc);
create index aprs_endereco_idx on public.aprs (endereco_id);
create index aprs_status_idx on public.aprs (status, data desc);
create index aprs_criado_por_idx on public.aprs (criado_por);
create index aprs_atualizado_por_idx on public.aprs (atualizado_por);

create table public.apr_participantes (
  apr_id              uuid not null references public.aprs (id) on delete cascade,
  perfil_id           uuid not null references public.perfis (id),
  nome                text not null,
  funcao              text not null default 'Operador Técnico',
  ordem               integer not null default 0,
  assinatura_caminho  text,
  assinada_em         timestamptz,
  primary key (apr_id, perfil_id),
  check ((assinatura_caminho is null) = (assinada_em is null))
);

create index apr_participantes_perfil_idx on public.apr_participantes (perfil_id, assinada_em);

comment on table public.apr_participantes is 'Técnicos que assinam a APR (ciência dos riscos).';

-- Número da APR: próximo do ano da data.
create or replace function privado.antes_salvar_apr()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.ano := extract(year from new.data)::integer;
    perform pg_advisory_xact_lock(hashtext('apr_numero'), new.ano);
    select coalesce(max(a.numero), 0) + 1 into new.numero
      from public.aprs a where a.ano = new.ano;
    new.status := 'pendente';
    new.concluida_em := null;
  end if;
  return new;
end
$$;

revoke execute on function privado.antes_salvar_apr() from public;

create trigger antes_salvar before insert on public.aprs
  for each row execute function privado.antes_salvar_apr();
create trigger carimbar before insert or update on public.aprs
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.aprs
  for each row execute function privado.registrar_auditoria();
create trigger auditoria after insert or update or delete on public.apr_participantes
  for each row execute function privado.registrar_auditoria();

-- O técnico está nesta APR?
create or replace function privado.apr_e_minha(p_apr uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.apr_participantes p
     where p.apr_id = p_apr and p.perfil_id = (select auth.uid())
  )
$$;

revoke execute on function privado.apr_e_minha(uuid) from public;
grant execute on function privado.apr_e_minha(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Permissões: o escritório vê e emite; o técnico vê só as APRs em que está.
-- A assinatura entra só pela função assinar_apr.
-- -----------------------------------------------------------------------------
alter table public.aprs enable row level security;
alter table public.apr_participantes enable row level security;

create policy "ver APR" on public.aprs for select to authenticated
  using (
    (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id))
    or privado.apr_e_minha(id)
  );
create policy "escritório emite APR" on public.aprs for insert to authenticated
  with check (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id));
create policy "escritório altera APR" on public.aprs for update to authenticated
  using (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id))
  with check (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id));

revoke all on public.aprs from anon, authenticated;
grant select, insert on public.aprs to authenticated;
grant update (titulo, descricao_atividade, local, endereco_texto, data, etapas, epis,
              observacoes) on public.aprs to authenticated;
grant all on public.aprs to service_role;

create policy "ver quem assina a APR" on public.apr_participantes for select to authenticated
  using (
    perfil_id = (select auth.uid())
    or exists (
      select 1 from public.aprs a
       where a.id = apr_id and privado.pode_gerir_os() and privado.pode_ver_cliente(a.cliente_id)
    )
    or privado.apr_e_minha(apr_id)
  );

revoke all on public.apr_participantes from anon, authenticated;
grant select on public.apr_participantes to authenticated;
grant all on public.apr_participantes to service_role;

-- -----------------------------------------------------------------------------
-- Escritório troca quem assina (só enquanto ninguém assinou... quem já assinou fica).
-- p_tecnicos: ids dos perfis, na ordem.
-- -----------------------------------------------------------------------------
create or replace function public.apr_definir_tecnicos(apr uuid, tecnicos uuid[])
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_apr public.aprs;
  v_id  uuid;
  v_i   integer := 0;
begin
  select * into v_apr from public.aprs a where a.id = apr_definir_tecnicos.apr;
  if not found or not (privado.pode_gerir_os() and privado.pode_ver_cliente(v_apr.cliente_id)) then
    raise exception 'APR não encontrada.' using errcode = 'P0002';
  end if;
  if v_apr.status = 'cancelada' then
    raise exception 'APR cancelada.' using errcode = '23514';
  end if;
  if coalesce(array_length(tecnicos, 1), 0) = 0 then
    raise exception 'Escolha pelo menos um técnico.' using errcode = '23514';
  end if;

  -- Sai quem não está mais na lista (a não ser que já tenha assinado).
  delete from public.apr_participantes p
   where p.apr_id = v_apr.id and not (p.perfil_id = any (tecnicos)) and p.assinada_em is null;

  foreach v_id in array tecnicos loop
    v_i := v_i + 1;
    insert into public.apr_participantes (apr_id, perfil_id, nome, funcao, ordem)
    select v_apr.id, f.id, f.nome,
           case when f.papel = 'operador' then 'Operador Técnico' else 'Supervisor' end, v_i
      from public.perfis f
     where f.id = v_id and f.ativo
    on conflict (apr_id, perfil_id) do update set ordem = excluded.ordem;
    if not found then
      raise exception 'Usuário inativo ou não encontrado.' using errcode = '23514';
    end if;
  end loop;

  perform privado.conferir_apr(v_apr.id);
end
$$;

revoke execute on function public.apr_definir_tecnicos(uuid, uuid[]) from public, anon;
grant execute on function public.apr_definir_tecnicos(uuid, uuid[]) to authenticated;

-- Todos assinaram → concluída (e volta a pendente se entrar alguém novo).
create or replace function privado.conferir_apr(p_apr uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_falta boolean;
begin
  select exists (select 1 from public.apr_participantes where apr_id = p_apr and assinada_em is null)
    into v_falta;
  update public.aprs a
     set status = case when v_falta then 'pendente' else 'concluida' end,
         concluida_em = case when v_falta then null else coalesce(a.concluida_em, now()) end
   where a.id = p_apr and a.status <> 'cancelada'
     and a.status is distinct from case when v_falta then 'pendente' else 'concluida' end;
end
$$;

revoke execute on function privado.conferir_apr(uuid) from public;

-- -----------------------------------------------------------------------------
-- O técnico assina: a imagem já foi para o Storage (pasta da APR); aqui grava.
-- -----------------------------------------------------------------------------
create or replace function public.assinar_apr(apr uuid, caminho text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_apr public.aprs;
begin
  select * into v_apr from public.aprs a where a.id = assinar_apr.apr;
  if not found or not privado.apr_e_minha(v_apr.id) then
    raise exception 'Esta APR não é sua.' using errcode = '42501';
  end if;
  if v_apr.status = 'cancelada' then
    raise exception 'Esta APR foi cancelada.' using errcode = '23514';
  end if;
  if caminho is null
     or caminho not like 'clientes/' || v_apr.cliente_id || '/apr/' || v_apr.id || '/' || (select auth.uid()) || '-%' then
    raise exception 'Assinatura inválida.' using errcode = '22023';
  end if;
  update public.apr_participantes p
     set assinatura_caminho = caminho, assinada_em = now()
   where p.apr_id = v_apr.id and p.perfil_id = (select auth.uid()) and p.assinada_em is null;
  if not found then
    raise exception 'Você já assinou esta APR.' using errcode = '23514';
  end if;
  perform privado.conferir_apr(v_apr.id);
end
$$;

revoke execute on function public.assinar_apr(uuid, text) from public, anon;
grant execute on function public.assinar_apr(uuid, text) to authenticated;

-- Cancelar (escritório). Fica no histórico.
create or replace function public.cancelar_apr(apr uuid, motivo text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_apr public.aprs;
begin
  select * into v_apr from public.aprs a where a.id = cancelar_apr.apr;
  if not found or not (privado.pode_gerir_os() and privado.pode_ver_cliente(v_apr.cliente_id)) then
    raise exception 'APR não encontrada.' using errcode = 'P0002';
  end if;
  if char_length(btrim(coalesce(motivo, ''))) < 3 then
    raise exception 'Informe o motivo.' using errcode = '23514';
  end if;
  update public.aprs a
     set status = 'cancelada', cancelada_em = now(), motivo_cancelamento = btrim(motivo)
   where a.id = v_apr.id;
end
$$;

revoke execute on function public.cancelar_apr(uuid, text) from public, anon;
grant execute on function public.cancelar_apr(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: a assinatura do técnico (pasta clientes/<cliente>/apr/<apr>/).
-- -----------------------------------------------------------------------------
create or replace function privado.apr_do_caminho(caminho text)
returns uuid
language sql immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(caminho))[1] = 'clientes'
     and (storage.foldername(caminho))[3] = 'apr'
     and (storage.foldername(caminho))[4] ~ '^[0-9a-f-]{36}$'
    then (storage.foldername(caminho))[4]::uuid
  end
$$;

grant execute on function privado.apr_do_caminho(text) to authenticated;

-- Enviar: o técnico, para a pasta da APR em que está, com o próprio id no nome.
create policy "técnico envia assinatura da APR" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'arquivos'
    and privado.apr_e_minha(privado.apr_do_caminho(name))
    and storage.filename(name) like (select auth.uid())::text || '-%'
  );

-- Baixar: quem vê a APR (escritório e os técnicos dela).
create policy "ver assinaturas da APR" on storage.objects for select to authenticated
  using (
    bucket_id = 'arquivos'
    and privado.apr_do_caminho(name) is not null
    and exists (select 1 from public.aprs a where a.id = privado.apr_do_caminho(name))
  );
