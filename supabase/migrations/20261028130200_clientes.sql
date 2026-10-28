-- =============================================================================
-- Clientes: cadastro, endereços, contatos, atendimentos e troca de vendedor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Validação de CPF e CNPJ (dígitos verificadores)
-- A tela também valida, mas a regra final fica no banco.
-- -----------------------------------------------------------------------------

create function privado.cpf_valido(cpf text)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  d    int[];
  soma int;
  dv   int;
begin
  if cpf !~ '^\d{11}$' or cpf ~ '^(\d)\1{10}$' then
    return false;
  end if;
  d := array(select substr(cpf, i, 1)::int from generate_series(1, 11) i);

  soma := 0;
  for i in 1..9 loop soma := soma + d[i] * (11 - i); end loop;
  dv := (soma * 10) % 11 % 10;
  if dv <> d[10] then return false; end if;

  soma := 0;
  for i in 1..10 loop soma := soma + d[i] * (12 - i); end loop;
  dv := (soma * 10) % 11 % 10;
  return dv = d[11];
end
$$;

-- Aceita também o CNPJ alfanumérico (letras nas 12 primeiras posições),
-- adotado pela Receita Federal a partir de julho de 2026.
-- Cada caractere vale (código ASCII - 48): '0'..'9' = 0..9, 'A' = 17, 'B' = 18...
create function privado.cnpj_valido(cnpj text)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  v     int[];
  pesos int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  soma  int;
  resto int;
  dv    int;
begin
  if cnpj !~ '^[0-9A-Z]{12}\d{2}$' or cnpj ~ '^(\d)\1{13}$' then
    return false;
  end if;
  v := array(select ascii(substr(cnpj, i, 1)) - 48 from generate_series(1, 14) i);

  -- 1º dígito: pesos 5,4,3,2,9,...,2 (os 12 últimos da lista)
  soma := 0;
  for i in 1..12 loop soma := soma + v[i] * pesos[i + 1]; end loop;
  resto := soma % 11;
  dv := case when resto < 2 then 0 else 11 - resto end;
  if dv <> v[13] then return false; end if;

  -- 2º dígito: pesos 6,5,4,3,2,9,...,2
  soma := 0;
  for i in 1..13 loop soma := soma + v[i] * pesos[i]; end loop;
  resto := soma % 11;
  dv := case when resto < 2 then 0 else 11 - resto end;
  return dv = v[14];
end
$$;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

create type public.tipo_pessoa as enum ('PF', 'PJ');

create table public.clientes (
  id                      uuid primary key default gen_random_uuid(),
  tipo_pessoa             public.tipo_pessoa not null,
  nome                    text not null check (char_length(trim(nome)) between 2 and 200),
  nome_fantasia           text,
  -- Só números (CPF) ou números e letras maiúsculas (CNPJ), sem pontuação.
  cpf_cnpj                text unique,
  inscricao_estadual      text,
  email                   text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefone                text check (telefone ~ '^\d{10,11}$'),
  whatsapp                text check (whatsapp ~ '^\d{10,11}$'),
  vendedor_responsavel_id uuid references public.perfis (id),
  origem                  text,
  observacoes             text,
  ativo                   boolean not null default true,
  anonimizado_em          timestamptz,
  -- Preenchido pelo banco: nome, documento e telefones juntos, sem acento, para a busca.
  busca_texto             text not null default '',
  criado_em               timestamptz not null default now(),
  criado_por              uuid references public.perfis (id),
  atualizado_em           timestamptz not null default now(),
  atualizado_por          uuid references public.perfis (id),

  constraint cpf_cnpj_valido check (
    cpf_cnpj is null
    or (tipo_pessoa = 'PF' and privado.cpf_valido(cpf_cnpj))
    or (tipo_pessoa = 'PJ' and privado.cnpj_valido(cpf_cnpj))
  ),
  constraint nome_fantasia_so_pj check (tipo_pessoa = 'PJ' or nome_fantasia is null)
);

create index clientes_busca_idx on public.clientes using gin (busca_texto extensions.gin_trgm_ops);
create index clientes_vendedor_idx on public.clientes (vendedor_responsavel_id);

create table public.enderecos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes (id) on delete cascade,
  apelido        text,
  cep            text check (cep ~ '^\d{8}$'),
  logradouro     text not null,
  numero         text,
  complemento    text,
  bairro         text,
  cidade         text not null,
  uf             char(2) not null check (uf ~ '^[A-Z]{2}$'),
  principal      boolean not null default false,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references public.perfis (id),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id)
);

create index enderecos_cliente_idx on public.enderecos (cliente_id);
create unique index enderecos_um_principal on public.enderecos (cliente_id) where principal;

create table public.contatos_cliente (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes (id) on delete cascade,
  nome           text not null check (char_length(trim(nome)) between 2 and 120),
  cargo          text,
  telefone       text check (telefone ~ '^\d{10,11}$'),
  email          text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  principal      boolean not null default false,
  observacoes    text,
  criado_em      timestamptz not null default now(),
  criado_por     uuid references public.perfis (id),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id)
);

create index contatos_cliente_idx on public.contatos_cliente (cliente_id);

create type public.canal_atendimento as enum ('telefone', 'whatsapp', 'presencial', 'email', 'outro');

create table public.atendimentos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes (id) on delete cascade,
  usuario_id     uuid not null default auth.uid() references public.perfis (id),
  data_hora      timestamptz not null default now(),
  canal          public.canal_atendimento not null,
  resumo         text not null check (char_length(trim(resumo)) between 2 and 4000),
  criado_em      timestamptz not null default now(),
  criado_por     uuid references public.perfis (id),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id)
);

create index atendimentos_cliente_idx on public.atendimentos (cliente_id, data_hora desc);

create table public.transferencias_cliente (
  id                   uuid primary key default gen_random_uuid(),
  cliente_id           uuid not null references public.clientes (id) on delete cascade,
  vendedor_anterior_id uuid references public.perfis (id),
  vendedor_novo_id     uuid references public.perfis (id),
  motivo               text,
  feito_por            uuid references public.perfis (id),
  em                   timestamptz not null default now()
);

create index transferencias_cliente_idx on public.transferencias_cliente (cliente_id, em desc);

-- -----------------------------------------------------------------------------
-- Regras automáticas (triggers)
-- -----------------------------------------------------------------------------

create function privado.antes_salvar_cliente()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- Vendedor responsável precisa ser um usuário ativo que não seja da recepção.
  if new.vendedor_responsavel_id is not null
     and (tg_op = 'INSERT' or new.vendedor_responsavel_id is distinct from old.vendedor_responsavel_id)
     and not exists (
       select 1 from public.perfis p
       where p.id = new.vendedor_responsavel_id and p.ativo and p.papel <> 'recepcao'
     ) then
    raise exception 'O vendedor responsável precisa ser um usuário ativo da equipe comercial.'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    -- Troca de vendedor: só o admin. Exceção: definir o primeiro vendedor de um
    -- cliente que ainda não tem (recepção e financeiro também podem).
    if new.vendedor_responsavel_id is distinct from old.vendedor_responsavel_id then
      if not (
        privado.e_admin()
        or (old.vendedor_responsavel_id is null
            and (privado.tem_acesso_total() or privado.meu_papel() = 'recepcao'))
      ) then
        raise exception 'Somente o administrador pode trocar o vendedor responsável.'
          using errcode = '42501';
      end if;

      insert into public.transferencias_cliente
        (cliente_id, vendedor_anterior_id, vendedor_novo_id, motivo, feito_por)
      values (
        new.id, old.vendedor_responsavel_id, new.vendedor_responsavel_id,
        nullif(current_setting('app.motivo_transferencia', true), ''), auth.uid()
      );
    end if;

    if new.anonimizado_em is distinct from old.anonimizado_em
       and current_setting('app.anonimizando', true) is distinct from 'sim' then
      raise exception 'Use a função de anonimização.' using errcode = '42501';
    end if;
  end if;

  new.busca_texto := privado.sem_acento(
    concat_ws(' ', new.nome, new.nome_fantasia, new.cpf_cnpj, new.telefone, new.whatsapp)
  );
  return new;
end
$$;

create function privado.antes_salvar_endereco()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Só um endereço principal por cliente: ao marcar um, os outros deixam de ser.
  if new.principal then
    update public.enderecos
       set principal = false
     where cliente_id = new.cliente_id and id <> new.id and principal;
  end if;
  return new;
end
$$;

create function privado.antes_salvar_atendimento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Quem registra é sempre o usuário logado (não dá para registrar em nome de outro).
  if tg_op = 'INSERT' then
    new.usuario_id := auth.uid();
  else
    new.usuario_id := old.usuario_id;
    new.cliente_id := old.cliente_id;
  end if;
  return new;
end
$$;

revoke execute on function privado.antes_salvar_cliente() from public, authenticated;

create trigger carimbar before insert or update on public.clientes
  for each row execute function privado.carimbar();
create trigger antes_salvar before insert or update on public.clientes
  for each row execute function privado.antes_salvar_cliente();
create trigger auditoria after insert or update or delete on public.clientes
  for each row execute function privado.registrar_auditoria();

create trigger carimbar before insert or update on public.enderecos
  for each row execute function privado.carimbar();
create trigger antes_salvar before insert or update on public.enderecos
  for each row execute function privado.antes_salvar_endereco();
create trigger auditoria after insert or update or delete on public.enderecos
  for each row execute function privado.registrar_auditoria();

create trigger carimbar before insert or update on public.contatos_cliente
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.contatos_cliente
  for each row execute function privado.registrar_auditoria();

create trigger carimbar before insert or update on public.atendimentos
  for each row execute function privado.carimbar();
create trigger antes_salvar before insert or update on public.atendimentos
  for each row execute function privado.antes_salvar_atendimento();
create trigger auditoria after insert or update or delete on public.atendimentos
  for each row execute function privado.registrar_auditoria();

-- -----------------------------------------------------------------------------
-- Permissões (RLS)
--   Admin e Financeiro: todos os clientes.
--   Recepção: todos os clientes (pesquisa, cadastra e atualiza contatos).
--   Vendedor: só os clientes dos quais é o responsável.
-- -----------------------------------------------------------------------------

alter table public.clientes enable row level security;
alter table public.enderecos enable row level security;
alter table public.contatos_cliente enable row level security;
alter table public.atendimentos enable row level security;
alter table public.transferencias_cliente enable row level security;

create function privado.pode_ver_cliente_linha(vendedor_responsavel_id uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select privado.tem_acesso_total()
      or privado.meu_papel() = 'recepcao'
      or (privado.meu_papel() = 'vendedor' and vendedor_responsavel_id = (select auth.uid()))
$$;

-- Para as tabelas "filhas": se o usuário enxerga o cliente, enxerga os dados dele.
-- Roda com a permissão de quem chama, então a regra de RLS de clientes é aplicada.
create function privado.pode_ver_cliente(cliente uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from public.clientes c where c.id = cliente)
$$;

grant execute on function privado.pode_ver_cliente_linha(uuid) to authenticated;
grant execute on function privado.pode_ver_cliente(uuid) to authenticated;

create policy "ver clientes" on public.clientes for select to authenticated
  using (privado.pode_ver_cliente_linha(vendedor_responsavel_id));
create policy "cadastrar clientes" on public.clientes for insert to authenticated
  with check (privado.pode_ver_cliente_linha(vendedor_responsavel_id));
create policy "alterar clientes" on public.clientes for update to authenticated
  using (privado.pode_ver_cliente_linha(vendedor_responsavel_id))
  with check (privado.pode_ver_cliente_linha(vendedor_responsavel_id));
-- Sem regra de DELETE: clientes nunca são apagados, só desativados ou anonimizados.

create policy "ver endereços" on public.enderecos for select to authenticated
  using (privado.pode_ver_cliente(cliente_id));
create policy "cadastrar endereços" on public.enderecos for insert to authenticated
  with check (privado.pode_ver_cliente(cliente_id));
create policy "alterar endereços" on public.enderecos for update to authenticated
  using (privado.pode_ver_cliente(cliente_id))
  with check (privado.pode_ver_cliente(cliente_id));
create policy "apagar endereços" on public.enderecos for delete to authenticated
  using (privado.pode_ver_cliente(cliente_id));

create policy "ver contatos" on public.contatos_cliente for select to authenticated
  using (privado.pode_ver_cliente(cliente_id));
create policy "cadastrar contatos" on public.contatos_cliente for insert to authenticated
  with check (privado.pode_ver_cliente(cliente_id));
create policy "alterar contatos" on public.contatos_cliente for update to authenticated
  using (privado.pode_ver_cliente(cliente_id))
  with check (privado.pode_ver_cliente(cliente_id));
create policy "apagar contatos" on public.contatos_cliente for delete to authenticated
  using (privado.pode_ver_cliente(cliente_id));

create policy "ver atendimentos" on public.atendimentos for select to authenticated
  using (privado.pode_ver_cliente(cliente_id));
create policy "registrar atendimentos" on public.atendimentos for insert to authenticated
  with check (privado.pode_ver_cliente(cliente_id));
-- Corrigir ou apagar: só quem registrou, ou admin/financeiro.
create policy "alterar atendimentos" on public.atendimentos for update to authenticated
  using (usuario_id = (select auth.uid()) or privado.tem_acesso_total())
  with check (privado.pode_ver_cliente(cliente_id));
create policy "apagar atendimentos" on public.atendimentos for delete to authenticated
  using (usuario_id = (select auth.uid()) or privado.tem_acesso_total());

create policy "admin e financeiro veem transferências" on public.transferencias_cliente
  for select to authenticated
  using (privado.tem_acesso_total());

revoke all on public.clientes, public.enderecos, public.contatos_cliente,
  public.atendimentos, public.transferencias_cliente from anon, authenticated;

grant select, insert, update on public.clientes to authenticated;
grant select, insert, update, delete on public.enderecos, public.contatos_cliente,
  public.atendimentos to authenticated;
grant select on public.transferencias_cliente to authenticated;

-- -----------------------------------------------------------------------------
-- Funções chamadas pela tela
-- -----------------------------------------------------------------------------

-- Busca rápida por nome, nome fantasia, CPF/CNPJ ou telefone.
-- Ignora acentos, maiúsculas e pontuação, e tolera pequenos erros de digitação.
-- Roda com a permissão de quem chama: o vendedor só encontra os próprios clientes.
create function public.buscar_clientes(termo text default '', incluir_inativos boolean default false)
returns setof public.clientes
language sql stable
set search_path = ''
as $$
  with t as (
    select
      privado.sem_acento(trim(coalesce(termo, ''))) as texto,
      lower(regexp_replace(coalesce(termo, ''), '[^0-9A-Za-z]', '', 'g')) as doc
  ),
  e as (
    -- Escapa % e _ para não virarem curingas no LIKE.
    select
      texto,
      doc,
      replace(replace(replace(texto, '\', '\\'), '%', '\%'), '_', '\_') as texto_like,
      replace(replace(doc, '%', '\%'), '_', '\_') as doc_like
    from t
  )
  select c.*
  from public.clientes c, e
  where (incluir_inativos or c.ativo)
    and (
      e.texto = ''
      or c.busca_texto like '%' || e.texto_like || '%'
      or (char_length(e.doc) >= 3 and c.busca_texto like '%' || e.doc_like || '%')
      or (char_length(e.texto) >= 3 and extensions.word_similarity(e.texto, c.busca_texto) >= 0.5)
    )
  order by
    c.ativo desc,
    (e.texto <> '' and c.busca_texto like e.texto_like || '%') desc,
    extensions.word_similarity(e.texto, c.busca_texto) desc,
    c.nome
  limit 50
$$;

-- Troca o vendedor responsável de um cliente (só admin), registrando o motivo.
create function public.transferir_cliente(cliente uuid, novo_vendedor uuid, motivo text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not privado.e_admin() then
    raise exception 'Somente o administrador pode transferir clientes.' using errcode = '42501';
  end if;
  perform set_config('app.motivo_transferencia', coalesce(motivo, ''), true);
  update public.clientes set vendedor_responsavel_id = novo_vendedor where id = cliente;
  if not found then
    raise exception 'Cliente não encontrado.' using errcode = 'P0002';
  end if;
end
$$;

-- Transfere todos os clientes de um vendedor para outro (ex.: quando ele sai da empresa).
-- Retorna quantos clientes foram transferidos.
create function public.transferir_carteira(vendedor_atual uuid, novo_vendedor uuid, motivo text default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_total integer;
begin
  if not privado.e_admin() then
    raise exception 'Somente o administrador pode transferir clientes.' using errcode = '42501';
  end if;
  if vendedor_atual = novo_vendedor then
    raise exception 'Escolha um vendedor diferente do atual.' using errcode = '22023';
  end if;
  perform set_config('app.motivo_transferencia', coalesce(motivo, ''), true);
  update public.clientes set vendedor_responsavel_id = novo_vendedor
   where vendedor_responsavel_id = vendedor_atual;
  get diagnostics v_total = row_count;
  return v_total;
end
$$;

-- LGPD: apaga os dados pessoais de um cliente a pedido dele, mantendo os
-- registros que a empresa é obrigada a guardar (o cadastro vira "Cliente anonimizado").
-- "security definer" porque também limpa os dados pessoais guardados na auditoria.
create function public.anonimizar_cliente(cliente uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.e_admin() then
    raise exception 'Somente o administrador pode anonimizar clientes.' using errcode = '42501';
  end if;
  perform set_config('app.anonimizando', 'sim', true);

  update public.clientes
     set nome = 'Cliente anonimizado',
         nome_fantasia = null,
         cpf_cnpj = null,
         inscricao_estadual = null,
         email = null,
         telefone = null,
         whatsapp = null,
         observacoes = null,
         origem = null,
         ativo = false,
         anonimizado_em = now()
   where id = cliente and anonimizado_em is null;
  if not found then
    raise exception 'Cliente não encontrado ou já anonimizado.' using errcode = 'P0002';
  end if;

  delete from public.contatos_cliente where cliente_id = cliente;
  update public.enderecos
     set apelido = null, logradouro = 'Endereço removido', numero = null,
         complemento = null, cep = null, bairro = null
   where cliente_id = cliente;
  update public.atendimentos set resumo = 'Registro anonimizado' where cliente_id = cliente;

  -- O histórico continua mostrando quem fez o quê e quando, mas sem os dados pessoais.
  update public.auditoria
     set dados_antes = case when dados_antes is null then null else '{"anonimizado": true}'::jsonb end,
         dados_depois = case when dados_depois is null then null else '{"anonimizado": true}'::jsonb end
   where cliente_id = cliente;
end
$$;

revoke execute on function public.buscar_clientes(text, boolean),
  public.transferir_cliente(uuid, uuid, text),
  public.transferir_carteira(uuid, uuid, text),
  public.anonimizar_cliente(uuid)
  from public, anon;
grant execute on function public.buscar_clientes(text, boolean),
  public.transferir_cliente(uuid, uuid, text),
  public.transferir_carteira(uuid, uuid, text),
  public.anonimizar_cliente(uuid)
  to authenticated;

grant all on public.clientes, public.enderecos, public.contatos_cliente,
  public.atendimentos, public.transferencias_cliente to service_role;
