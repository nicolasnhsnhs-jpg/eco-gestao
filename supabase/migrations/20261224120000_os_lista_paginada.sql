-- =============================================================================
-- Lista de O.S salvas em páginas de 20 (rolando carrega mais) e busca no banco.
--
-- Antes a tela baixava todos os modelos com TODOS os pontos (mais de 9 mil no RS)
-- e o RLS conferia a permissão ponto por ponto: a lista demorava muito para abrir.
-- Agora esta função devolve só os ids da página, na ordem do nome, com as
-- contagens de pontos já feitas (só dos 20 da página).
-- Busca: nome, nome fantasia, CNPJ/CPF e telefones do cliente (sem acento),
-- nome da unidade e nome do serviço.
-- =============================================================================

create function public.buscar_modelos_os(
  p_categoria public.categoria_os,
  p_busca     text default '',
  p_limite    int default 20,
  p_pular     int default 0
)
returns table (
  modelo_id   uuid,
  porta_iscas int,
  armadilhas  int,
  coifas      int,
  bebedouros  int
)
language sql stable security definer
set search_path = ''
as $$
  with termo as (
    select privado.sem_acento(trim(coalesce(p_busca, ''))) as texto,
           regexp_replace(coalesce(p_busca, ''), '[^0-9]', '', 'g') as digitos
  ),
  pagina as (
    select m.id,
           row_number() over (
             order by lower(coalesce(c.nome_fantasia, c.nome)), lower(coalesce(e.apelido, '')), m.id
           ) as ordem
    from public.os_modelos m
    join public.clientes c on c.id = m.cliente_id
    join public.tipos_servico t on t.id = m.tipo_servico_id
    left join public.enderecos e on e.id = m.endereco_id
    cross join termo
    where (select privado.pode_gerir_os())
      and privado.pode_ver_cliente_linha(c.vendedor_responsavel_id)
      and m.ativo
      and m.categoria = p_categoria
      and (
        termo.texto = ''
        or c.busca_texto like '%' || termo.texto || '%'
        or privado.sem_acento(e.apelido) like '%' || termo.texto || '%'
        or privado.sem_acento(t.nome) like '%' || termo.texto || '%'
        or (length(termo.digitos) >= 4 and c.cpf_cnpj like '%' || termo.digitos || '%')
      )
    order by ordem
    limit least(greatest(p_limite, 1), 100)
    offset greatest(p_pular, 0)
  )
  select pg.id,
         (count(p.id) filter (where p.tipo = 'porta_isca'))::int,
         (count(p.id) filter (where p.tipo = 'armadilha_luminosa'))::int,
         (count(p.id) filter (where p.tipo = 'coifa'))::int,
         (count(p.id) filter (where p.tipo in ('bebedouro', 'bebedouro_garrafao')))::int
  from pagina pg
  left join public.pontos_controle p on p.modelo_id = pg.id and p.ativo
  group by pg.id, pg.ordem
  order by pg.ordem
$$;

revoke execute on function public.buscar_modelos_os(public.categoria_os, text, int, int)
  from public, anon;
grant execute on function public.buscar_modelos_os(public.categoria_os, text, int, int)
  to authenticated;
