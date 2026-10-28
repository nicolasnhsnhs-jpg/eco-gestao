-- A view v_lancamentos foi criada com "l.*", e o PostgreSQL fixa a lista de colunas
-- no momento em que a view é criada. Recriada para incluir a coluna nova servico_id.
drop view public.v_lancamentos;

create view public.v_lancamentos
with (security_invoker = true)
as
select
  l.*,
  (l.status in ('pendente', 'agendado') and l.vencimento < privado.hoje()) as atrasado,
  case
    when l.status in ('pendente', 'agendado') and l.vencimento < privado.hoje() then 'atrasado'
    else l.status::text
  end as situacao
from public.lancamentos l;

revoke all on public.v_lancamentos from anon;
grant select on public.v_lancamentos to authenticated;
