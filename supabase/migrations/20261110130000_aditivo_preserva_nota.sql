-- =============================================================================
-- Aditivo (novo valor do contrato) não muda a mensalidade que já tem nota
-- fiscal emitida: aquela conta a receber vale o que está na nota.
-- =============================================================================

create or replace function privado.ajustar_cobrancas_contrato()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_mes_atual date := date_trunc('month', privado.hoje())::date;
begin
  update public.lancamentos l
     set status = 'cancelado',
         observacoes = concat_ws(' ', l.observacoes, '(cancelada: contrato ' || new.status || ')')
   where l.contrato_id = new.id
     and l.status = 'pendente'
     and l.competencia >= v_mes_atual
     and (new.status <> 'ativo' or (new.data_fim is not null and l.competencia > new.data_fim));

  if new.valor_mensal is distinct from old.valor_mensal then
    update public.lancamentos l
       set valor = new.valor_mensal
     where l.contrato_id = new.id
       and l.status = 'pendente'
       and l.vencimento >= privado.hoje()
       and not exists (
         select 1 from public.notas_fiscais n
          where n.lancamento_id = l.id and n.status = 'emitida'
       );
  end if;

  if (new.dia_vencimento, new.vence_mes_seguinte, new.dia_util_cobranca)
     is distinct from (old.dia_vencimento, old.vence_mes_seguinte, old.dia_util_cobranca) then
    update public.lancamentos l
       set vencimento = privado.vencimento_contrato(
             l.competencia, new.dia_vencimento, new.vence_mes_seguinte, new.dia_util_cobranca)
     where l.contrato_id = new.id
       and l.status = 'pendente'
       and l.competencia >= v_mes_atual;
  end if;
  return null;
end
$$;
