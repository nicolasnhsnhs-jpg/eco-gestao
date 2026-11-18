-- =============================================================================
-- Armadilha luminosa: as capturas já começam em 0.
--
-- Antes o técnico tinha de digitar 0 em cada inseto (mosca, mosquito, mariposa,
-- besouro) de cada armadilha sem captura. Agora a OS já nasce com 0 em todos;
-- ele só muda o que teve (ex.: 50 moscas). As chaves são as de ESPECIES em
-- src/features/os/tipos/pragas.ts e as conferidas em privado.pendencias_os.
-- =============================================================================

create function privado.capturas_comecam_em_zero()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo = 'armadilha_luminosa' then
    new.capturas := '{"M": 0, "MQ": 0, "MA": 0, "B": 0}'::jsonb || coalesce(new.capturas, '{}');
  end if;
  return new;
end
$$;

create trigger capturas_comecam_em_zero before insert on public.os_pontos
  for each row execute function privado.capturas_comecam_em_zero();

-- OS ainda abertas: completa com 0 o que está em branco (o que já foi digitado fica).
update public.os_pontos p
   set capturas = '{"M": 0, "MQ": 0, "MA": 0, "B": 0}'::jsonb || coalesce(p.capturas, '{}')
  from public.ordens_servico s
 where s.id = p.os_id and p.tipo = 'armadilha_luminosa'
   and s.status in ('rascunho', 'agendada', 'em_execucao');
