-- =============================================================================
-- Escritório corrige o cadastro de um ponto na O.S já começada ou concluída
-- (pedido de 25/11/2026). Ex.: o reservatório foi cadastrado com 10 m³ e era
-- 20 m³. A tela grava a correção na O.S salva (pontos_controle, vale para as
-- próximas visitas) e, com esta função, também na O.S aberta (os_pontos), que
-- depois de começada não é mais recopiada do cadastro.
--
-- Só troca localização, quantidade e capacidade: não mexe no que o técnico
-- registrou (situação, capturas, fotos, observações).
-- =============================================================================

create or replace function public.os_corrigir_ponto(
  os                uuid,
  ponto             uuid,
  area              text,
  quantidade        integer,
  capacidade_litros integer
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status public.status_os;
begin
  if not privado.pode_gerir_os() then
    raise exception 'Só o escritório corrige o cadastro da OS.' using errcode = '42501';
  end if;
  select s.status into v_status from public.ordens_servico s where s.id = os;
  if not found then
    raise exception 'OS não encontrada.' using errcode = 'P0002';
  end if;
  if v_status = 'cancelada' then
    raise exception 'OS cancelada não é corrigida.' using errcode = '23514';
  end if;
  if nullif(btrim(area), '') is null then
    raise exception 'Informe a localização.' using errcode = '23514';
  end if;
  if quantidade is not null and quantidade < 1 then
    raise exception 'Quantidade inválida.' using errcode = '23514';
  end if;
  if capacidade_litros is not null and capacidade_litros < 1 then
    raise exception 'Capacidade inválida.' using errcode = '23514';
  end if;

  update public.os_pontos p
     set area = btrim(os_corrigir_ponto.area),
         quantidade = coalesce(os_corrigir_ponto.quantidade, p.quantidade),
         capacidade_litros = os_corrigir_ponto.capacidade_litros
   where p.os_id = os_corrigir_ponto.os and p.ponto_id = os_corrigir_ponto.ponto;
end
$$;

revoke execute on function public.os_corrigir_ponto(uuid, uuid, text, integer, integer)
  from public, anon;
grant execute on function public.os_corrigir_ponto(uuid, uuid, text, integer, integer)
  to authenticated;
