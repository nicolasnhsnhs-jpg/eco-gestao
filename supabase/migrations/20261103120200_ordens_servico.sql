-- =============================================================================
-- Ordens de Serviço (OS-1): modelo por cliente/unidade, OS, execução em campo
-- e permissões do operador.
--
-- Camadas de uma OS:
--   1. ESCOPO (ordens_servico): o escritório escreve; o operador só lê.
--   2. EXECUÇÃO (os_execucao): o operador escreve, só nas OS dele e enquanto abertas.
--   3. CONFERÊNCIA (Fase OS-2): só o escritório.
-- =============================================================================

create type public.status_os as enum (
  'rascunho', 'agendada', 'em_execucao', 'concluida', 'conferida', 'cancelada'
);

-- -----------------------------------------------------------------------------
-- Modelo: o escopo que se repete a cada visita do mesmo cliente + unidade + tipo
-- -----------------------------------------------------------------------------

create table public.os_modelos (
  id                     uuid primary key default gen_random_uuid(),
  cliente_id             uuid not null references public.clientes (id) on delete cascade,
  endereco_id            uuid references public.enderecos (id) on delete cascade,
  tipo_servico_id        uuid not null references public.tipos_servico (id),
  descricao              text,
  -- Campos próprios do tipo de serviço (formato definido no código, por tipo).
  escopo                 jsonb not null default '{}',
  observacoes_adm_padrao text,
  operadores_padrao      uuid[] not null default '{}',
  veiculo_padrao_id      uuid references public.veiculos (id) on delete set null,
  ativo                  boolean not null default true,
  criado_em              timestamptz not null default now(),
  criado_por             uuid references public.perfis (id),
  atualizado_em          timestamptz not null default now(),
  atualizado_por         uuid references public.perfis (id),

  constraint um_modelo_por_local unique nulls not distinct (cliente_id, endereco_id, tipo_servico_id)
);

create index os_modelos_endereco_idx on public.os_modelos (endereco_id);
create index os_modelos_tipo_idx on public.os_modelos (tipo_servico_id);

-- -----------------------------------------------------------------------------
-- A OS (uma por visita)
-- -----------------------------------------------------------------------------

create table public.ordens_servico (
  id                uuid primary key default gen_random_uuid(),
  numero            text not null unique,
  modelo_id         uuid references public.os_modelos (id) on delete set null,
  cliente_id        uuid not null references public.clientes (id),
  endereco_id       uuid references public.enderecos (id),
  tipo_servico_id   uuid not null references public.tipos_servico (id),
  status            public.status_os not null default 'agendada',
  data_agendada     date not null,
  hora_agendada     time,
  veiculo_id        uuid references public.veiculos (id) on delete set null,
  observacoes_adm   text,
  descricao         text,
  escopo            jsonb not null default '{}',
  -- Cópia dos dados do cliente e da unidade, congelada quando a execução começa.
  -- O operador lê só esta cópia: ele não tem acesso às tabelas de clientes.
  ficha_cliente     jsonb not null default '{}',
  servico_id        uuid references public.servicos (id) on delete set null,
  concluida_em      timestamptz,
  concluida_por     uuid references public.perfis (id),
  reaberta_em       timestamptz,
  reaberta_por      uuid references public.perfis (id),
  motivo_reabertura text,
  criado_em         timestamptz not null default now(),
  criado_por        uuid references public.perfis (id),
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid references public.perfis (id)
);

create index ordens_servico_cliente_idx on public.ordens_servico (cliente_id, data_agendada desc);
create index ordens_servico_data_idx on public.ordens_servico (data_agendada, status);
create index ordens_servico_modelo_idx on public.ordens_servico (modelo_id);
create index ordens_servico_endereco_idx on public.ordens_servico (endereco_id);
create index ordens_servico_servico_idx on public.ordens_servico (servico_id);

-- Operadores designados (a coifa, por exemplo, pode ter mais de um).
create table public.os_operadores (
  os_id       uuid not null references public.ordens_servico (id) on delete cascade,
  operador_id uuid not null references public.perfis (id),
  primary key (os_id, operador_id)
);

create index os_operadores_operador_idx on public.os_operadores (operador_id);

-- -----------------------------------------------------------------------------
-- Execução em campo (uma por OS, criada junto com a OS)
-- -----------------------------------------------------------------------------

create table public.os_execucao (
  os_id                  uuid primary key references public.ordens_servico (id) on delete cascade,
  data                   date,
  veiculo_id             uuid references public.veiculos (id) on delete set null,
  km_chegada             integer check (km_chegada between 0 and 9999999),
  hora_chegada           timestamptz,
  hora_inicio            timestamptz,
  hora_termino           timestamptz,
  hora_saida             timestamptz,
  resultado              text,
  observacoes            text,
  operador_nome          text,
  responsavel_nome       text,
  responsavel_setor      text,
  assinatura_cliente_id  uuid,
  assinatura_operador_id uuid,
  -- Campos próprios do tipo de serviço (liberações da coifa, observações de pragas…).
  checklist              jsonb not null default '{}',
  criado_em              timestamptz not null default now(),
  criado_por             uuid references public.perfis (id),
  atualizado_em          timestamptz not null default now(),
  atualizado_por         uuid references public.perfis (id),

  constraint horarios_em_ordem check (
    (hora_chegada is null or hora_inicio is null or hora_inicio >= hora_chegada)
    and (hora_inicio is null or hora_termino is null or hora_termino >= hora_inicio)
    and (hora_termino is null or hora_saida is null or hora_saida >= hora_termino)
  )
);

-- Fotos e assinaturas da OS ficam na tabela de arquivos.
alter table public.arquivos add column os_id uuid references public.ordens_servico (id) on delete cascade;
create index arquivos_os_idx on public.arquivos (os_id);
alter table public.arquivos drop constraint no_maximo_um_vinculo;
alter table public.arquivos add constraint no_maximo_um_vinculo
  check (num_nonnulls(proposta_id, lancamento_id, servico_id, os_id) <= 1);

alter table public.os_execucao
  add constraint assinatura_cliente_fk
    foreign key (assinatura_cliente_id) references public.arquivos (id) on delete set null,
  add constraint assinatura_operador_fk
    foreign key (assinatura_operador_id) references public.arquivos (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Funções de apoio às permissões
-- -----------------------------------------------------------------------------

-- Quem agenda e cuida das OS no escritório.
create function privado.pode_gerir_os()
returns boolean
language sql stable
set search_path = ''
as $$
  select privado.tem_acesso_total() or coalesce(privado.meu_papel() = 'recepcao', false)
$$;

-- A OS está atribuída ao usuário logado? (security definer: lê os_operadores sem
-- passar pelas regras dela, evitando um laço entre as regras das duas tabelas)
create function privado.os_e_minha(os uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.os_operadores o
     where o.os_id = os and o.operador_id = (select auth.uid())
  ) and coalesce(privado.meu_papel() = 'operador', false)
$$;

-- A execução ainda pode ser preenchida?
create function privado.os_aberta(os uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ordens_servico s
     where s.id = os and s.status in ('agendada', 'em_execucao')
  )
$$;

-- Para as tabelas "filhas": se o usuário enxerga a OS, enxerga os dados dela.
create function privado.pode_ver_os(os uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from public.ordens_servico s where s.id = os)
$$;

grant execute on function privado.pode_gerir_os(), privado.os_e_minha(uuid),
  privado.os_aberta(uuid), privado.pode_ver_os(uuid) to authenticated;

-- Dados do cliente e da unidade que vão para a OS. O CNPJ da unidade, se houver,
-- vale no lugar do CNPJ do cliente.
create function privado.ficha_cliente(p_cliente uuid, p_endereco uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'nome',          c.nome,
    'nome_fantasia', c.nome_fantasia,
    'razao_social',  coalesce(e.razao_social, c.nome),
    'cpf_cnpj',      coalesce(e.cnpj, c.cpf_cnpj),
    'telefone',      c.telefone,
    'whatsapp',      c.whatsapp,
    'email',         c.email,
    'unidade', case when e.id is null then null else jsonb_build_object(
      'apelido', e.apelido, 'cep', e.cep, 'logradouro', e.logradouro, 'numero', e.numero,
      'complemento', e.complemento, 'bairro', e.bairro, 'cidade', e.cidade, 'uf', e.uf
    ) end,
    'contatos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nome', k.nome, 'cargo', k.cargo, 'telefone', k.telefone, 'email', k.email)
               order by k.principal desc, k.nome)
        from public.contatos_cliente k
       where k.cliente_id = c.id
         and (k.endereco_id is null or k.endereco_id is not distinct from p_endereco)
    ), '[]'::jsonb)
  )
    from public.clientes c
    left join public.enderecos e on e.id = p_endereco and e.cliente_id = c.id
   where c.id = p_cliente
$$;

revoke execute on function privado.ficha_cliente(uuid, uuid) from public, authenticated;

-- -----------------------------------------------------------------------------
-- Gatilhos
-- -----------------------------------------------------------------------------

create function privado.antes_salvar_modelo_os()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.endereco_id is not null and not exists (
    select 1 from public.enderecos e where e.id = new.endereco_id and e.cliente_id = new.cliente_id
  ) then
    raise exception 'A unidade escolhida não é deste cliente.' using errcode = '23514';
  end if;
  return new;
end
$$;

create function privado.antes_salvar_os()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ano     text := to_char(privado.hoje(), 'YYYY');
  v_funcao  boolean := current_setting('app.os_transicao', true) = 'sim';
begin
  if tg_op = 'INSERT' then
    new.numero := 'OS-' || v_ano || '-'
               || lpad(privado.proximo_numero('os-' || v_ano)::text, 4, '0');
    if new.status not in ('rascunho', 'agendada') then
      raise exception 'Uma OS nova começa como rascunho ou agendada.' using errcode = '23514';
    end if;
  else
    new.numero := old.numero;

    -- Concluir, iniciar e reabrir só pelas funções próprias (que conferem as regras).
    if new.status is distinct from old.status and not v_funcao and not (
      old.status in ('rascunho', 'agendada', 'cancelada')
      and new.status in ('rascunho', 'agendada', 'cancelada')
    ) then
      raise exception 'Use os botões de iniciar, concluir ou reabrir a OS.' using errcode = '42501';
    end if;

    -- OS concluída fica travada: só a reabertura (admin) libera.
    if old.status in ('concluida', 'conferida') and not v_funcao then
      raise exception 'Esta OS já foi concluída. Peça ao administrador para reabrir.'
        using errcode = '42501';
    end if;
  end if;

  if new.endereco_id is not null and not exists (
    select 1 from public.enderecos e where e.id = new.endereco_id and e.cliente_id = new.cliente_id
  ) then
    raise exception 'A unidade escolhida não é deste cliente.' using errcode = '23514';
  end if;
  if new.modelo_id is not null and not exists (
    select 1 from public.os_modelos m
     where m.id = new.modelo_id and m.cliente_id = new.cliente_id
       and m.tipo_servico_id = new.tipo_servico_id
  ) then
    raise exception 'O modelo não é deste cliente e tipo de serviço.' using errcode = '23514';
  end if;

  -- Enquanto a execução não começou, a ficha acompanha o cadastro do cliente.
  if new.status in ('rascunho', 'agendada') then
    new.ficha_cliente := privado.ficha_cliente(new.cliente_id, new.endereco_id);
  end if;
  return new;
end
$$;

-- Toda OS nasce com a sua ficha de execução vazia (o operador só preenche).
create function privado.depois_criar_os()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.os_execucao (os_id, veiculo_id) values (new.id, new.veiculo_id);
  return null;
end
$$;

create function privado.antes_salvar_operador_os()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.perfis p where p.id = new.operador_id and p.ativo and p.papel = 'operador'
  ) then
    raise exception 'Escolha um operador ativo.' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.ordens_servico s
     where s.id = new.os_id and s.status in ('rascunho', 'agendada', 'em_execucao')
  ) then
    raise exception 'Não dá para trocar os operadores de uma OS concluída.' using errcode = '42501';
  end if;
  return new;
end
$$;

-- Removido da OS: só enquanto ela está aberta.
create function privado.antes_remover_operador_os()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.ordens_servico s
     where s.id = old.os_id and s.status in ('concluida', 'conferida')
  ) then
    raise exception 'Não dá para trocar os operadores de uma OS concluída.' using errcode = '42501';
  end if;
  return old;
end
$$;

-- Fotos e assinaturas: o arquivo precisa ser do mesmo cliente da OS.
create function privado.antes_salvar_arquivo_os()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.os_id is not null and not exists (
    select 1 from public.ordens_servico s where s.id = new.os_id and s.cliente_id = new.cliente_id
  ) then
    raise exception 'A OS não é deste cliente.' using errcode = '23514';
  end if;
  return new;
end
$$;

revoke execute on function privado.antes_salvar_os(), privado.depois_criar_os(),
  privado.antes_salvar_operador_os(), privado.antes_remover_operador_os(),
  privado.antes_salvar_arquivo_os() from public, authenticated;

create trigger carimbar before insert or update on public.os_modelos
  for each row execute function privado.carimbar();
create trigger antes_salvar before insert or update on public.os_modelos
  for each row execute function privado.antes_salvar_modelo_os();
create trigger auditoria after insert or update or delete on public.os_modelos
  for each row execute function privado.registrar_auditoria();

create trigger carimbar before insert or update on public.ordens_servico
  for each row execute function privado.carimbar();
create trigger antes_salvar before insert or update on public.ordens_servico
  for each row execute function privado.antes_salvar_os();
create trigger depois_criar after insert on public.ordens_servico
  for each row execute function privado.depois_criar_os();
create trigger auditoria after insert or update or delete on public.ordens_servico
  for each row execute function privado.registrar_auditoria();

create trigger antes_salvar before insert or update on public.os_operadores
  for each row execute function privado.antes_salvar_operador_os();
create trigger antes_remover before delete on public.os_operadores
  for each row execute function privado.antes_remover_operador_os();

create trigger carimbar before insert or update on public.os_execucao
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.os_execucao
  for each row execute function privado.registrar_auditoria();

create trigger antes_salvar_os before insert or update on public.arquivos
  for each row execute function privado.antes_salvar_arquivo_os();

-- -----------------------------------------------------------------------------
-- Permissões (RLS)
-- -----------------------------------------------------------------------------

alter table public.os_modelos enable row level security;
alter table public.ordens_servico enable row level security;
alter table public.os_operadores enable row level security;
alter table public.os_execucao enable row level security;

-- Modelos: só o escritório (o operador recebe o escopo pela própria OS).
create policy "escritório vê modelos" on public.os_modelos for select to authenticated
  using (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id));
create policy "escritório cria modelos" on public.os_modelos for insert to authenticated
  with check (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id));
create policy "escritório altera modelos" on public.os_modelos for update to authenticated
  using (privado.pode_gerir_os())
  with check (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id));

-- OS: o escritório vê todas; o vendedor, as dos clientes dele; o operador, só as dele
-- (e nunca os rascunhos).
create policy "ver OS" on public.ordens_servico for select to authenticated
  using (
    privado.pode_gerir_os()
    or (privado.meu_papel() = 'vendedor' and privado.pode_ver_cliente(cliente_id))
    or (status <> 'rascunho' and privado.os_e_minha(id))
  );
create policy "escritório cria OS" on public.ordens_servico for insert to authenticated
  with check (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id));
create policy "escritório altera OS" on public.ordens_servico for update to authenticated
  using (privado.pode_gerir_os())
  with check (privado.pode_gerir_os() and privado.pode_ver_cliente(cliente_id));

create policy "ver operadores da OS" on public.os_operadores for select to authenticated
  using (privado.pode_ver_os(os_id));
create policy "escritório designa operadores" on public.os_operadores for insert to authenticated
  with check (privado.pode_gerir_os() and privado.pode_ver_os(os_id));
create policy "escritório remove operadores" on public.os_operadores for delete to authenticated
  using (privado.pode_gerir_os() and privado.pode_ver_os(os_id));

-- Execução: quem vê a OS vê a execução; só o operador da OS (ou o admin) preenche,
-- e só enquanto a OS está aberta.
create policy "ver execução" on public.os_execucao for select to authenticated
  using (privado.pode_ver_os(os_id));
create policy "operador preenche a execução" on public.os_execucao for update to authenticated
  using ((privado.os_e_minha(os_id) or privado.e_admin()) and privado.os_aberta(os_id))
  with check ((privado.os_e_minha(os_id) or privado.e_admin()) and privado.os_aberta(os_id));

revoke all on public.os_modelos, public.ordens_servico, public.os_operadores, public.os_execucao
  from anon, authenticated;
grant select, insert, update on public.os_modelos to authenticated;
grant select, insert on public.ordens_servico to authenticated;
-- Status, número, ficha e conclusão são do banco: ninguém escreve direto.
grant update (modelo_id, cliente_id, endereco_id, tipo_servico_id, status, data_agendada,
  hora_agendada, veiculo_id, observacoes_adm, descricao, escopo) on public.ordens_servico
  to authenticated;
grant select, insert, delete on public.os_operadores to authenticated;
grant select on public.os_execucao to authenticated;
grant update (data, veiculo_id, km_chegada, hora_chegada, hora_inicio, hora_termino, hora_saida,
  resultado, observacoes, operador_nome, responsavel_nome, responsavel_setor,
  assinatura_cliente_id, assinatura_operador_id, checklist) on public.os_execucao to authenticated;
grant all on public.os_modelos, public.ordens_servico, public.os_operadores, public.os_execucao
  to service_role;

-- Arquivos: o operador vê e envia fotos e assinaturas só nas OS dele, enquanto abertas.
-- (As regras de arquivos que já existem continuam valendo para o escritório.)
create policy "operador vê arquivos da OS" on public.arquivos for select to authenticated
  using (os_id is not null and privado.os_e_minha(os_id));
create policy "operador envia arquivos da OS" on public.arquivos for insert to authenticated
  with check (
    os_id is not null and privado.os_e_minha(os_id) and privado.os_aberta(os_id)
    and categoria in ('foto_os', 'assinatura')
  );
create policy "operador apaga os próprios arquivos da OS" on public.arquivos for delete
  to authenticated
  using (
    os_id is not null and privado.os_e_minha(os_id) and privado.os_aberta(os_id)
    and enviado_por = (select auth.uid())
  );

-- Storage: pasta clientes/<cliente>/os/<os>/…
create function privado.os_do_caminho(caminho text)
returns uuid
language sql immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(caminho))[3] = 'os'
     and (storage.foldername(caminho))[4] ~ '^[0-9a-f-]{36}$'
    then (storage.foldername(caminho))[4]::uuid
  end
$$;

grant execute on function privado.os_do_caminho(text) to authenticated;

create policy "operador envia arquivos da OS" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'arquivos'
    and privado.os_e_minha(privado.os_do_caminho(name))
    and privado.os_aberta(privado.os_do_caminho(name))
    and exists (
      select 1 from public.ordens_servico s
       where s.id = privado.os_do_caminho(name)
         and s.cliente_id = privado.cliente_do_caminho(name)
    )
  );
create policy "operador apaga arquivos da OS" on storage.objects for delete to authenticated
  using (
    bucket_id = 'arquivos'
    and owner_id = (select auth.uid())::text
    and privado.os_e_minha(privado.os_do_caminho(name))
    and privado.os_aberta(privado.os_do_caminho(name))
  );

-- -----------------------------------------------------------------------------
-- Ações: gerar a OS a partir do modelo, iniciar, concluir e reabrir.
-- O miolo fica em "privado" (security definer); a casca em "public" roda com a
-- permissão de quem chama e só repassa.
-- -----------------------------------------------------------------------------

-- Cria a próxima OS de um modelo, copiando o escopo e os padrões.
create function privado.gerar_os_do_modelo(
  p_modelo uuid, p_data date, p_hora time, p_operadores uuid[], p_veiculo uuid,
  p_observacoes_adm text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_modelo public.os_modelos;
  v_os     uuid;
begin
  select * into v_modelo from public.os_modelos where id = p_modelo;
  if v_modelo.id is null or not privado.pode_gerir_os() then
    raise exception 'Modelo não encontrado.' using errcode = '42501';
  end if;

  insert into public.ordens_servico
    (modelo_id, cliente_id, endereco_id, tipo_servico_id, data_agendada, hora_agendada,
     veiculo_id, observacoes_adm, descricao, escopo)
  values
    (v_modelo.id, v_modelo.cliente_id, v_modelo.endereco_id, v_modelo.tipo_servico_id, p_data,
     p_hora, coalesce(p_veiculo, v_modelo.veiculo_padrao_id),
     coalesce(p_observacoes_adm, v_modelo.observacoes_adm_padrao), v_modelo.descricao,
     v_modelo.escopo)
  returning id into v_os;

  insert into public.os_operadores (os_id, operador_id)
  select v_os, unnest(coalesce(p_operadores, v_modelo.operadores_padrao));

  return v_os;
end
$$;

-- O operador (ou o admin) começa a execução.
create function privado.iniciar_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not (privado.os_e_minha(p_os) or privado.e_admin()) then
    raise exception 'Esta OS não está atribuída a você.' using errcode = '42501';
  end if;
  perform set_config('app.os_transicao', 'sim', true);
  update public.ordens_servico set status = 'em_execucao' where id = p_os and status = 'agendada';
  update public.os_execucao set data = coalesce(data, privado.hoje()) where os_id = p_os;
  perform set_config('app.os_transicao', '', true);
end
$$;

-- O que falta para concluir (lista vazia = pode concluir). Usada pela tela e pela
-- própria conclusão, para que as duas sigam exatamente a mesma regra.
create function privado.pendencias_os(p_os uuid)
returns text[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  e     public.os_execucao;
  falta text[] := '{}';
begin
  select * into e from public.os_execucao where os_id = p_os;
  if e.data is null then falta := array_append(falta, 'data'); end if;
  if e.hora_chegada is null then falta := array_append(falta, 'horário de chegada'); end if;
  if e.hora_inicio is null then falta := array_append(falta, 'horário de início'); end if;
  if e.hora_termino is null then falta := array_append(falta, 'horário de término'); end if;
  if e.hora_saida is null then falta := array_append(falta, 'horário de saída'); end if;
  if nullif(trim(e.resultado), '') is null then falta := array_append(falta, 'resultado do serviço'); end if;
  if nullif(trim(e.operador_nome), '') is null then falta := array_append(falta, 'nome do operador'); end if;
  if e.assinatura_operador_id is null then falta := array_append(falta, 'visto do operador'); end if;
  if nullif(trim(e.responsavel_nome), '') is null then
    falta := array_append(falta, 'nome de quem acompanhou');
  end if;
  if e.assinatura_cliente_id is null then falta := array_append(falta, 'assinatura de quem acompanhou'); end if;
  return falta;
end
$$;

-- Concluir: confere tudo, trava a OS e registra o serviço realizado (o que atualiza
-- os vencimentos e os avisos que já existem).
create function privado.concluir_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_os      public.ordens_servico;
  v_exec    public.os_execucao;
  v_falta   text[];
  v_servico uuid;
  v_nomes   text;
begin
  if not (privado.os_e_minha(p_os) or privado.e_admin()) then
    raise exception 'Esta OS não está atribuída a você.' using errcode = '42501';
  end if;
  select * into v_os from public.ordens_servico where id = p_os for update;
  if v_os.status not in ('agendada', 'em_execucao') then
    raise exception 'Esta OS não está aberta.' using errcode = '23514';
  end if;

  v_falta := privado.pendencias_os(p_os);
  if cardinality(v_falta) > 0 then
    raise exception 'Falta preencher: %.', array_to_string(v_falta, ', ') using errcode = '23514';
  end if;

  select * into v_exec from public.os_execucao where os_id = p_os;
  select string_agg(p.nome, ', ' order by p.nome) into v_nomes
    from public.os_operadores o join public.perfis p on p.id = o.operador_id
   where o.os_id = p_os;

  if v_os.servico_id is null then
    insert into public.servicos
      (cliente_id, endereco_id, tipo_servico_id, data_execucao, status, tecnicos, observacoes)
    values
      (v_os.cliente_id, v_os.endereco_id, v_os.tipo_servico_id, v_exec.data, 'realizado',
       v_nomes, 'Registrado pela ' || v_os.numero)
    returning id into v_servico;
  else
    v_servico := v_os.servico_id;
    update public.servicos
       set data_execucao = v_exec.data, status = 'realizado', tecnicos = v_nomes
     where id = v_servico;
  end if;

  perform set_config('app.os_transicao', 'sim', true);
  update public.ordens_servico
     set status = 'concluida', concluida_em = now(), concluida_por = auth.uid(),
         servico_id = v_servico
   where id = p_os;
  perform set_config('app.os_transicao', '', true);
end
$$;

-- Só o admin reabre uma OS concluída, sempre com motivo (fica na auditoria).
create function privado.reabrir_os(p_os uuid, p_motivo text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.e_admin() then
    raise exception 'Somente o administrador pode reabrir uma OS.' using errcode = '42501';
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

revoke execute on function
  privado.gerar_os_do_modelo(uuid, date, time, uuid[], uuid, text), privado.iniciar_os(uuid),
  privado.pendencias_os(uuid), privado.concluir_os(uuid), privado.reabrir_os(uuid, text)
  from public;
grant execute on function
  privado.gerar_os_do_modelo(uuid, date, time, uuid[], uuid, text), privado.iniciar_os(uuid),
  privado.pendencias_os(uuid), privado.concluir_os(uuid), privado.reabrir_os(uuid, text)
  to authenticated;

create function public.gerar_os_do_modelo(
  modelo uuid, data date, hora time default null, operadores uuid[] default null,
  veiculo uuid default null, observacoes_adm text default null
)
returns uuid
language sql security invoker
set search_path = ''
as $$
  select privado.gerar_os_do_modelo(modelo, data, hora, operadores, veiculo, observacoes_adm)
$$;

create function public.iniciar_os(os uuid)
returns void
language sql security invoker
set search_path = ''
as $$
  select privado.iniciar_os(os)
$$;

create function public.pendencias_os(os uuid)
returns text[]
language sql stable security invoker
set search_path = ''
as $$
  select case when privado.pode_ver_os(os) then privado.pendencias_os(os) end
$$;

create function public.concluir_os(os uuid)
returns void
language sql security invoker
set search_path = ''
as $$
  select privado.concluir_os(os)
$$;

create function public.reabrir_os(os uuid, motivo text)
returns void
language sql security invoker
set search_path = ''
as $$
  select privado.reabrir_os(os, motivo)
$$;

revoke execute on function
  public.gerar_os_do_modelo(uuid, date, time, uuid[], uuid, text), public.iniciar_os(uuid),
  public.pendencias_os(uuid), public.concluir_os(uuid), public.reabrir_os(uuid, text)
  from public, anon;
grant execute on function
  public.gerar_os_do_modelo(uuid, date, time, uuid[], uuid, text), public.iniciar_os(uuid),
  public.pendencias_os(uuid), public.concluir_os(uuid), public.reabrir_os(uuid, text)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Auditoria: a execução não tem coluna "id" nem "cliente_id"; o histórico dela fica
-- registrado com o id da OS e o cliente da OS.
-- -----------------------------------------------------------------------------

create or replace function privado.registrar_auditoria()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_antes   jsonb;
  v_depois  jsonb;
  v_linha   jsonb;
  v_cliente uuid;
begin
  -- Campos técnicos que não interessam no histórico.
  if tg_op <> 'INSERT' then
    v_antes := to_jsonb(old) - 'busca_texto';
  end if;
  if tg_op <> 'DELETE' then
    v_depois := to_jsonb(new) - 'busca_texto';
  end if;

  -- Atualização que não mudou nada além do carimbo: não registra.
  if tg_op = 'UPDATE'
     and (v_antes - 'atualizado_em' - 'atualizado_por')
       = (v_depois - 'atualizado_em' - 'atualizado_por') then
    return new;
  end if;

  v_linha := coalesce(v_depois, v_antes);
  v_cliente := case
    when tg_table_name = 'clientes' then (v_linha ->> 'id')::uuid
    when tg_table_name = 'os_execucao' then
      (select s.cliente_id from public.ordens_servico s where s.id = (v_linha ->> 'os_id')::uuid)
    else (v_linha ->> 'cliente_id')::uuid
  end;

  insert into public.auditoria (tabela, registro_id, cliente_id, acao, dados_antes, dados_depois, usuario_id)
  values (tg_table_name, coalesce(v_linha ->> 'id', v_linha ->> 'os_id')::uuid, v_cliente,
          lower(tg_op), v_antes, v_depois, auth.uid());

  return coalesce(new, old);
end
$$;
