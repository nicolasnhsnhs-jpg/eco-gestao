-- =============================================================================
-- Agenda do dia: rotas de vários dias (viagens).
--
-- Quando uma linha tem um período de mais de um dia ("09/11 a 12/11",
-- "09/11 e 10/11", "09/11, 10/11 e 12/11"), a mesma linha aparece sozinha nos
-- dias SEGUINTES do período (o dia é criado se ainda não existir).
--
--   viagem   liga as cópias da mesma rota
--
-- Mudar a escrita, a hora, os técnicos, o veículo ou os selos num dia leva a
-- mudança para os dias seguintes da viagem. R, F e almoço são de cada dia.
-- Se o período diminuir, as cópias que saíram dele são apagadas (menos as que já
-- estão marcadas como realizado ou faturado).
-- Se o dia já tiver uma linha com a mesma escrita, ela é aproveitada (não duplica).
-- =============================================================================

alter table public.agenda_itens add column viagem uuid;
create index agenda_itens_viagem_idx on public.agenda_itens (viagem) where viagem is not null;

-- Datas escritas no período. "a"/"até"/"à" entre duas datas = intervalo.
-- O ano vem do dia da linha (dezembro → janeiro passa para o ano seguinte).
create function privado.datas_do_periodo(periodo text, base date)
returns date[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  achado text[];
  datas date[] := '{}';
  d date;
  ano int := extract(year from base)::int;
begin
  if coalesce(btrim(periodo), '') = '' then
    return '{}';
  end if;
  for achado in select regexp_matches(periodo, '(\d{1,2})/(\d{1,2})', 'g') loop
    begin
      d := make_date(ano, achado[2]::int, achado[1]::int);
    exception when others then
      return '{}';
    end;
    if d < base - 180 then d := d + interval '1 year'; end if;
    if d > base + 180 then d := d - interval '1 year'; end if;
    datas := datas || d;
  end loop;

  if array_length(datas, 1) = 2
     and periodo ~* '\d{1,2}/\d{1,2}\s*(a|até|ate|à)\s*\d{1,2}/\d{1,2}' then
    if datas[2] < datas[1] or datas[2] - datas[1] > 31 then
      return '{}';
    end if;
    select array_agg(g::date order by g) into datas
      from generate_series(datas[1], datas[2], interval '1 day') g;
  end if;

  return (select coalesce(array_agg(distinct x order by x), '{}') from unnest(datas) x);
end;
$$;

revoke execute on function privado.datas_do_periodo(text, date) from public;
grant execute on function privado.datas_do_periodo(text, date) to authenticated;

-- Garante que o dia existe (escala e mensagem do último dia preenchido).
create function privado.agenda_garantir_dia(dia date)
returns void
language sql
set search_path = ''
as $$
  insert into public.agenda_dias (data, mensagem, escalas)
  select dia,
         coalesce((select mensagem from public.agenda_dias where data < dia order by data desc limit 1), 'Excelente semana!'),
         coalesce((select escalas from public.agenda_dias where data < dia order by data desc limit 1),
                  '[{"inicio":"06:30","fim":"16h","tecnicos":[]},{"inicio":"07:30","fim":"17h","tecnicos":[]}]'::jsonb)
  on conflict (data) do nothing;
$$;

-- Espalha a linha pelos dias seguintes da viagem.
create function privado.agenda_espalhar_viagem(item_id uuid)
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
          (data, ordem, hora, descricao, periodo, nota, avulso, horario_cliente, chegada,
           tecnicos, veiculo, almoco, viagem)
        values
          (d, it.ordem, it.hora, it.descricao, it.periodo, it.nota, it.avulso, it.horario_cliente,
           it.chegada, it.tecnicos, it.veiculo, it.almoco, grupo);
      else
        update public.agenda_itens set
          hora = it.hora, descricao = it.descricao, periodo = it.periodo, nota = it.nota,
          avulso = it.avulso, horario_cliente = it.horario_cliente, chegada = it.chegada,
          tecnicos = it.tecnicos, veiculo = it.veiculo, viagem = grupo
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

revoke execute on function privado.agenda_garantir_dia(date) from public;
revoke execute on function privado.agenda_espalhar_viagem(uuid) from public;
grant execute on function privado.agenda_garantir_dia(date) to authenticated;
grant execute on function privado.agenda_espalhar_viagem(uuid) to authenticated;

create function privado.depois_salvar_item_agenda()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- As cópias feitas aqui dentro não disparam de novo.
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op = 'UPDATE'
     and (new.hora, new.descricao, new.periodo, new.nota, new.avulso, new.horario_cliente,
          new.chegada, new.tecnicos, new.veiculo)
         is not distinct from
         (old.hora, old.descricao, old.periodo, old.nota, old.avulso, old.horario_cliente,
          old.chegada, old.tecnicos, old.veiculo) then
    return null;
  end if;
  if new.viagem is null and coalesce(btrim(new.periodo), '') = '' then
    return null;
  end if;
  perform privado.agenda_espalhar_viagem(new.id);
  return null;
end;
$$;

create trigger espalhar_viagem after insert or update on public.agenda_itens
  for each row execute function privado.depois_salvar_item_agenda();

-- Viagens que já estavam lançadas: espalha a partir do primeiro dia de cada uma.
do $$
declare r record;
begin
  for r in
    select distinct on (lower(btrim(descricao)), periodo) id
      from public.agenda_itens
     where coalesce(btrim(periodo), '') <> ''
       and array_length(privado.datas_do_periodo(periodo, data), 1) >= 2
     order by lower(btrim(descricao)), periodo, data
  loop
    perform privado.agenda_espalhar_viagem(r.id);
  end loop;
end $$;
