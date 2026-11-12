-- =============================================================================
-- Agenda do dia: falta e folga na escala, e quem pode fazer o quê.
--
--   agenda_dias.faltas   técnicos que faltaram no dia
--   agenda_dias.folgas   técnicos de folga no dia
--   Eles continuam gravados na escala (o dia seguinte copia a escala completa);
--   no quadro e na contagem do mês, quem está na falta ou na folga sai da escala.
--
-- Quem pode o quê:
--   admin e vendedor   montam a agenda (criam, alteram e apagam)
--   ADM                só olha; marca o R (realizado)
--   financeiro         só olha; marca o F (faturado)
--   operador           só olha, de qualquer dia até 30 dias para a frente
--   admin              marca R e F; é o único que muda o cadastro de técnicos e veículos
-- =============================================================================

alter table public.agenda_dias
  add column faltas int[] not null default '{}',
  add column folgas int[] not null default '{}';

-- Quem monta a agenda: sai o financeiro (agora só confere o F).
create or replace function privado.pode_editar_agenda()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(privado.meu_papel() in ('admin', 'vendedor'), false)
$$;

-- Quem vê a agenda de um dia: quem tem a aba e, agora, o operador (até 30 dias à frente).
create function privado.pode_ver_agenda_do_dia(dia date)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    privado.pode_usar_agenda()
    or (privado.meu_papel() = 'operador'
        and dia <= (now() at time zone 'America/Sao_Paulo')::date + 30),
    false)
$$;

-- O cadastro de técnicos e veículos (números e nomes que aparecem no quadro).
create function privado.pode_ver_cadastro_agenda()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(privado.pode_usar_agenda() or privado.meu_papel() = 'operador', false)
$$;

revoke execute on function privado.pode_ver_agenda_do_dia(date) from public;
revoke execute on function privado.pode_ver_cadastro_agenda() from public;
grant execute on function privado.pode_ver_agenda_do_dia(date) to authenticated;
grant execute on function privado.pode_ver_cadastro_agenda() to authenticated;

alter policy "agenda: quem tem a aba vê" on public.agenda_dias
  using (privado.pode_ver_agenda_do_dia(data));
alter policy "agenda: quem tem a aba vê as linhas" on public.agenda_itens
  using (privado.pode_ver_agenda_do_dia(data));
alter policy "agenda: quem tem a aba vê os técnicos" on public.agenda_tecnicos
  using (privado.pode_ver_cadastro_agenda());
alter policy "agenda: quem tem a aba vê os veículos" on public.agenda_veiculos
  using (privado.pode_ver_cadastro_agenda());

-- ADM e financeiro alteram a linha, mas só no R e no F (o gatilho abaixo confere).
alter policy "agenda: quem tem a aba altera linhas" on public.agenda_itens
  using (privado.pode_editar_agenda() or privado.meu_papel() in ('administrativo', 'financeiro'))
  with check (privado.pode_editar_agenda() or privado.meu_papel() in ('administrativo', 'financeiro'));

create function privado.agenda_conferir_r_f()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  quem text := privado.meu_papel()::text;
  ignorar text[] := array['realizado', 'faturado', 'atualizado_em', 'atualizado_por'];
begin
  -- Sem usuário (sistema) ou cópia feita por outro gatilho: livre.
  if quem is null or pg_trigger_depth() > 1 then
    return new;
  end if;
  if new.realizado is distinct from old.realizado and quem not in ('admin', 'administrativo') then
    raise exception 'Só o ADM marca o R (realizado).' using errcode = '42501';
  end if;
  if new.faturado is distinct from old.faturado and quem not in ('admin', 'financeiro') then
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

create trigger conferir_r_f before update on public.agenda_itens
  for each row execute function privado.agenda_conferir_r_f();
