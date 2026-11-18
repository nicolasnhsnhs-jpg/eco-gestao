-- =============================================================================
-- OS: várias ocorrências, e a que não foi sanada volta na próxima visita.
--
-- Antes: um texto só (ordens_servico.ocorrencia) e o técnico confirmava
-- "resolvi" (os_execucao.ocorrencia_resolvida).
-- Agora o escritório põe quantas ocorrências quiser na OS, e o técnico responde
-- cada uma no celular:
--   sanado   → a ocorrência se encerra e não aparece mais nas próximas OS;
--   reforço  → "necessita mais reforço na próxima visita": continua aberta e
--              aparece nas próximas OS do MESMO serviço, cliente e endereço,
--              até alguém marcar sanado.
--
--   public.ocorrencias         a ocorrência do cliente (aberta até ser sanada)
--   public.os_ocorrencias      em quais OS ela aparece
--   os_execucao.ocorrencias_resultado   resposta do técnico: {"<id>": "sanado" | "reforco"}
--                                       (fica na execução para ir junto na fila
--                                       offline do celular, como os outros campos)
--
-- A OS nova já nasce com as ocorrências abertas do mesmo cliente, endereço e
-- serviço. Ao responder, a resposta vale também para as OS já agendadas para
-- depois: sanado tira a ocorrência delas, reforço põe.
-- Teste de treinamento: mostra as ocorrências, mas a resposta do técnico em
-- treinamento não mexe nas de verdade.
-- Mesma regra no celular: src/features/os/offline/pendencias.ts.
-- =============================================================================

create table public.ocorrencias (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references public.clientes (id) on delete cascade,
  endereco_id      uuid references public.enderecos (id) on delete cascade,
  tipo_servico_id  uuid not null references public.tipos_servico (id),
  texto            text not null check (char_length(trim(texto)) between 1 and 2000),
  -- OS em que foi aberta (só para consulta).
  os_origem_id     uuid references public.ordens_servico (id) on delete set null,
  -- Vazio: aberta. Preenchido: sanada (e em qual OS).
  sanada_em        timestamptz,
  sanada_na_os_id  uuid references public.ordens_servico (id) on delete set null,
  criado_em        timestamptz not null default now(),
  criado_por       uuid references public.perfis (id),
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid references public.perfis (id)
);

comment on table public.ocorrencias is
  'Ocorrências do cliente na OS; aberta (sanada_em vazio) aparece nas próximas OS do mesmo serviço.';

create index ocorrencias_local_idx on public.ocorrencias (cliente_id, tipo_servico_id, endereco_id)
  where sanada_em is null;
create index ocorrencias_endereco_idx on public.ocorrencias (endereco_id);
create index ocorrencias_tipo_idx on public.ocorrencias (tipo_servico_id);
create index ocorrencias_origem_idx on public.ocorrencias (os_origem_id);
create index ocorrencias_sanada_os_idx on public.ocorrencias (sanada_na_os_id);
create index ocorrencias_criado_por_idx on public.ocorrencias (criado_por);
create index ocorrencias_atualizado_por_idx on public.ocorrencias (atualizado_por);

create trigger carimbar before insert or update on public.ocorrencias
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.ocorrencias
  for each row execute function privado.registrar_auditoria();

create table public.os_ocorrencias (
  os_id          uuid not null references public.ordens_servico (id) on delete cascade,
  ocorrencia_id  uuid not null references public.ocorrencias (id) on delete cascade,
  incluida_em    timestamptz not null default now(),
  primary key (os_id, ocorrencia_id)
);

create index os_ocorrencias_ocorrencia_idx on public.os_ocorrencias (ocorrencia_id);

comment on table public.os_ocorrencias is 'Ocorrências que aparecem em cada OS.';

alter table public.os_execucao
  add column ocorrencias_resultado jsonb not null default '{}'
    check (jsonb_typeof(ocorrencias_resultado) = 'object');
grant update (ocorrencias_resultado) on public.os_execucao to authenticated;

comment on column public.os_execucao.ocorrencias_resultado is
  'Resposta do técnico a cada ocorrência: {"<id da ocorrência>": "sanado" | "reforco"}.';

-- Leitura: quem vê a OS vê as ocorrências dela; o escritório vê todas.
-- Gravação só pelas funções abaixo.
alter table public.ocorrencias enable row level security;
alter table public.os_ocorrencias enable row level security;

create policy "ver ocorrências" on public.ocorrencias for select to authenticated
  using (
    privado.pode_gerir_os()
    or exists (
      select 1 from public.os_ocorrencias l
       where l.ocorrencia_id = ocorrencias.id and privado.pode_ver_os(l.os_id)
    )
  );
create policy "ver ocorrências da OS" on public.os_ocorrencias for select to authenticated
  using (privado.pode_ver_os(os_id));

grant select on public.ocorrencias, public.os_ocorrencias to authenticated;

-- O técnico já respondeu esta ocorrência nesta OS? (aí ela fica: é o histórico.)
create or replace function privado.ocorrencia_respondida(p_os uuid, p_ocorrencia uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.os_execucao e
     where e.os_id = p_os and e.ocorrencias_resultado ? p_ocorrencia::text
  )
$$;

revoke execute on function privado.ocorrencia_respondida(uuid, uuid) from public;

-- -----------------------------------------------------------------------------
-- OS nova: já vem com as ocorrências abertas do mesmo cliente, endereço e serviço.
-- -----------------------------------------------------------------------------
create or replace function privado.ocorrencias_na_os_nova()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.os_ocorrencias (os_id, ocorrencia_id)
  select new.id, o.id
    from public.ocorrencias o
   where o.sanada_em is null
     and o.cliente_id = new.cliente_id
     and o.tipo_servico_id = new.tipo_servico_id
     and o.endereco_id is not distinct from new.endereco_id
  on conflict do nothing;
  return null;
end
$$;

revoke execute on function privado.ocorrencias_na_os_nova() from public;

create trigger ocorrencias_abertas after insert on public.ordens_servico
  for each row execute function privado.ocorrencias_na_os_nova();

-- -----------------------------------------------------------------------------
-- Resposta do técnico: sanado encerra, reforço mantém aberta. Vale também para as
-- OS do mesmo local já agendadas para depois (ainda não começadas).
-- -----------------------------------------------------------------------------
create or replace function privado.aplicar_resultado_ocorrencias()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_os    public.ordens_servico;
  v_id    text;
  v_resp  text;
  v_oc    uuid;
begin
  select * into v_os from public.ordens_servico where id = new.os_id;
  if v_os.treinamento then return null; end if;

  for v_id, v_resp in
    select key, value #>> '{}' from jsonb_each(new.ocorrencias_resultado)
  loop
    -- Só as que estão nesta OS (e ids válidos).
    select l.ocorrencia_id into v_oc
      from public.os_ocorrencias l
     where l.os_id = new.os_id and l.ocorrencia_id::text = v_id;
    continue when v_oc is null;
    -- Só o que mudou.
    continue when (old.ocorrencias_resultado ->> v_id) is not distinct from v_resp;

    if v_resp = 'sanado' then
      update public.ocorrencias
         set sanada_em = now(), sanada_na_os_id = new.os_id
       where id = v_oc;
      delete from public.os_ocorrencias l
       using public.ordens_servico s
       where l.ocorrencia_id = v_oc and s.id = l.os_id and s.id <> new.os_id
         and s.status in ('rascunho', 'agendada')
         and not privado.ocorrencia_respondida(l.os_id, v_oc);
    elsif v_resp = 'reforco' then
      update public.ocorrencias
         set sanada_em = null, sanada_na_os_id = null
       where id = v_oc and sanada_em is not null;
      insert into public.os_ocorrencias (os_id, ocorrencia_id)
      select s.id, v_oc
        from public.ordens_servico s
       where s.id <> new.os_id
         and s.status in ('rascunho', 'agendada')
         and not s.treinamento
         and s.cliente_id = v_os.cliente_id
         and s.tipo_servico_id = v_os.tipo_servico_id
         and s.endereco_id is not distinct from v_os.endereco_id
         and s.data_agendada >= v_os.data_agendada
      on conflict do nothing;
    end if;
  end loop;
  return null;
end
$$;

revoke execute on function privado.aplicar_resultado_ocorrencias() from public;

create trigger resultado_ocorrencias after update of ocorrencias_resultado on public.os_execucao
  for each row execute function privado.aplicar_resultado_ocorrencias();

-- -----------------------------------------------------------------------------
-- Escritório grava a lista de ocorrências da OS: [{"id": "<uuid>"?, "texto": "..."}].
--   com id   → muda o texto;
--   sem id   → ocorrência nova (deste cliente, endereço e serviço);
--   fora da lista → sai desta OS. A que só existia nesta OS é apagada; a que já
--   vinha de antes é dada como sanada (o escritório tirou porque resolveu).
-- -----------------------------------------------------------------------------
create or replace function privado.salvar_ocorrencias_os(p_os uuid, p_itens jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_os     public.ordens_servico;
  v_item   jsonb;
  v_texto  text;
  v_id     uuid;
  v_manter uuid[] := '{}';
begin
  if not privado.pode_gerir_os() then
    raise exception 'Somente o escritório muda as ocorrências.' using errcode = '42501';
  end if;
  select * into v_os from public.ordens_servico where id = p_os;
  if v_os.id is null then
    raise exception 'OS não encontrada.' using errcode = '23514';
  end if;
  if jsonb_typeof(coalesce(p_itens, '[]')) <> 'array' then
    raise exception 'Lista de ocorrências inválida.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]')) loop
    v_texto := nullif(trim(v_item ->> 'texto'), '');
    continue when v_texto is null;
    v_id := nullif(v_item ->> 'id', '')::uuid;
    if v_id is not null and exists (
      select 1 from public.os_ocorrencias where os_id = p_os and ocorrencia_id = v_id
    ) then
      update public.ocorrencias set texto = v_texto where id = v_id and texto <> v_texto;
    else
      insert into public.ocorrencias (cliente_id, endereco_id, tipo_servico_id, texto, os_origem_id)
      values (v_os.cliente_id, v_os.endereco_id, v_os.tipo_servico_id, v_texto, p_os)
      returning id into v_id;
      insert into public.os_ocorrencias (os_id, ocorrencia_id) values (p_os, v_id);
    end if;
    v_manter := array_append(v_manter, v_id);
  end loop;

  -- As que saíram da lista.
  for v_id in
    select ocorrencia_id from public.os_ocorrencias
     where os_id = p_os and not (ocorrencia_id = any (v_manter))
  loop
    delete from public.os_ocorrencias where os_id = p_os and ocorrencia_id = v_id;
    if exists (
      select 1 from public.ocorrencias o
       where o.id = v_id and o.os_origem_id = p_os
         and not exists (select 1 from public.os_ocorrencias l where l.ocorrencia_id = o.id)
    ) then
      delete from public.ocorrencias where id = v_id;
    else
      update public.ocorrencias
         set sanada_em = coalesce(sanada_em, now()), sanada_na_os_id = coalesce(sanada_na_os_id, p_os)
       where id = v_id;
      -- Também some das OS que ainda não começaram.
      delete from public.os_ocorrencias l
       using public.ordens_servico s
       where l.ocorrencia_id = v_id and s.id = l.os_id and s.status in ('rascunho', 'agendada')
         and not privado.ocorrencia_respondida(l.os_id, v_id);
    end if;
    -- Tira a resposta do técnico a ela, se houver.
    update public.os_execucao
       set ocorrencias_resultado = ocorrencias_resultado - v_id::text
     where os_id = p_os and ocorrencias_resultado ? v_id::text;
  end loop;
end
$$;

revoke execute on function privado.salvar_ocorrencias_os(uuid, jsonb) from public;
grant execute on function privado.salvar_ocorrencias_os(uuid, jsonb) to authenticated;

create function public.salvar_ocorrencias_os(os uuid, itens jsonb)
returns void
language sql security invoker
set search_path = ''
as $$
  select privado.salvar_ocorrencias_os(os, itens)
$$;

revoke execute on function public.salvar_ocorrencias_os(uuid, jsonb) from public, anon;
grant execute on function public.salvar_ocorrencias_os(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- O que já existia: o texto de cada OS vira uma ocorrência dela.
-- Confirmada pelo técnico → sanada. OS já encerrada sem confirmar (cancelada) →
-- também encerrada, para não reaparecer.
-- -----------------------------------------------------------------------------
create temporary table ocorrencias_antigas as
select s.id as os_id, gen_random_uuid() as ocorrencia_id, s.cliente_id, s.endereco_id,
       s.tipo_servico_id, trim(s.ocorrencia) as texto, s.treinamento,
       coalesce(e.ocorrencia_resolvida, false) as resolvida,
       s.status in ('concluida', 'conferida', 'cancelada') as encerrada,
       coalesce(e.atualizado_em, s.atualizado_em) as quando
  from public.ordens_servico s
  left join public.os_execucao e on e.os_id = s.id
 where nullif(trim(s.ocorrencia), '') is not null;

insert into public.ocorrencias
  (id, cliente_id, endereco_id, tipo_servico_id, texto, os_origem_id, sanada_em, sanada_na_os_id)
select ocorrencia_id, cliente_id, endereco_id, tipo_servico_id, left(texto, 2000), os_id,
       case when resolvida or encerrada or treinamento then quando end,
       case when resolvida or encerrada or treinamento then os_id end
  from ocorrencias_antigas;

insert into public.os_ocorrencias (os_id, ocorrencia_id)
select os_id, ocorrencia_id from ocorrencias_antigas;

-- Sem disparar a regra de "sanado" (é só a cópia do que já estava confirmado).
alter table public.os_execucao disable trigger resultado_ocorrencias;
update public.os_execucao e
   set ocorrencias_resultado = jsonb_build_object(a.ocorrencia_id::text, 'sanado')
  from ocorrencias_antigas a
 where e.os_id = a.os_id and a.resolvida;
alter table public.os_execucao enable trigger resultado_ocorrencias;

-- O texto antigo não é mais usado (fica a coluna, vazia).
update public.ordens_servico set ocorrencia = null where ocorrencia is not null;
drop table ocorrencias_antigas;

-- -----------------------------------------------------------------------------
-- Pendências: cada ocorrência da OS precisa de resposta (sanado ou reforço).
-- O resto é igual ao de 20270111120000_os_residuo_succao.sql.
-- -----------------------------------------------------------------------------

create or replace function privado.pendencias_os(p_os uuid)
returns text[]
language plpgsql stable security definer
set search_path = ''
as $$
declare
  e          public.os_execucao;
  v_form     public.formulario_os;
  v_fotos    boolean;
  v_residuo  boolean;
  v_qtd      numeric;
  falta      text[] := '{}';
  v_faltando text;
  v_item       text;
  v_subtipo    text;
begin
  select * into e from public.os_execucao where os_id = p_os;
  select t.formulario_os, t.fotos_antes_depois, t.registra_residuo,
         s.escopo ->> 'subtipo'
    into v_form, v_fotos, v_residuo, v_subtipo
    from public.ordens_servico s join public.tipos_servico t on t.id = s.tipo_servico_id
   where s.id = p_os;
  if e.data is null then falta := array_append(falta, 'data'); end if;
  if e.hora_chegada is null then falta := array_append(falta, 'horário de chegada'); end if;
  if e.hora_inicio is null then falta := array_append(falta, 'horário de início'); end if;
  if e.hora_termino is null then falta := array_append(falta, 'horário de término'); end if;
  if e.hora_saida is null then falta := array_append(falta, 'horário de saída'); end if;
  if v_form in ('generico', 'pragas_simples') and nullif(trim(e.resultado), '') is null then
    falta := array_append(falta, 'resultado do serviço');
  end if;
  if nullif(trim(e.operador_nome), '') is null then falta := array_append(falta, 'nome do operador'); end if;
  if e.assinatura_operador_id is null then falta := array_append(falta, 'visto do operador'); end if;
  -- Quem acompanhou: nome, setor e assinatura, a não ser que ninguém tenha acompanhado.
  if not e.sem_acompanhamento then
    if nullif(trim(e.responsavel_nome), '') is null then
      falta := array_append(falta, 'nome de quem acompanhou');
    end if;
    if nullif(trim(e.responsavel_setor), '') is null then
      falta := array_append(falta, 'setor de quem acompanhou');
    end if;
    if e.assinatura_cliente_id is null then
      falta := array_append(falta, 'assinatura de quem acompanhou');
    end if;
  end if;

  -- Ocorrências do escritório: o técnico responde cada uma (sanado ou reforço).
  if exists (
    select 1 from public.os_ocorrencias l
     where l.os_id = p_os
       and coalesce(e.ocorrencias_resultado ->> l.ocorrencia_id::text, '') not in ('sanado', 'reforco')
  ) then
    falta := array_append(falta, 'confirmação da ocorrência');
  end if;

  if v_form = 'pragas' then
    if coalesce(e.checklist ->> 'nivel_infestacao', '') not in ('B', 'M', 'A') then
      falta := array_append(falta, 'nível de infestação de roedores');
    end if;
    if v_subtipo = 'insetos_roedores'
       and jsonb_typeof(e.checklist -> 'monitoramento_insetos') is distinct from 'boolean' then
      falta := array_append(falta, 'monitoramento de insetos (realizado ou não)');
    end if;
    select string_agg(numero::text, ', ' order by numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo = 'armadilha_luminosa' and situacao_armadilha is null;
    if v_faltando is not null then
      falta := array_append(falta, 'situação das armadilhas ' || v_faltando);
    end if;
    -- Captura de cada espécie em cada armadilha (0 quando não pegou nada).
    select string_agg(numero::text, ', ' order by numero) into v_faltando
      from public.os_pontos p
     where p.os_id = p_os and p.tipo = 'armadilha_luminosa'
       and exists (
         select 1 from unnest(array['M', 'MQ', 'MA', 'B']) k
          where jsonb_typeof(coalesce(p.capturas, '{}') -> k) is distinct from 'number');
    if v_faltando is not null then
      falta := array_append(falta, 'capturas das armadilhas ' || v_faltando);
    end if;
  end if;

  if v_form = 'coifa' then
    -- Cada pergunta da liberação para trabalho precisa de resposta (sim ou não).
    foreach v_item in array array[
      'area_isolada', 'producao_livre', 'pintada', 'risco_pintura', 'equipamentos_desligados',
      'motor_desligado', 'gas_fechado'] loop
      if jsonb_typeof(e.checklist -> 'liberacao' -> v_item -> 'sim') is distinct from 'boolean' then
        falta := array_append(falta, 'liberação para trabalho');
        exit;
      end if;
    end loop;
    if coalesce(e.checklist -> 'liberacao' ->> 'condicoes', '') not in ('LE', 'LR', 'LI') then
      falta := array_append(falta, 'condições do ambiente');
    end if;
    if coalesce(e.checklist -> 'liberacao' ->> 'escoamento', '') not in ('eficiente', 'regular', 'ineficiente') then
      falta := array_append(falta, 'escoamento do piso');
    end if;
    select string_agg(area, ', ' order by numero) into v_faltando
      from public.os_pontos where os_id = p_os and tipo = 'coifa' and sujidade is null;
    if v_faltando is not null then
      falta := array_append(falta, 'sujidade de: ' || v_faltando);
    end if;
    if jsonb_typeof(e.checklist -> 'produto_ml') is distinct from 'number' then
      falta := array_append(falta, 'quantidade de produto');
    end if;
    foreach v_item in array array['limpeza_eficiente', 'equipamentos_religados', 'ambiente_liberado'] loop
      if jsonb_typeof(e.checklist -> 'conferencia' -> v_item -> 'sim') is distinct from 'boolean' then
        falta := array_append(falta, 'conferência final com o cliente');
        exit;
      end if;
    end loop;
  end if;

  if v_form = 'bebedouro' then
    if coalesce(e.checklist ->> 'trabalho', '') not in ('preventivo', 'corretivo') then
      falta := array_append(falta, 'preventivo ou corretivo');
    end if;
    -- Cada bebedouro precisa de "limpo" sim ou não (não limpo: diga o motivo na obs.).
    select string_agg(area, ', ' order by tipo, numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo in ('bebedouro', 'bebedouro_garrafao') and limpo is null;
    if v_faltando is not null then
      falta := array_append(falta, 'limpeza de: ' || v_faltando);
    end if;
    foreach v_item in array array['todos_limpos', 'danificados'] loop
      if jsonb_typeof(e.checklist -> 'conferencia' -> v_item -> 'sim') is distinct from 'boolean' then
        falta := array_append(falta, 'conferência com o cliente');
        exit;
      end if;
    end loop;
  end if;

  if v_form = 'telas' then
    if jsonb_typeof(e.checklist -> 'autorizado' -> 'sim') is distinct from 'boolean' then
      falta := array_append(falta, 'liberação para instalação de telas');
    end if;
    if jsonb_typeof(e.checklist -> 'instaladas' -> 'sim') is distinct from 'boolean' then
      falta := array_append(falta, 'conferência com o cliente');
    end if;
  end if;

  if v_form = 'agua' then
    if (e.checklist ->> 'procedimento') is distinct from 'true' then
      falta := array_append(falta, 'confirmação do procedimento de coleta');
    end if;
    -- Cada ponto: coletado sim ou não; coletado precisa da hora da coleta.
    select string_agg(area, ', ' order by numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo = 'ponto_coleta'
       and (coletado is null or (coletado and hora_coleta is null));
    if v_faltando is not null then
      falta := array_append(falta, 'coleta de: ' || v_faltando);
    end if;
    if jsonb_typeof(e.checklist -> 'refrigeradas' -> 'sim') is distinct from 'boolean' then
      falta := array_append(falta, 'conservação das amostras');
    end if;
  end if;

  if v_form = 'ar_condicionado' then
    -- Cada aparelho: as três limpezas e as duas fotos respondidas.
    select string_agg(lpad(numero::text, 2, '0'), ', ' order by numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo = 'ar_condicionado'
       and (limpeza_serpentina is null or limpeza_gabinete is null or limpeza_dreno is null
            or foto_etiqueta is null or fotos_limpeza is null);
    if v_faltando is not null then
      falta := array_append(falta, 'ar-condicionado: ' || v_faltando);
    end if;
    if jsonb_typeof(e.checklist -> 'produto_ml') is distinct from 'number' then
      falta := array_append(falta, 'quantidade de produto');
    end if;
  end if;

  if v_form = 'reservatorio' then
    -- Cada reservatório precisa de "limpo" sim ou não (não limpo: diga o motivo na obs.).
    select string_agg(area, ', ' order by numero) into v_faltando
      from public.os_pontos
     where os_id = p_os and tipo = 'reservatorio' and limpo is null;
    if v_faltando is not null then
      falta := array_append(falta, 'reservatórios: ' || v_faltando);
    end if;
  end if;

  -- Sucção: quantidade sugada (m³, maior que zero) e o código do resíduo.
  if v_residuo then
    v_qtd := null;
    if jsonb_typeof(e.checklist -> 'residuo' -> 'quantidade_m3') = 'number' then
      v_qtd := (e.checklist -> 'residuo' ->> 'quantidade_m3')::numeric;
    end if;
    if v_qtd is null or v_qtd <= 0 then
      falta := array_append(falta, 'quantidade sugada');
    end if;
    if coalesce(e.checklist -> 'residuo' ->> 'codigo', '') not in ('200125', '200304', '200301', '190809') then
      falta := array_append(falta, 'tipo de resíduo sugado');
    end if;
  end if;

  -- Serviços de limpeza: pelo menos uma foto de antes e uma de depois.
  if v_fotos then
    if not exists (select 1 from public.arquivos where os_id = p_os and categoria = 'foto_antes') then
      falta := array_append(falta, 'foto antes do serviço');
    end if;
    if not exists (select 1 from public.arquivos where os_id = p_os and categoria = 'foto_depois') then
      falta := array_append(falta, 'foto após o serviço');
    end if;
  end if;
  return falta;
end
$$;
