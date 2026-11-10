-- =============================================================================
-- CRM com WhatsApp (API oficial da Meta, Cloud API).
--
-- Quem usa o CRM: o Administrador sempre; os outros perfis só com a permissão
-- "atende WhatsApp" ligada pelo admin na tela de usuários. O operador nunca.
--
-- Quem vê cada conversa:
--   Administrador   todas; é quem transfere entre os atendentes.
--   ADM             o primeiro contato (conversa sem responsável), as do setor
--                   administrativo (documentação, certificados, agendamento de
--                   contrato) e as que estão com ele.
--   Financeiro,     só as que estão com ele (o responsável).
--   Vendedor e
--   Recepção
--
-- Como os dados chegam: a Meta chama a Edge Function "whatsapp" (webhook), que
-- grava tudo pelas funções crm_receber_mensagem / crm_atualizar_status, liberadas
-- só para o servidor. O navegador nunca grava mensagem direto: envia pela Edge
-- Function "crm", que guarda o token da Meta. As mudanças de responsável, status
-- e cliente passam pelas funções crm_* abaixo, que conferem as regras.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permissão no perfil
-- -----------------------------------------------------------------------------

alter table public.perfis add column atende_whatsapp boolean not null default false;
comment on column public.perfis.atende_whatsapp is
  'Pode usar o CRM do WhatsApp (o administrador sempre pode; o operador nunca).';
grant update (atende_whatsapp) on public.perfis to authenticated;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------

create type public.status_conversa as enum ('aberta', 'pendente', 'finalizada');
-- Setor que cuida do assunto. Por enquanto só o administrativo muda quem vê;
-- os outros já ficam prontos para a distribuição por setor.
create type public.setor_atendimento as enum ('administrativo', 'comercial', 'financeiro', 'operacional');
create type public.status_mensagem as enum ('recebida', 'pendente', 'enviada', 'entregue', 'lida', 'falhou');

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

-- Números comerciais ligados à Meta. O token NÃO fica aqui: fica nos segredos
-- das Edge Functions. Já aceita mais de um número no futuro.
create table public.wa_numeros (
  id               uuid primary key default gen_random_uuid(),
  phone_number_id  text not null unique check (phone_number_id ~ '^\d{5,30}$'),
  waba_id          text not null check (waba_id ~ '^\d{5,30}$'),
  numero_exibicao  text not null,
  nome             text not null,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now()
);

-- Quem fala com a empresa. wa_id = número no formato da Meta (55 + DDD + número).
create table public.wa_contatos (
  id            uuid primary key default gen_random_uuid(),
  wa_id         text not null unique check (wa_id ~ '^\d{8,20}$'),
  nome_perfil   text,
  cliente_id    uuid references public.clientes (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index wa_contatos_cliente_idx on public.wa_contatos (cliente_id);

-- Uma conversa por contato em cada número: o histórico fica todo junto e o
-- atendimento abre e fecha (status) quantas vezes for preciso.
create table public.wa_conversas (
  id                     uuid primary key default gen_random_uuid(),
  numero_id              uuid not null references public.wa_numeros (id),
  contato_id             uuid not null references public.wa_contatos (id) on delete cascade,
  status                 public.status_conversa not null default 'aberta',
  responsavel_id         uuid references public.perfis (id),
  -- Quem cuidava antes de finalizar: a tela sugere devolver para ele quando o cliente volta.
  ultimo_responsavel_id  uuid references public.perfis (id),
  setor                  public.setor_atendimento,
  nao_lidas              int not null default 0 check (nao_lidas >= 0),
  -- Última mensagem do cliente: abre a janela de 24 horas da Meta.
  ultima_entrada_em      timestamptz,
  ultima_mensagem_em     timestamptz,
  ultima_mensagem_previa text,
  finalizada_em          timestamptz,
  criado_em              timestamptz not null default now(),

  unique (numero_id, contato_id)
);

create index wa_conversas_lista_idx on public.wa_conversas (ultima_mensagem_em desc nulls last);
create index wa_conversas_responsavel_idx on public.wa_conversas (responsavel_id);

create table public.wa_mensagens (
  id              uuid primary key default gen_random_uuid(),
  conversa_id     uuid not null references public.wa_conversas (id) on delete cascade,
  -- Id da mensagem na Meta. Único: o mesmo webhook chegando duas vezes não duplica.
  wamid           text unique,
  direcao         text not null check (direcao in ('entrada', 'saida')),
  tipo            text not null check (tipo in (
                    'texto', 'imagem', 'audio', 'video', 'documento', 'figurinha',
                    'localizacao', 'contato', 'reacao', 'botao', 'template', 'outro')),
  texto           text,
  -- Mídia: id na Meta (vale por pouco tempo) e a cópia guardada no nosso Storage.
  midia_id        text,
  midia_caminho   text,
  midia_mime      text,
  midia_nome      text,
  midia_tamanho   bigint,
  -- Mensagem do cliente que esta responde (citação), pelo id da Meta.
  responde_wamid  text,
  status          public.status_mensagem not null,
  erro            text,
  -- Quem da equipe mandou (nulo nas mensagens do cliente).
  enviada_por     uuid references public.perfis (id),
  -- Hora da mensagem segundo a Meta (ou do envio pelo sistema).
  enviada_em      timestamptz not null default now(),
  status_em       timestamptz,
  criado_em       timestamptz not null default now()
);

create index wa_mensagens_conversa_idx on public.wa_mensagens (conversa_id, enviada_em desc);
create index wa_mensagens_midia_pendente_idx on public.wa_mensagens (conversa_id)
  where midia_id is not null and midia_caminho is null;

-- Webhook bruto, como chegou: auditoria e reprocessamento. Apagado depois de 90 dias.
create table public.wa_eventos (
  id            uuid primary key default gen_random_uuid(),
  -- SHA-256 do corpo: a Meta reenvia o mesmo evento quando não recebe resposta.
  hash          text not null unique,
  corpo         jsonb not null,
  recebido_em   timestamptz not null default now(),
  processado_em timestamptz,
  tentativas    int not null default 0,
  erro          text
);

create index wa_eventos_recebido_idx on public.wa_eventos (recebido_em);

create table public.wa_notas (
  id          uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.wa_conversas (id) on delete cascade,
  autor_id    uuid not null default auth.uid() references public.perfis (id),
  texto       text not null check (char_length(trim(texto)) between 1 and 4000),
  criado_em   timestamptz not null default now()
);

create index wa_notas_conversa_idx on public.wa_notas (conversa_id, criado_em);

create table public.wa_etiquetas (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (char_length(trim(nome)) between 1 and 40),
  cor       text not null default 'verde' check (cor in (
              'verde', 'azul', 'amarelo', 'laranja', 'vermelho', 'roxo', 'cinza')),
  criado_em timestamptz not null default now()
);

create unique index wa_etiquetas_nome_idx on public.wa_etiquetas (lower(trim(nome)));

create table public.wa_conversa_etiquetas (
  conversa_id uuid not null references public.wa_conversas (id) on delete cascade,
  etiqueta_id uuid not null references public.wa_etiquetas (id) on delete cascade,
  primary key (conversa_id, etiqueta_id)
);

create table public.wa_transferencias (
  id                    uuid primary key default gen_random_uuid(),
  conversa_id           uuid not null references public.wa_conversas (id) on delete cascade,
  responsavel_anterior  uuid references public.perfis (id),
  responsavel_novo      uuid references public.perfis (id),
  setor                 public.setor_atendimento,
  motivo                text,
  feita_por             uuid references public.perfis (id),
  em                    timestamptz not null default now()
);

create index wa_transferencias_conversa_idx on public.wa_transferencias (conversa_id, em desc);

-- -----------------------------------------------------------------------------
-- Funções das regras de acesso
-- -----------------------------------------------------------------------------

-- Pode abrir o CRM: usuário ativo, admin ou com a permissão ligada, e nunca operador.
create function privado.pode_usar_crm()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select p.ativo and p.papel <> 'operador' and (p.papel = 'admin' or p.atende_whatsapp)
      from public.perfis p where p.id = (select auth.uid())
  ), false)
$$;

-- Regra de quem vê uma conversa, a partir do responsável e do setor dela.
create function privado.pode_ver_conversa(responsavel_id uuid, setor public.setor_atendimento)
returns boolean
language sql stable
set search_path = ''
as $$
  select privado.pode_usar_crm() and (
    privado.e_admin()
    or responsavel_id = (select auth.uid())
    or (privado.meu_papel() = 'administrativo'
        and (responsavel_id is null or setor = 'administrativo'))
  )
$$;

-- Mesma regra, pelo id (para mensagens, notas, etiquetas e arquivos da conversa).
create function privado.pode_ver_conversa_id(conversa uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wa_conversas c
     where c.id = conversa and privado.pode_ver_conversa(c.responsavel_id, c.setor)
  )
$$;

-- Pasta <recebidas|enviadas>/<conversa_id>/… no Storage → o 2º pedaço é a conversa.
create function privado.conversa_do_caminho(caminho text)
returns uuid
language sql immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(caminho))[1] in ('recebidas', 'enviadas')
     and (storage.foldername(caminho))[2] ~ '^[0-9a-f-]{36}$'
    then (storage.foldername(caminho))[2]::uuid
  end
$$;

-- Telefone do Brasil, como fica no cadastro (DDD + número, 10 ou 11 dígitos), nas duas
-- formas possíveis: a Meta às vezes manda o celular sem o 9 da frente (55 48 8860-8723).
create function privado.telefones_do_wa_id(wa_id text)
returns text[]
language sql immutable
set search_path = ''
as $$
  with local as (
    select case when wa_id ~ '^55\d{10,11}$' then substr(wa_id, 3) end as n
  )
  select case
    when n is null then array[]::text[]
    -- 11 dígitos com o 9: também procura sem ele.
    when length(n) = 11 and substr(n, 3, 1) = '9' then array[n, substr(n, 1, 2) || substr(n, 4)]
    -- 10 dígitos de celular (começa com 6 a 9): também procura com o 9.
    when length(n) = 10 and substr(n, 3, 1) between '6' and '9' then array[n, substr(n, 1, 2) || '9' || substr(n, 3)]
    else array[n]
  end
  from local
$$;

-- Cliente com este WhatsApp, se houver exatamente um (dois cadastros com o mesmo
-- número ficam para a pessoa escolher, para não ligar à pessoa errada).
create function privado.cliente_do_wa_id(wa_id text)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  with candidatos as (
    select c.id from public.clientes c
     where c.anonimizado_em is null and c.ativo
       and (c.whatsapp = any (privado.telefones_do_wa_id(wa_id))
            or c.telefone = any (privado.telefones_do_wa_id(wa_id)))
    union
    select cc.cliente_id from public.contatos_cliente cc
      join public.clientes c on c.id = cc.cliente_id
     where c.anonimizado_em is null and c.ativo
       and cc.telefone = any (privado.telefones_do_wa_id(wa_id))
  )
  select case when count(*) = 1 then min(id::text)::uuid end from candidatos
$$;

revoke execute on all functions in schema privado from public;
grant execute on all functions in schema privado to authenticated;

-- -----------------------------------------------------------------------------
-- Permissões das tabelas (RLS)
-- -----------------------------------------------------------------------------

alter table public.wa_numeros enable row level security;
alter table public.wa_contatos enable row level security;
alter table public.wa_conversas enable row level security;
alter table public.wa_mensagens enable row level security;
alter table public.wa_eventos enable row level security;
alter table public.wa_notas enable row level security;
alter table public.wa_etiquetas enable row level security;
alter table public.wa_conversa_etiquetas enable row level security;
alter table public.wa_transferencias enable row level security;

revoke all on public.wa_numeros, public.wa_contatos, public.wa_conversas, public.wa_mensagens,
  public.wa_eventos, public.wa_notas, public.wa_etiquetas, public.wa_conversa_etiquetas,
  public.wa_transferencias from anon, authenticated;

grant all on public.wa_numeros, public.wa_contatos, public.wa_conversas, public.wa_mensagens,
  public.wa_eventos, public.wa_notas, public.wa_etiquetas, public.wa_conversa_etiquetas,
  public.wa_transferencias to service_role;

-- Números: quem usa o CRM vê; só o servidor cadastra.
grant select on public.wa_numeros to authenticated;
create policy "quem usa o crm vê os números" on public.wa_numeros for select to authenticated
  using (privado.pode_usar_crm());

-- Contatos: só os das conversas que a pessoa vê.
grant select on public.wa_contatos to authenticated;
create policy "contatos das minhas conversas" on public.wa_contatos for select to authenticated
  using (exists (
    select 1 from public.wa_conversas c
     where c.contato_id = wa_contatos.id and privado.pode_ver_conversa(c.responsavel_id, c.setor)
  ));

-- Conversas: leitura pela regra; mudanças só pelas funções crm_* (que conferem tudo).
grant select on public.wa_conversas to authenticated;
create policy "conversas que posso ver" on public.wa_conversas for select to authenticated
  using (privado.pode_ver_conversa(responsavel_id, setor));

grant select on public.wa_mensagens to authenticated;
create policy "mensagens das minhas conversas" on public.wa_mensagens for select to authenticated
  using (privado.pode_ver_conversa_id(conversa_id));

-- Eventos brutos: ninguém pelo navegador (só o servidor, que ignora o RLS).

grant select, insert, delete on public.wa_notas to authenticated;
create policy "notas das minhas conversas" on public.wa_notas for select to authenticated
  using (privado.pode_ver_conversa_id(conversa_id));
create policy "anotar nas minhas conversas" on public.wa_notas for insert to authenticated
  with check (autor_id = (select auth.uid()) and privado.pode_ver_conversa_id(conversa_id));
create policy "apagar a própria nota" on public.wa_notas for delete to authenticated
  using ((autor_id = (select auth.uid()) or privado.e_admin()) and privado.pode_ver_conversa_id(conversa_id));

-- Etiquetas: todos do CRM usam; só o admin cria, muda e apaga.
grant select, insert, update, delete on public.wa_etiquetas to authenticated;
create policy "quem usa o crm vê as etiquetas" on public.wa_etiquetas for select to authenticated
  using (privado.pode_usar_crm());
create policy "admin cria etiquetas" on public.wa_etiquetas for insert to authenticated
  with check (privado.e_admin());
create policy "admin altera etiquetas" on public.wa_etiquetas for update to authenticated
  using (privado.e_admin()) with check (privado.e_admin());
create policy "admin apaga etiquetas" on public.wa_etiquetas for delete to authenticated
  using (privado.e_admin());

grant select, insert, delete on public.wa_conversa_etiquetas to authenticated;
create policy "etiquetas das minhas conversas" on public.wa_conversa_etiquetas for select to authenticated
  using (privado.pode_ver_conversa_id(conversa_id));
create policy "etiquetar as minhas conversas" on public.wa_conversa_etiquetas for insert to authenticated
  with check (privado.pode_ver_conversa_id(conversa_id));
create policy "tirar etiqueta das minhas conversas" on public.wa_conversa_etiquetas for delete to authenticated
  using (privado.pode_ver_conversa_id(conversa_id));

grant select on public.wa_transferencias to authenticated;
create policy "transferências das minhas conversas" on public.wa_transferencias for select to authenticated
  using (privado.pode_ver_conversa_id(conversa_id));

-- -----------------------------------------------------------------------------
-- Ações da equipe (chamadas pelo navegador)
-- -----------------------------------------------------------------------------

-- Transferir para outra pessoa (ou só mudar o setor). O admin transfere qualquer
-- conversa. O ADM, que faz o primeiro atendimento, encaminha as que ele vê.
-- Responsável nulo = devolve para o primeiro atendimento.
create function public.crm_transferir(
  conversa uuid, responsavel uuid, novo_setor public.setor_atendimento default null, motivo text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_conversa public.wa_conversas;
begin
  select * into v_conversa from public.wa_conversas where id = conversa for update;
  if v_conversa.id is null or not privado.pode_ver_conversa(v_conversa.responsavel_id, v_conversa.setor) then
    raise exception 'Conversa não encontrada.' using errcode = '42501';
  end if;
  if not (privado.e_admin() or privado.meu_papel() = 'administrativo') then
    raise exception 'Somente o administrador e o ADM transferem conversas.' using errcode = '42501';
  end if;
  if responsavel is not null and not exists (
    select 1 from public.perfis p
     where p.id = responsavel and p.ativo and p.papel <> 'operador'
       and (p.papel = 'admin' or p.atende_whatsapp)
  ) then
    raise exception 'Essa pessoa não atende pelo WhatsApp. Ligue a permissão na tela de usuários.'
      using errcode = '23514';
  end if;

  update public.wa_conversas
     set responsavel_id = responsavel,
         setor = novo_setor,
         ultimo_responsavel_id = coalesce(v_conversa.responsavel_id, v_conversa.ultimo_responsavel_id)
   where id = conversa;

  insert into public.wa_transferencias
    (conversa_id, responsavel_anterior, responsavel_novo, setor, motivo, feita_por)
  values (conversa, v_conversa.responsavel_id, responsavel, novo_setor, nullif(trim(motivo), ''), auth.uid());
end
$$;

-- Assumir o atendimento (quem vê a conversa e ela está sem responsável, ou o admin).
create function public.crm_assumir(conversa uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_conversa public.wa_conversas;
begin
  select * into v_conversa from public.wa_conversas where id = conversa for update;
  if v_conversa.id is null or not privado.pode_ver_conversa(v_conversa.responsavel_id, v_conversa.setor) then
    raise exception 'Conversa não encontrada.' using errcode = '42501';
  end if;
  if v_conversa.responsavel_id = auth.uid() then return; end if;
  if v_conversa.responsavel_id is not null and not privado.e_admin() then
    raise exception 'Esta conversa já tem responsável. Peça ao administrador para transferir.'
      using errcode = '42501';
  end if;

  update public.wa_conversas set responsavel_id = auth.uid() where id = conversa;
  insert into public.wa_transferencias (conversa_id, responsavel_anterior, responsavel_novo, setor, feita_por)
  values (conversa, v_conversa.responsavel_id, auth.uid(), v_conversa.setor, auth.uid());
end
$$;

create function public.crm_status(conversa uuid, novo_status public.status_conversa)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.pode_ver_conversa_id(conversa) then
    raise exception 'Conversa não encontrada.' using errcode = '42501';
  end if;
  update public.wa_conversas
     set status = novo_status,
         finalizada_em = case when novo_status = 'finalizada' then now() end,
         nao_lidas = case when novo_status = 'finalizada' then 0 else nao_lidas end
   where id = conversa;
end
$$;

-- Liga (ou desliga, com cliente nulo) o contato a um cliente do cadastro.
create function public.crm_vincular_cliente(conversa uuid, cliente uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.pode_ver_conversa_id(conversa) then
    raise exception 'Conversa não encontrada.' using errcode = '42501';
  end if;
  if cliente is not null and not privado.pode_ver_cliente(cliente) then
    raise exception 'Cliente não encontrado.' using errcode = '42501';
  end if;
  update public.wa_contatos
     set cliente_id = cliente, atualizado_em = now()
   where id = (select contato_id from public.wa_conversas where id = conversa);
end
$$;

-- Zera o contador de não lidas (a confirmação de leitura para o cliente é a
-- Edge Function "crm" que manda).
create function public.crm_marcar_lida(conversa uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.pode_ver_conversa_id(conversa) then
    raise exception 'Conversa não encontrada.' using errcode = '42501';
  end if;
  update public.wa_conversas set nao_lidas = 0 where id = conversa and nao_lidas > 0;
end
$$;

revoke execute on function public.crm_transferir(uuid, uuid, public.setor_atendimento, text),
  public.crm_assumir(uuid), public.crm_status(uuid, public.status_conversa),
  public.crm_vincular_cliente(uuid, uuid), public.crm_marcar_lida(uuid) from public, anon;
grant execute on function public.crm_transferir(uuid, uuid, public.setor_atendimento, text),
  public.crm_assumir(uuid), public.crm_status(uuid, public.status_conversa),
  public.crm_vincular_cliente(uuid, uuid), public.crm_marcar_lida(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Gravação pelo servidor (Edge Functions). Ninguém pelo navegador chama.
-- -----------------------------------------------------------------------------

-- Mensagem recebida do cliente. Idempotente: o mesmo wamid duas vezes não duplica
-- nem soma não lida. Devolve a conversa e se a mensagem é nova (para o push).
create function public.crm_receber_mensagem(
  p_phone_number_id text,
  p_wa_id text,
  p_nome_perfil text,
  p_wamid text,
  p_tipo text,
  p_texto text,
  p_midia_id text,
  p_midia_mime text,
  p_midia_nome text,
  p_responde_wamid text,
  p_enviada_em timestamptz
)
returns table (conversa_id uuid, mensagem_id uuid, nova boolean)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_numero   uuid;
  v_contato  uuid;
  v_conversa public.wa_conversas;
  v_mensagem uuid;
  v_previa   text;
begin
  select id into v_numero from public.wa_numeros where phone_number_id = p_phone_number_id and ativo;
  if v_numero is null then
    raise exception 'Número % não cadastrado em wa_numeros.', p_phone_number_id using errcode = 'P0002';
  end if;

  insert into public.wa_contatos (wa_id, nome_perfil, cliente_id)
  values (p_wa_id, nullif(trim(p_nome_perfil), ''), privado.cliente_do_wa_id(p_wa_id))
  on conflict (wa_id) do update
     set nome_perfil = coalesce(excluded.nome_perfil, wa_contatos.nome_perfil),
         -- Contato antigo sem cliente: tenta de novo (o cliente pode ter sido cadastrado depois).
         cliente_id = coalesce(wa_contatos.cliente_id, privado.cliente_do_wa_id(p_wa_id)),
         atualizado_em = now()
  returning id into v_contato;

  insert into public.wa_conversas (numero_id, contato_id)
  values (v_numero, v_contato)
  on conflict (numero_id, contato_id) do nothing;
  select * into v_conversa from public.wa_conversas
   where numero_id = v_numero and contato_id = v_contato for update;

  insert into public.wa_mensagens
    (conversa_id, wamid, direcao, tipo, texto, midia_id, midia_mime, midia_nome, responde_wamid, status, enviada_em)
  values
    (v_conversa.id, p_wamid, 'entrada', p_tipo, p_texto, p_midia_id, p_midia_mime, p_midia_nome,
     p_responde_wamid, 'recebida', p_enviada_em)
  on conflict (wamid) do nothing
  returning id into v_mensagem;

  if v_mensagem is null then
    -- Já tinha recebido (webhook repetido).
    return query select v_conversa.id, (select m.id from public.wa_mensagens m where m.wamid = p_wamid), false;
    return;
  end if;

  v_previa := left(coalesce(nullif(trim(p_texto), ''), case p_tipo
    when 'imagem' then '📷 Foto' when 'audio' then '🎤 Áudio' when 'video' then '🎥 Vídeo'
    when 'documento' then '📄 ' || coalesce(p_midia_nome, 'Documento')
    when 'figurinha' then 'Figurinha' when 'localizacao' then '📍 Localização'
    when 'contato' then '👤 Contato' else 'Mensagem' end), 200);

  update public.wa_conversas
     set nao_lidas = nao_lidas + case when p_tipo = 'reacao' then 0 else 1 end,
         ultima_entrada_em = greatest(coalesce(ultima_entrada_em, p_enviada_em), p_enviada_em),
         ultima_mensagem_em = greatest(coalesce(ultima_mensagem_em, p_enviada_em), p_enviada_em),
         ultima_mensagem_previa = v_previa,
         -- Cliente voltou depois de finalizar: novo atendimento, começa no primeiro contato.
         status = case when status = 'finalizada' then 'aberta'::public.status_conversa else status end,
         responsavel_id = case when status = 'finalizada' then null else responsavel_id end,
         setor = case when status = 'finalizada' then null else setor end,
         ultimo_responsavel_id = case when status = 'finalizada'
                                      then coalesce(responsavel_id, ultimo_responsavel_id)
                                      else ultimo_responsavel_id end,
         finalizada_em = case when status = 'finalizada' then null else finalizada_em end
   where id = v_conversa.id;

  return query select v_conversa.id, v_mensagem, true;
end
$$;

-- Status de uma mensagem enviada (enviada → entregue → lida, ou falhou). Os eventos da
-- Meta podem chegar fora de ordem: o status só anda para a frente.
create function public.crm_atualizar_status(
  p_wamid text, p_status public.status_mensagem, p_em timestamptz, p_erro text
)
returns void
language sql security definer
set search_path = ''
as $$
  update public.wa_mensagens
     set status = p_status,
         status_em = p_em,
         erro = case when p_status = 'falhou' then p_erro else erro end
   where wamid = p_wamid
     and direcao = 'saida'
     and (p_status = 'falhou'
          or array_position(array['pendente', 'enviada', 'entregue', 'lida']::public.status_mensagem[], p_status)
           > coalesce(array_position(array['pendente', 'enviada', 'entregue', 'lida']::public.status_mensagem[], status), 0))
     and status <> 'falhou'
$$;

-- Mensagem que a equipe está mandando: grava antes de chamar a Meta (status pendente),
-- para não perder nada se a conexão cair. Quem responde uma conversa sem responsável
-- passa a ser o responsável.
create function public.crm_registrar_envio(
  p_conversa uuid, p_usuario uuid, p_tipo text, p_texto text,
  p_midia_caminho text, p_midia_mime text, p_midia_nome text, p_midia_tamanho bigint
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id          uuid;
  v_previa      text;
  v_responsavel uuid;
  v_setor       public.setor_atendimento;
begin
  select responsavel_id, setor into v_responsavel, v_setor
    from public.wa_conversas where id = p_conversa for update;

  insert into public.wa_mensagens
    (conversa_id, direcao, tipo, texto, midia_caminho, midia_mime, midia_nome, midia_tamanho,
     status, enviada_por)
  values
    (p_conversa, 'saida', p_tipo, p_texto, p_midia_caminho, p_midia_mime, p_midia_nome, p_midia_tamanho,
     'pendente', p_usuario)
  returning id into v_id;

  v_previa := left(coalesce(nullif(trim(p_texto), ''), case p_tipo
    when 'imagem' then '📷 Foto' when 'audio' then '🎤 Áudio' when 'video' then '🎥 Vídeo'
    when 'documento' then '📄 ' || coalesce(p_midia_nome, 'Documento') else 'Mensagem' end), 200);

  update public.wa_conversas
     set ultima_mensagem_em = now(),
         ultima_mensagem_previa = v_previa,
         nao_lidas = 0,
         status = case when status = 'finalizada' then 'aberta'::public.status_conversa else status end,
         finalizada_em = case when status = 'finalizada' then null else finalizada_em end,
         responsavel_id = coalesce(responsavel_id, p_usuario)
   where id = p_conversa;

  if v_responsavel is null then
    insert into public.wa_transferencias (conversa_id, responsavel_anterior, responsavel_novo, setor, motivo, feita_por)
    values (p_conversa, null, p_usuario, v_setor, 'Respondeu o primeiro contato', p_usuario);
  end if;
  return v_id;
end
$$;

revoke execute on function
  public.crm_receber_mensagem(text, text, text, text, text, text, text, text, text, text, timestamptz),
  public.crm_atualizar_status(text, public.status_mensagem, timestamptz, text),
  public.crm_registrar_envio(uuid, uuid, text, text, text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function
  public.crm_receber_mensagem(text, text, text, text, text, text, text, text, text, text, timestamptz),
  public.crm_atualizar_status(text, public.status_mensagem, timestamptz, text),
  public.crm_registrar_envio(uuid, uuid, text, text, text, text, text, bigint)
  to service_role;

-- -----------------------------------------------------------------------------
-- Storage: fotos, áudios, vídeos e documentos das conversas (bucket privado)
-- Pastas: recebidas/<conversa>/… (o servidor grava) e enviadas/<conversa>/… (a equipe envia).
-- Limite de 100 MB, que é o maior arquivo (documento) aceito pela Meta.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('whatsapp', 'whatsapp', false, 100 * 1024 * 1024);

create policy "baixar arquivos das minhas conversas" on storage.objects for select to authenticated
  using (bucket_id = 'whatsapp' and privado.pode_ver_conversa_id(privado.conversa_do_caminho(name)));

create policy "enviar arquivos nas minhas conversas" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'whatsapp'
    and (storage.foldername(name))[1] = 'enviadas'
    and privado.pode_ver_conversa_id(privado.conversa_do_caminho(name))
  );

-- -----------------------------------------------------------------------------
-- Tempo real: a tela recebe as mensagens e conversas novas na hora (respeitando o RLS).
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table public.wa_conversas, public.wa_mensagens;

-- -----------------------------------------------------------------------------
-- LGPD: o webhook bruto (que repete as mensagens) é apagado depois de 90 dias.
-- O histórico das conversas continua guardado.
-- -----------------------------------------------------------------------------

select cron.schedule(
  'limpar-eventos-whatsapp',
  '40 3 * * *',
  $$delete from public.wa_eventos where recebido_em < now() - interval '90 days' and processado_em is not null$$
);
