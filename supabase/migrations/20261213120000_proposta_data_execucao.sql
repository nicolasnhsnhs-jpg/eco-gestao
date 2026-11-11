-- =============================================================================
-- Propostas: data e horário de execução.
--
-- Ao marcar como aprovada, o vendedor pode dizer quando o serviço vai ser feito
-- (se já tiver combinado com o cliente). O ADM consulta as aprovadas por dia de
-- execução para emitir as ordens de serviço.
-- =============================================================================

alter table public.propostas
  add column execucao_data date,
  -- Horário é opcional: às vezes só o dia está combinado.
  add column execucao_hora time,
  add constraint propostas_execucao_hora_com_data
    check (execucao_hora is null or execucao_data is not null);

-- Só proposta aprovada tem data de execução: voltar para "enviada" ou recusar limpa.
create function privado.execucao_so_aprovada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'aprovada' then
    new.execucao_data := null;
    new.execucao_hora := null;
  end if;
  return new;
end
$$;

create trigger execucao_so_aprovada before insert or update on public.propostas
  for each row execute function privado.execucao_so_aprovada();

create index propostas_execucao_data on public.propostas (execucao_data)
  where execucao_data is not null;

-- A view usa p.*: recria para pegar as colunas novas.
drop view public.v_propostas;
create view public.v_propostas
with (security_invoker = true)
as
select
  p.*,
  case
    when p.status = 'enviada' and p.validade < privado.hoje() then 'expirada'
    else p.status::text
  end as situacao,
  case when p.status = 'enviada' then privado.hoje() - p.data_envio end as dias_sem_resposta
from public.propostas p;

revoke all on public.v_propostas from anon;
grant select on public.v_propostas to authenticated;
