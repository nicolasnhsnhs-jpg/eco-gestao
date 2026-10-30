-- =============================================================================
-- Ordens de Serviço (OS-3): controle de pragas
--
-- - pontos_controle: porta-iscas e armadilhas luminosas do MODELO (cliente +
--   unidade + serviço). Têm id permanente: é por ele que fica o histórico.
-- - os_pontos: a cópia dos pontos em cada OS, com a situação anotada na visita.
--   Toda isca começa "MS" e toda placa de cola começa "M": o operador só
--   anota as exceções.
-- - os_produtos e os_insetos: produtos usados e controle localizado de insetos.
-- =============================================================================

create type public.tipo_ponto as enum ('porta_isca', 'armadilha_luminosa');

create table public.pontos_controle (
  id               uuid primary key default gen_random_uuid(),
  modelo_id        uuid not null references public.os_modelos (id) on delete cascade,
  tipo             public.tipo_ponto not null,
  numero           integer not null check (numero between 1 and 9999),
  area             text not null check (char_length(trim(area)) between 1 and 120),
  -- Porta-isca: PII interno, PIE externo, IE isca exposta.
  forma_iscagem    text check (forma_iscagem in ('PII', 'PIE', 'IE')),
  -- IP parafinada, IG granulada, PO pó de contato, CO cola (placa), S semente.
  tipo_isca        text check (tipo_isca in ('IP', 'IG', 'PO', 'CO', 'S')),
  -- Armadilha luminosa: P branca, G inox.
  modelo_armadilha text check (modelo_armadilha in ('P', 'G')),
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  criado_por       uuid references public.perfis (id),
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid references public.perfis (id),

  constraint um_numero_por_tipo unique (modelo_id, tipo, numero),
  constraint campos_do_tipo check (
    (tipo = 'porta_isca' and forma_iscagem is not null and tipo_isca is not null
       and modelo_armadilha is null)
    or (tipo = 'armadilha_luminosa' and modelo_armadilha is not null
       and forma_iscagem is null and tipo_isca is null)
  )
);

create table public.os_pontos (
  id                   uuid primary key default gen_random_uuid(),
  os_id                uuid not null references public.ordens_servico (id) on delete cascade,
  ponto_id             uuid references public.pontos_controle (id) on delete set null,
  -- Retrato do escopo no dia da visita
  tipo                 public.tipo_ponto not null,
  numero               integer not null,
  area                 text not null,
  forma_iscagem        text,
  tipo_isca            text,
  modelo_armadilha     text,
  ultima_troca_lampada date,
  -- Execução
  situacao             text check (situacao in (
                         'MS', 'MC', 'CT', 'IN', 'DT', 'SA', 'NE', 'M', 'SC', 'I', 'T')),
  refil                text check (refil in ('M', 'T', 'I')),
  situacao_armadilha   text check (situacao_armadilha in ('F', 'D', 'DL', 'LT')),
  lampadas_trocadas    boolean,
  higiene              text check (higiene in ('S', 'R', 'I')),
  -- Capturas por espécie: {"M": mosca, "MQ": mosquito, "MA": mariposa, "B": besouro}
  capturas             jsonb not null default '{}',
  observacao           text,
  criado_em            timestamptz not null default now(),
  criado_por           uuid references public.perfis (id),
  atualizado_em        timestamptz not null default now(),
  atualizado_por       uuid references public.perfis (id),

  constraint um_ponto_por_os unique (os_id, tipo, numero),
  -- Placa de cola usa M/SC/I/T (e SA); as iscas usam MS/MC/CT/IN/DT/SA/NE.
  constraint situacao_do_tipo check (
    situacao is null
    or (tipo_isca = 'CO' and situacao in ('M', 'SC', 'I', 'T', 'SA', 'NE'))
    or (tipo_isca <> 'CO' and situacao in ('MS', 'MC', 'CT', 'IN', 'DT', 'SA', 'NE'))
  )
);

create index os_pontos_ponto_idx on public.os_pontos (ponto_id);

create table public.os_produtos (
  id              uuid primary key default gen_random_uuid(),
  os_id           uuid not null references public.ordens_servico (id) on delete cascade,
  principio_ativo text not null check (char_length(trim(principio_ativo)) between 2 and 120),
  forma           text not null check (forma in ('bloco', 'semente', 'granulada', 'po', 'placa', 'outro')),
  unidades        numeric(10, 2) check (unidades >= 0),
  gramas          numeric(10, 2) check (gramas >= 0),
  criado_em       timestamptz not null default now(),
  criado_por      uuid references public.perfis (id),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.perfis (id)
);

create index os_produtos_os_idx on public.os_produtos (os_id);

create table public.os_insetos (
  id              uuid primary key default gen_random_uuid(),
  os_id           uuid not null references public.ordens_servico (id) on delete cascade,
  area            text not null check (char_length(trim(area)) between 1 and 120),
  -- B baratas, F formigas, M moscas, MQ mosquito, A aranhas, T traças, L lesma
  praga           text not null check (praga in ('B', 'F', 'M', 'MQ', 'A', 'T', 'L')),
  nivel           text check (nivel in ('B', 'M', 'A')),
  condicoes       text check (condicoes in ('LE', 'LR', 'LI')),
  principio_ativo text,
  quantidade      text,
  pronto_uso      boolean,
  diluente        text,
  calda           text,
  -- AT atomização, TN termonebulização, IG gel, I iscagem, PO polvilhamento, PL pulverização
  procedimento    text check (procedimento in ('AT', 'TN', 'IG', 'I', 'PO', 'PL')),
  criado_em       timestamptz not null default now(),
  criado_por      uuid references public.perfis (id),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.perfis (id)
);

create index os_insetos_os_idx on public.os_insetos (os_id);

-- -----------------------------------------------------------------------------
-- Cópia dos pontos do modelo para a OS
-- -----------------------------------------------------------------------------

-- Copia os pontos ativos do modelo, com a situação padrão e a última troca de
-- lâmpada de cada armadilha (vem das visitas anteriores).
create function privado.copiar_pontos_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.os_pontos where os_id = p_os;
  insert into public.os_pontos
    (os_id, ponto_id, tipo, numero, area, forma_iscagem, tipo_isca, modelo_armadilha,
     ultima_troca_lampada, situacao)
  select p_os, p.id, p.tipo, p.numero, p.area, p.forma_iscagem, p.tipo_isca, p.modelo_armadilha,
         (select max(e.data)
            from public.os_pontos ant
            join public.os_execucao e on e.os_id = ant.os_id
            join public.ordens_servico s on s.id = ant.os_id
           where ant.ponto_id = p.id and ant.os_id <> p_os
             and s.status in ('concluida', 'conferida')
             and (ant.lampadas_trocadas or ant.situacao_armadilha = 'LT')),
         case
           when p.tipo = 'armadilha_luminosa' then null
           when p.tipo_isca = 'CO' then 'M'
           else 'MS'
         end
    from public.pontos_controle p
    join public.ordens_servico s on s.id = p_os and s.modelo_id = p.modelo_id
   where p.ativo;
end
$$;

create function privado.depois_criar_os_pontos()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.modelo_id is not null then
    perform privado.copiar_pontos_os(new.id);
  end if;
  return null;
end
$$;

revoke execute on function privado.copiar_pontos_os(uuid), privado.depois_criar_os_pontos()
  from public, authenticated;

create trigger copiar_pontos after insert on public.ordens_servico
  for each row execute function privado.depois_criar_os_pontos();

-- O escritório mudou os pontos do modelo: atualiza a OS que ainda não começou.
create function privado.atualizar_pontos_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.pode_gerir_os() then
    raise exception 'Somente o escritório altera os pontos da OS.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.ordens_servico s where s.id = p_os and s.status in ('rascunho', 'agendada')
  ) then
    raise exception 'A execução já começou: os pontos desta OS não mudam mais.'
      using errcode = '23514';
  end if;
  perform privado.copiar_pontos_os(p_os);
end
$$;

revoke execute on function privado.atualizar_pontos_os(uuid) from public;
grant execute on function privado.atualizar_pontos_os(uuid) to authenticated;

create function public.atualizar_pontos_os(os uuid)
returns void
language sql security invoker
set search_path = ''
as $$
  select privado.atualizar_pontos_os(os)
$$;

revoke execute on function public.atualizar_pontos_os(uuid) from public, anon;
grant execute on function public.atualizar_pontos_os(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- O que falta para concluir: regras comuns + as do formulário do tipo de serviço
-- -----------------------------------------------------------------------------

create or replace function privado.pendencias_os(p_os uuid)
returns text[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  e          public.os_execucao;
  v_form     public.formulario_os;
  falta      text[] := '{}';
  v_faltando text;
begin
  select * into e from public.os_execucao where os_id = p_os;
  select t.formulario_os into v_form
    from public.ordens_servico s join public.tipos_servico t on t.id = s.tipo_servico_id
   where s.id = p_os;

  if e.data is null then falta := array_append(falta, 'data'); end if;
  if e.hora_chegada is null then falta := array_append(falta, 'horário de chegada'); end if;
  if e.hora_inicio is null then falta := array_append(falta, 'horário de início'); end if;
  if e.hora_termino is null then falta := array_append(falta, 'horário de término'); end if;
  if e.hora_saida is null then falta := array_append(falta, 'horário de saída'); end if;
  if v_form = 'generico' and nullif(trim(e.resultado), '') is null then
    falta := array_append(falta, 'resultado do serviço');
  end if;
  if nullif(trim(e.operador_nome), '') is null then falta := array_append(falta, 'nome do operador'); end if;
  if e.assinatura_operador_id is null then falta := array_append(falta, 'visto do operador'); end if;
  if nullif(trim(e.responsavel_nome), '') is null then
    falta := array_append(falta, 'nome de quem acompanhou');
  end if;
  if e.assinatura_cliente_id is null then
    falta := array_append(falta, 'assinatura de quem acompanhou');
  end if;

  if v_form = 'pragas' then
    if coalesce(e.checklist ->> 'nivel_infestacao', '') not in ('B', 'M', 'A') then
      falta := array_append(falta, 'nível de infestação de roedores');
    end if;
    select string_agg(numero::text, ', ' order by numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo = 'armadilha_luminosa' and situacao_armadilha is null;
    if v_faltando is not null then
      falta := array_append(falta, 'situação das armadilhas ' || v_faltando);
    end if;
  end if;
  return falta;
end
$$;

-- -----------------------------------------------------------------------------
-- Gatilhos e permissões
-- -----------------------------------------------------------------------------

create trigger carimbar before insert or update on public.pontos_controle
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.pontos_controle
  for each row execute function privado.registrar_auditoria();

-- os_pontos fica sem auditoria linha a linha: uma OS pode ter centenas de pontos.
-- O carimbo guarda quem anotou por último, e a OS concluída fica travada.
create trigger carimbar before insert or update on public.os_pontos
  for each row execute function privado.carimbar();
create trigger carimbar before insert or update on public.os_produtos
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.os_produtos
  for each row execute function privado.registrar_auditoria();
create trigger carimbar before insert or update on public.os_insetos
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.os_insetos
  for each row execute function privado.registrar_auditoria();

alter table public.pontos_controle enable row level security;
alter table public.os_pontos enable row level security;
alter table public.os_produtos enable row level security;
alter table public.os_insetos enable row level security;

-- Pontos do modelo: só o escritório (o operador recebe a cópia na OS).
create function privado.pode_ver_modelo(modelo uuid)
returns boolean
language sql stable
set search_path = ''
as $$
  select exists (select 1 from public.os_modelos m where m.id = modelo)
$$;

grant execute on function privado.pode_ver_modelo(uuid) to authenticated;

create policy "escritório vê pontos" on public.pontos_controle for select to authenticated
  using (privado.pode_gerir_os() and privado.pode_ver_modelo(modelo_id));
create policy "escritório cadastra pontos" on public.pontos_controle for insert to authenticated
  with check (privado.pode_gerir_os() and privado.pode_ver_modelo(modelo_id));
create policy "escritório altera pontos" on public.pontos_controle for update to authenticated
  using (privado.pode_gerir_os() and privado.pode_ver_modelo(modelo_id))
  with check (privado.pode_gerir_os() and privado.pode_ver_modelo(modelo_id));

-- Itens da OS: quem vê a OS vê; o operador da OS (ou o admin) anota, só com a OS aberta.
create policy "ver pontos da OS" on public.os_pontos for select to authenticated
  using (privado.pode_ver_os(os_id));
create policy "operador anota pontos" on public.os_pontos for update to authenticated
  using ((privado.os_e_minha(os_id) or privado.e_admin()) and privado.os_aberta(os_id))
  with check ((privado.os_e_minha(os_id) or privado.e_admin()) and privado.os_aberta(os_id));

create policy "ver produtos da OS" on public.os_produtos for select to authenticated
  using (privado.pode_ver_os(os_id));
create policy "operador registra produtos" on public.os_produtos for insert to authenticated
  with check ((privado.os_e_minha(os_id) or privado.e_admin()) and privado.os_aberta(os_id));
create policy "operador altera produtos" on public.os_produtos for update to authenticated
  using ((privado.os_e_minha(os_id) or privado.e_admin()) and privado.os_aberta(os_id))
  with check ((privado.os_e_minha(os_id) or privado.e_admin()) and privado.os_aberta(os_id));
create policy "operador remove produtos" on public.os_produtos for delete to authenticated
  using ((privado.os_e_minha(os_id) or privado.e_admin()) and privado.os_aberta(os_id));

create policy "ver insetos da OS" on public.os_insetos for select to authenticated
  using (privado.pode_ver_os(os_id));
create policy "operador registra insetos" on public.os_insetos for insert to authenticated
  with check ((privado.os_e_minha(os_id) or privado.e_admin()) and privado.os_aberta(os_id));
create policy "operador altera insetos" on public.os_insetos for update to authenticated
  using ((privado.os_e_minha(os_id) or privado.e_admin()) and privado.os_aberta(os_id))
  with check ((privado.os_e_minha(os_id) or privado.e_admin()) and privado.os_aberta(os_id));
create policy "operador remove insetos" on public.os_insetos for delete to authenticated
  using ((privado.os_e_minha(os_id) or privado.e_admin()) and privado.os_aberta(os_id));

revoke all on public.pontos_controle, public.os_pontos, public.os_produtos, public.os_insetos
  from anon, authenticated;
grant select, insert on public.pontos_controle to authenticated;
grant update (numero, area, forma_iscagem, tipo_isca, modelo_armadilha, ativo)
  on public.pontos_controle to authenticated;
grant select on public.os_pontos to authenticated;
-- O retrato do escopo (número, área, tipo…) não muda pela tela: só a execução.
grant update (situacao, refil, situacao_armadilha, lampadas_trocadas, higiene, capturas, observacao)
  on public.os_pontos to authenticated;
grant select, insert, update, delete on public.os_produtos, public.os_insetos to authenticated;
grant all on public.pontos_controle, public.os_pontos, public.os_produtos, public.os_insetos
  to service_role;
