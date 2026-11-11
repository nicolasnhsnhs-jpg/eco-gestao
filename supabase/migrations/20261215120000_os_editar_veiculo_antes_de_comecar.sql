-- =============================================================================
-- OS: trocar o veículo antes de começar.
--
-- A ficha de execução nasce com o veículo da OS. Agora que o escritório pode
-- editar a OS agendada (troca de técnicos e de carro de última hora), a ficha
-- acompanha o veículo novo enquanto o operador ainda não começou.
-- =============================================================================

create function privado.depois_trocar_veiculo_os()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status in ('rascunho', 'agendada') then
    update public.os_execucao set veiculo_id = new.veiculo_id where os_id = new.id;
  end if;
  return null;
end
$$;

revoke execute on function privado.depois_trocar_veiculo_os() from public, authenticated;

create trigger depois_trocar_veiculo after update of veiculo_id on public.ordens_servico
  for each row when (new.veiculo_id is distinct from old.veiculo_id)
  execute function privado.depois_trocar_veiculo_os();
