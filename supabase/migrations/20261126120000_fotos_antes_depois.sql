-- =============================================================================
-- OS: relatório fotográfico "antes" e "depois" nos serviços de limpeza.
-- O tipo de serviço diz se a OS pede as duas listas de fotos; o operador pode
-- mandar quantas quiser em cada uma (ex.: 3 reservatórios, 3 coifas).
-- As categorias 'foto_antes' e 'foto_depois' já existem em categoria_arquivo.
-- =============================================================================

alter table public.tipos_servico
  add column fotos_antes_depois boolean not null default false;

comment on column public.tipos_servico.fotos_antes_depois is
  'A OS deste tipo tem relatório fotográfico de antes e depois do serviço.';

-- Tudo que é limpeza (sucção, coifa, reservatórios, bebedouros, caixa de gordura…).
update public.tipos_servico
   set fotos_antes_depois = true
 where nome ilike '%limpeza%'
    or nome ilike '%suc%o%'
    or nome ilike '%bebedouro%'
    or nome ilike '%reservat%'
    or nome ilike '%hidrojat%';

-- O operador também envia as fotos de antes e depois nas OS dele (enquanto abertas).
drop policy "operador envia arquivos da OS" on public.arquivos;
create policy "operador envia arquivos da OS" on public.arquivos for insert to authenticated
  with check (
    os_id is not null and privado.os_e_minha(os_id) and privado.os_aberta(os_id)
    and categoria in ('foto_os', 'foto_antes', 'foto_depois', 'assinatura')
  );
