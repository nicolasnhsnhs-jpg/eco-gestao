-- A parte que precisa de privilégio (gravar comissões, fechamentos e a saída) vai para o
-- esquema privado, fora da API. A função pública só confere a permissão e repassa.

alter function public.fechar_comissoes(uuid, date, date, uuid) set schema privado;
revoke execute on function privado.fechar_comissoes(uuid, date, date, uuid) from public, anon;
grant execute on function privado.fechar_comissoes(uuid, date, date, uuid) to authenticated;

create function public.fechar_comissoes(vendedor uuid, mes date, vencimento date, conta uuid default null)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
begin
  if not privado.tem_acesso_total() then
    raise exception 'Somente Admin e Financeiro fecham comissões.' using errcode = '42501';
  end if;
  return privado.fechar_comissoes(vendedor, mes, vencimento, conta);
end
$$;

revoke execute on function public.fechar_comissoes(uuid, date, date, uuid) from public, anon;
grant execute on function public.fechar_comissoes(uuid, date, date, uuid) to authenticated;
