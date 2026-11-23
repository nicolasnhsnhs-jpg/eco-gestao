-- =============================================================================
-- Serviço adicional na OS (pedido de 23/11/2026): quando a equipe faz algo a mais que
-- não está na proposta, o escritório anota na conferência o que foi feito e o valor.
-- Vai junto com o OK para o financeiro: aparece em "A faturar" e entra na nota da OS
-- (soma no valor e vai na descrição). A forma de pagamento continua a do cliente.
-- =============================================================================

alter table public.os_conferencia
  add column adicional_descricao text check (char_length(adicional_descricao) <= 2000),
  add column adicional_valor numeric(12, 2) check (adicional_valor > 0),
  add constraint adicional_completo
    check ((nullif(trim(adicional_descricao), '') is null) = (adicional_valor is null));

comment on column public.os_conferencia.adicional_descricao is
  'Serviço feito a mais, fora da proposta (escopo). Vai para a nota da OS.';
comment on column public.os_conferencia.adicional_valor is
  'Valor do serviço adicional; soma no valor da nota da OS.';

grant update (adicional_descricao, adicional_valor) on public.os_conferencia to authenticated;
