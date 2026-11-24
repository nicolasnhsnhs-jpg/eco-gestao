-- =============================================================================
-- Observação fixa dos pontos (ex.: armadilha "retirada pelo cliente em 10/11",
-- "em manutenção pelo cliente") chega no celular do técnico (pedido de 24/11/2026).
--
-- Antes, a observação só ia para a OS quando ela era gerada (ou recopiada pela
-- tela da OS antes de começar). Escrita depois de o técnico começar, ou pela tela
-- da O.S salva com as visitas já geradas, ela não chegava. Agora, sempre que muda
-- no ponto, ela é atualizada nas OS abertas (agendada ou em execução) desse ponto.
-- O resto do que o técnico já anotou fica como está.
-- =============================================================================

create or replace function privado.levar_observacao_fixa_para_os()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.os_pontos o
     set observacao_fixa = new.observacao_fixa
    from public.ordens_servico s
   where o.ponto_id = new.id
     and s.id = o.os_id
     and s.status in ('agendada', 'em_execucao')
     and o.observacao_fixa is distinct from new.observacao_fixa;
  return null;
end
$$;

revoke execute on function privado.levar_observacao_fixa_para_os() from public;

create trigger levar_observacao_fixa_para_os
  after update of observacao_fixa on public.pontos_controle
  for each row
  when (old.observacao_fixa is distinct from new.observacao_fixa)
  execute function privado.levar_observacao_fixa_para_os();

-- As OS abertas hoje ficam iguais ao ponto.
update public.os_pontos o
   set observacao_fixa = p.observacao_fixa
  from public.pontos_controle p, public.ordens_servico s
 where o.ponto_id = p.id
   and s.id = o.os_id
   and s.status in ('agendada', 'em_execucao')
   and o.observacao_fixa is distinct from p.observacao_fixa;
