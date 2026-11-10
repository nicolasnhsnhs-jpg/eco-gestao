-- =============================================================================
-- Agenda do dia: avulso por cliente.
-- Numa linha com vários clientes separados por " / " ("Gravataí A: Rota / LOG I:
-- Desentupimento"), cada cliente pode ser marcado como avulso sozinho.
--
--   avulso_partes   posições dos clientes avulsos na linha (0 = o primeiro)
--
-- A coluna antiga "avulso" (a linha toda) deixa de ser usada; quem estava marcado
-- passa a ter o primeiro cliente como avulso.
-- =============================================================================

alter table public.agenda_itens add column avulso_partes smallint[] not null default '{}';
update public.agenda_itens set avulso_partes = '{0}' where avulso;
comment on column public.agenda_itens.avulso is 'Não usada (ver avulso_partes).';

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
          (data, ordem, hora, descricao, periodo, nota, avulso_partes, horario_cliente, chegada,
           tecnicos, veiculo, almoco, viagem)
        values
          (d, it.ordem, it.hora, it.descricao, it.periodo, it.nota, it.avulso_partes, it.horario_cliente,
           it.chegada, it.tecnicos, it.veiculo, it.almoco, grupo);
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
          viagem          = grupo
        where id = existente;
      end if;
    end loop;
  end if;

  -- Dias seguintes que saíram do período.
  if grupo is not null then
    delete from public.agenda_itens
     where viagem = grupo and id <> it.id and data > it.data
       and not (data = any(datas)) and not realizado and not faturado;
  end if;
end;
$$;


create or replace function privado.depois_salvar_item_agenda()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  campos text[] := '{}';
begin
  -- As cópias feitas aqui dentro não disparam de novo.
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if new.viagem is null and coalesce(btrim(new.periodo), '') = '' then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform privado.agenda_espalhar_viagem(new.id, null);
    return null;
  end if;

  if new.hora is distinct from old.hora then campos := campos || 'hora'::text; end if;
  if new.descricao is distinct from old.descricao then campos := campos || 'descricao'::text; end if;
  if new.periodo is distinct from old.periodo then campos := campos || 'periodo'::text; end if;
  if new.nota is distinct from old.nota then campos := campos || 'nota'::text; end if;
  if new.avulso_partes is distinct from old.avulso_partes then campos := campos || 'avulso_partes'::text; end if;
  if new.horario_cliente is distinct from old.horario_cliente then campos := campos || 'horario_cliente'::text; end if;
  if new.chegada is distinct from old.chegada then campos := campos || 'chegada'::text; end if;
  if new.tecnicos is distinct from old.tecnicos then campos := campos || 'tecnicos'::text; end if;
  if new.veiculo is distinct from old.veiculo then campos := campos || 'veiculo'::text; end if;

  if cardinality(campos) > 0 then
    perform privado.agenda_espalhar_viagem(new.id, campos);
  end if;
  return null;
end;
$$;
