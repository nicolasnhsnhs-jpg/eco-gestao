-- =============================================================================
-- Agenda do dia: R (realizado) e F (faturado) por serviço da linha.
-- Numa linha com vários serviços (separados por "/"), as gurias conferem cada um.
--
--   realizado_partes  os serviços da linha já realizados (0 = o primeiro)
--   faturado_partes   os serviços da linha já faturados
--   parcial_partes    os serviços feitos só em parte (ex.: LR feita, CI geral não)
--   motivos_parcial   o que ficou sem fazer em cada serviço, na ordem da linha
--                     ('' = sem motivo)
--
-- O R de cada serviço tem três estados: vazio, feito (verde) e parcial (amarelo,
-- com o motivo). Só o ADM mexe no R e no motivo; só o financeiro no F.
--
-- "realizado" e "faturado" continuam valendo para a linha toda: ficam ligados
-- quando todos os serviços da linha estão marcados (o sistema acerta isso ao marcar).
-- =============================================================================

alter table public.agenda_itens
  add column realizado_partes integer[] not null default '{}',
  add column faturado_partes integer[] not null default '{}',
  add column parcial_partes integer[] not null default '{}',
  add column motivos_parcial text[] not null default '{}';

comment on column public.agenda_itens.realizado_partes is 'Serviços da linha já realizados (posição na linha, 0 = o primeiro).';
comment on column public.agenda_itens.parcial_partes is 'Serviços da linha feitos só em parte (o R fica amarelo).';
comment on column public.agenda_itens.motivos_parcial is 'O que não foi feito em cada serviço da linha (na ordem da linha).';
comment on column public.agenda_itens.faturado_partes is 'Serviços da linha já faturados (posição na linha, 0 = o primeiro).';

-- Quem marca o quê continua igual; agora vale também para a marca de cada serviço.
create or replace function privado.agenda_conferir_r_f()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  quem text := privado.meu_papel()::text;
  ignorar text[] := array['realizado', 'faturado', 'realizado_partes', 'faturado_partes',
                          'parcial_partes', 'motivos_parcial', 'atualizado_em', 'atualizado_por'];
begin
  -- Sem usuário (sistema) ou cópia feita por outro gatilho: livre.
  if quem is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  if (new.realizado is distinct from old.realizado
      or new.realizado_partes is distinct from old.realizado_partes
      or new.parcial_partes is distinct from old.parcial_partes
      or new.motivos_parcial is distinct from old.motivos_parcial)
     and quem not in ('admin', 'administrativo') then
    raise exception 'Só o ADM marca o R (realizado).' using errcode = '42501';
  end if;
  if (new.faturado is distinct from old.faturado
      or new.faturado_partes is distinct from old.faturado_partes)
     and quem not in ('admin', 'financeiro') then
    raise exception 'Só o financeiro marca o F (faturado).' using errcode = '42501';
  end if;
  if not privado.pode_editar_agenda()
     and (to_jsonb(new) - ignorar) is distinct from (to_jsonb(old) - ignorar) then
    raise exception 'Você só consulta a agenda: dá para marcar o R ou o F, mas não alterar a linha.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Os dias da viagem que saíram do período só somem se nenhum serviço foi conferido.
create or replace function privado.agenda_espalhar_viagem(item_id uuid, campos text[] default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  it public.agenda_itens;
  datas date[];
  d date;
  grupo uuid;
  existente uuid;
  -- null = todos os campos (linha nova)
  tudo boolean := campos is null;
begin
  select * into it from public.agenda_itens where id = item_id;
  if not found then return; end if;

  datas := privado.datas_do_periodo(it.periodo, it.data);
  grupo := it.viagem;

  if array_length(datas, 1) >= 2 and it.data = any(datas) then
    if grupo is null then
      grupo := gen_random_uuid();
      update public.agenda_itens set viagem = grupo where id = it.id;
    end if;

    foreach d in array datas loop
      continue when d <= it.data;
      perform privado.agenda_garantir_dia(d);

      select id into existente from public.agenda_itens
       where data = d and (viagem = grupo
             or (viagem is null and lower(btrim(descricao)) = lower(btrim(it.descricao))))
       order by (viagem = grupo) desc nulls last
       limit 1;

      if existente is null then
        insert into public.agenda_itens
          (data, ordem, hora, descricao, periodo, nota, nota_parte, avulso_partes, horario_cliente,
           chegada, chegada_parte, horarios, notas, tecnicos, veiculo, almoco, viagem)
        values
          (d, it.ordem, it.hora, it.descricao, it.periodo, it.nota, it.nota_parte, it.avulso_partes,
           it.horario_cliente, it.chegada, it.chegada_parte, it.horarios, it.notas, it.tecnicos, it.veiculo, it.almoco,
           grupo);
      else
        update public.agenda_itens set
          hora            = case when tudo or 'hora' = any(campos) then it.hora else hora end,
          descricao       = case when tudo or 'descricao' = any(campos) then it.descricao else descricao end,
          periodo         = case when tudo or 'periodo' = any(campos) then it.periodo else periodo end,
          nota            = case when tudo or 'nota' = any(campos) then it.nota else nota end,
          avulso_partes   = case when tudo or 'avulso_partes' = any(campos) then it.avulso_partes else avulso_partes end,
          horario_cliente = case when tudo or 'horario_cliente' = any(campos) then it.horario_cliente else horario_cliente end,
          chegada         = case when tudo or 'chegada' = any(campos) then it.chegada else chegada end,
          tecnicos        = case when tudo or 'tecnicos' = any(campos) then it.tecnicos else tecnicos end,
          veiculo         = case when tudo or 'veiculo' = any(campos) then it.veiculo else veiculo end,
          nota_parte      = case when tudo or 'nota_parte' = any(campos) then it.nota_parte else nota_parte end,
          chegada_parte   = case when tudo or 'chegada_parte' = any(campos) then it.chegada_parte else chegada_parte end,
          horarios        = case when tudo or 'horarios' = any(campos) then it.horarios else horarios end,
          notas           = case when tudo or 'notas' = any(campos) then it.notas else notas end,
          viagem          = grupo
        where id = existente;
      end if;
    end loop;
  end if;

  -- Dias seguintes que saíram do período.
  if grupo is not null then
    delete from public.agenda_itens
     where viagem = grupo and id <> it.id and data > it.data
       and not (data = any(datas)) and not realizado and not faturado
       and cardinality(realizado_partes) = 0 and cardinality(faturado_partes) = 0
       and cardinality(parcial_partes) = 0;
  end if;
end;
$$;
