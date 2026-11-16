-- =============================================================================
-- Ajustes pedidos em 16/11/2026 (segunda leva):
--
-- 1. Proposta: texto do atendimento fora do horário ("após as 18h, aos sábados…")
--    pode ser trocado por proposta (ex.: o valor já inclui o sábado). Vazio = texto
--    padrão, como antes.
-- 2. Proposta: prazo de pagamento em parcelas ("21/42 dias" = boleto em 2 vezes).
--    prazo_pagamento_dias continua com o primeiro prazo (a conta a receber e quem
--    já lia o campo seguem funcionando); prazos_pagamento guarda todos quando há
--    mais de um.
-- 3. Bebedouros e reservatórios: data da última limpeza informada pelo escritório
--    no cadastro (para visitas parciais ou limpezas feitas antes do sistema). Na OS
--    vale a mais recente entre a informada e a do histórico. copiar_pontos_os é
--    igual à de 20270104120000_os_ajustes_campo_faturar.sql, com o greatest().
-- =============================================================================

-- 1 e 2. Proposta -------------------------------------------------------------

alter table public.propostas
  add column texto_atendimento text check (char_length(texto_atendimento) <= 2000),
  add column prazos_pagamento smallint[] check (
    prazos_pagamento is null
    or (cardinality(prazos_pagamento) between 2 and 24
        and 0 <= all (prazos_pagamento) and 365 >= all (prazos_pagamento))
  );

comment on column public.propostas.texto_atendimento is
  'Texto do atendimento fora do horário no PDF (null = texto padrão com o acréscimo).';
comment on column public.propostas.prazos_pagamento is
  'Prazos das parcelas em dias (ex.: {21,42}); null = uma parcela só (prazo_pagamento_dias).';

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

-- 3. Última limpeza informada -------------------------------------------------

alter table public.pontos_controle add column limpeza_informada date;
grant update (limpeza_informada) on public.pontos_controle to authenticated;

comment on column public.pontos_controle.limpeza_informada is
  'Bebedouro/reservatório: data da última limpeza informada pelo escritório. Na OS vale a mais recente entre esta e o histórico.';

create or replace function privado.copiar_pontos_os(p_os uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.os_pontos where os_id = p_os;
  insert into public.os_pontos
    (os_id, ponto_id, tipo, numero, area, forma_iscagem, tipo_isca, modelo_armadilha,
     material, quantidade, quantidade_telas, codigo_filtro, btu, marca, numero_serie, capacidade_litros,
     com_chuva, ultima_troca_lampada, ultima_limpeza, situacao, observacao_fixa)
  select p_os, p.id, p.tipo, p.numero, p.area, p.forma_iscagem, p.tipo_isca, p.modelo_armadilha,
         p.material, p.quantidade, p.quantidade_telas, p.codigo_filtro, p.btu, p.marca,
         p.numero_serie, p.capacidade_litros, p.com_chuva,
         p.ultima_troca_lampada,
         case when p.tipo in ('bebedouro', 'bebedouro_garrafao', 'ponto_coleta', 'ar_condicionado', 'reservatorio') then
           greatest(
             p.limpeza_informada,
             (select max(e.data)
                from public.os_pontos ant
                join public.os_execucao e on e.os_id = ant.os_id
                join public.ordens_servico s on s.id = ant.os_id
               where ant.ponto_id = p.id and ant.os_id <> p_os
                 and s.status in ('concluida', 'conferida')
                 and case p.tipo
                       when 'ponto_coleta' then ant.coletado
                       when 'ar_condicionado' then
                         'sim' in (ant.limpeza_serpentina, ant.limpeza_gabinete, ant.limpeza_dreno)
                       else ant.limpo
                     end))
         end,
         case
           when p.tipo <> 'porta_isca' then null
           when p.tipo_isca = 'CO' then 'M'
           else 'MS'
         end,
         p.observacao_fixa
    from public.pontos_controle p
    join public.ordens_servico s on s.id = p_os and s.modelo_id = p.modelo_id
   where p.ativo;
end
$$;
