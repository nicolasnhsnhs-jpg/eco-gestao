-- =============================================================================
-- Última troca de lâmpada também nas OS que já estavam agendadas.
--
-- Ao concluir uma OS com lâmpada trocada, a armadilha (pontos_controle) guarda a
-- data (privado.fixar_troca_lampada, 20270105120100_os_feromonio_moscas.sql), e a
-- OS gerada DEPOIS copia a data. Mas a OS que já estava agendada (ex.: rota do mês
-- agendada de uma vez) tinha copiado a data antiga e continuava mostrando ela.
-- O mesmo quando o escritório corrigia a data na O.S salva.
--
-- Agora, sempre que a data muda na armadilha, ela vai também para as OS ainda não
-- começadas (rascunho ou agendada) que têm esse ponto.
-- =============================================================================

create or replace function privado.levar_troca_lampada_as_os()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.os_pontos op
     set ultima_troca_lampada = new.ultima_troca_lampada
    from public.ordens_servico s
   where op.ponto_id = new.id
     and s.id = op.os_id
     and s.status in ('rascunho', 'agendada')
     and op.ultima_troca_lampada is distinct from new.ultima_troca_lampada;
  return null;
end
$$;

revoke execute on function privado.levar_troca_lampada_as_os() from public;

create trigger levar_troca_lampada_as_os
  after update of ultima_troca_lampada on public.pontos_controle
  for each row
  when (old.ultima_troca_lampada is distinct from new.ultima_troca_lampada)
  execute function privado.levar_troca_lampada_as_os();
