-- Cancelar OS pelo escritório: o Administrador e o ADM cancelam uma OS em qualquer
-- fase (agendada, em execução, concluída ou conferida), por exemplo quando o técnico
-- preencheu errado e avisou. O operador não cancela. O motivo fica registrado.
-- OS já faturada não cancela (o financeiro precisa resolver a nota antes).

alter table public.ordens_servico
  add column cancelada_em        timestamptz,
  add column cancelada_por       uuid references public.perfis (id),
  add column motivo_cancelamento text;

create function privado.cancelar_os(p_os uuid, p_motivo text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if coalesce(privado.meu_papel() in ('admin', 'administrativo'), false) is not true then
    raise exception 'Só o Administrador ou o ADM podem cancelar uma OS.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Informe o motivo do cancelamento.' using errcode = '23514';
  end if;
  if exists (select 1 from public.os_conferencia c where c.os_id = p_os and c.taxa_faturada) then
    raise exception 'Esta OS já foi faturada. Fale com o financeiro antes de cancelar.'
      using errcode = '23514';
  end if;

  perform set_config('app.os_transicao', 'sim', true);
  update public.ordens_servico
     set status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(),
         motivo_cancelamento = trim(p_motivo)
   where id = p_os and status <> 'cancelada';
  if not found then
    raise exception 'OS não encontrada ou já cancelada.' using errcode = 'P0002';
  end if;
  perform set_config('app.os_transicao', '', true);
end
$$;

revoke execute on function privado.cancelar_os(uuid, text) from public;
grant execute on function privado.cancelar_os(uuid, text) to authenticated;

create function public.cancelar_os(os uuid, motivo text)
returns void
language sql security invoker
set search_path = ''
as $$
  select privado.cancelar_os(os, motivo)
$$;

revoke execute on function public.cancelar_os(uuid, text) from public, anon;
grant execute on function public.cancelar_os(uuid, text) to authenticated;
