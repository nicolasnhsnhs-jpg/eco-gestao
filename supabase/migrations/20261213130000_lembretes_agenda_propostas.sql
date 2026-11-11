-- =============================================================================
-- Agenda do dia: lembrete das propostas aprovadas com execução marcada.
--
-- Quando o vendedor aprova a proposta com dia (e horário) de execução, quem monta
-- a agenda vê um aviso naquele dia para não esquecer de lançar o serviço com
-- técnico, carro e horário. Depois de conferir, ela tira o aviso.
--
-- O aviso guarda para qual dia/horário foi conferido: se o vendedor mudar a data
-- ou o horário, o aviso volta (no dia novo).
-- =============================================================================

-- Fica à parte da proposta: tirar o aviso não conta como alteração da proposta.
create table public.agenda_lembretes_conferidos (
  proposta_id uuid primary key references public.propostas (id) on delete cascade,
  data        date not null,
  hora        time,
  por         uuid references public.perfis (id) on delete set null,
  em          timestamptz not null default now()
);

-- Só pelas funções abaixo.
alter table public.agenda_lembretes_conferidos enable row level security;
revoke all on public.agenda_lembretes_conferidos from anon, authenticated;

-- Avisos de um dia. Sem valores: só o que a agenda precisa. Vale para todos que
-- usam a agenda (o vendedor vê também os dos colegas, como na própria agenda).
create function public.lembretes_agenda(dia date)
returns table (
  proposta_id uuid,
  numero      text,
  cliente     text,
  hora        time,
  servicos    text,
  endereco    text,
  vendedor    text
)
language sql stable security definer
set search_path = ''
as $$
  select
    p.id,
    p.numero,
    coalesce(nullif(c.nome_fantasia, ''), c.nome),
    p.execucao_hora,
    (select string_agg(i.descricao, ' · ' order by i.ordem)
       from public.proposta_itens i where i.proposta_id = p.id),
    case when e.id is not null then
      concat_ws(' · ', nullif(e.apelido, ''),
        concat(e.logradouro, ', ', coalesce(e.numero, 's/n')),
        concat(e.cidade, '/', e.uf))
    end,
    v.nome
  from public.propostas p
  join public.clientes c on c.id = p.cliente_id
  left join public.enderecos e on e.id = p.endereco_id
  left join public.perfis v on v.id = p.vendedor_id
  left join public.agenda_lembretes_conferidos k on k.proposta_id = p.id
  where privado.pode_usar_agenda()
    and p.status = 'aprovada'
    and p.execucao_data = dia
    and (k.proposta_id is null
         or k.data is distinct from p.execucao_data
         or k.hora is distinct from p.execucao_hora)
  order by p.execucao_hora nulls last, p.numero
$$;

-- Tira o aviso (quem edita a agenda). Vale para o dia/horário marcado agora.
create function public.conferir_lembrete_agenda(proposta uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not privado.pode_editar_agenda() then
    raise exception 'Só quem monta a agenda pode tirar o aviso.' using errcode = '42501';
  end if;
  insert into public.agenda_lembretes_conferidos as k (proposta_id, data, hora, por)
  select p.id, p.execucao_data, p.execucao_hora, (select auth.uid())
    from public.propostas p
   where p.id = proposta and p.status = 'aprovada' and p.execucao_data is not null
  on conflict (proposta_id) do update
    set data = excluded.data, hora = excluded.hora, por = excluded.por, em = now();
  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;
end
$$;

revoke execute on function public.lembretes_agenda(date) from public, anon;
revoke execute on function public.conferir_lembrete_agenda(uuid) from public, anon;
grant execute on function public.lembretes_agenda(date) to authenticated;
grant execute on function public.conferir_lembrete_agenda(uuid) to authenticated;
