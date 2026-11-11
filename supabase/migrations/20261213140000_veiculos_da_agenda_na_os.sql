-- =============================================================================
-- Veículos: os da agenda também na ordem de serviço.
--
-- A agenda tem o cadastro dela (sigla + placa: S3, CM10, GM16…) e a OS tinha
-- outro, vazio. A OS ganha a sigla, recebe os veículos da agenda e, daqui para
-- frente, todo veículo cadastrado ou alterado na agenda vai sozinho para a OS
-- (casando pela placa). Veículo da agenda sem placa válida fica só na agenda.
-- =============================================================================

alter table public.veiculos
  add column sigla text check (sigla is null or (sigla = upper(btrim(sigla)) and sigla <> ''));

-- "IWA 9709" → "IWA9709"; null se não for uma placa (antiga ou Mercosul).
create function privado.placa_normalizada(placa text)
returns text
language sql immutable
set search_path = ''
as $$
  select case
    when upper(regexp_replace(coalesce(placa, ''), '[^A-Za-z0-9]', '', 'g'))
         ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'
    then upper(regexp_replace(placa, '[^A-Za-z0-9]', '', 'g'))
  end
$$;

create function privado.copiar_veiculo_da_agenda()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_placa text := privado.placa_normalizada(new.placa);
begin
  if v_placa is null then
    return new;
  end if;
  insert into public.veiculos (placa, sigla, descricao, ativo)
  values (
    v_placa,
    new.codigo,
    case when char_length(new.codigo) >= 2 then new.codigo else 'Veículo ' || new.codigo end,
    new.ativo
  )
  on conflict (placa) do update
    set sigla = excluded.sigla,
        ativo = excluded.ativo;
  return new;
end
$$;

create trigger copiar_para_os after insert or update of codigo, placa, ativo
  on public.agenda_veiculos
  for each row execute function privado.copiar_veiculo_da_agenda();

-- Apagou na agenda: na OS só desativa (as OS antigas continuam apontando para ele).
create function privado.desativar_veiculo_tirado_da_agenda()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.veiculos
     set ativo = false
   where placa = privado.placa_normalizada(old.placa);
  return old;
end
$$;

create trigger desativar_na_os after delete on public.agenda_veiculos
  for each row execute function privado.desativar_veiculo_tirado_da_agenda();

-- Os que já estão na agenda.
insert into public.veiculos (placa, sigla, descricao, ativo)
select distinct on (privado.placa_normalizada(a.placa))
  privado.placa_normalizada(a.placa),
  a.codigo,
  case when char_length(a.codigo) >= 2 then a.codigo else 'Veículo ' || a.codigo end,
  a.ativo
from public.agenda_veiculos a
where privado.placa_normalizada(a.placa) is not null
on conflict (placa) do update
  set sigla = excluded.sigla,
      ativo = excluded.ativo;
