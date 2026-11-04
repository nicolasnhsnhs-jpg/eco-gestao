-- =============================================================================
-- NFS-e: tributação do ISS por nota. A maioria é "operação tributável", mas há
-- tomador imune (ex.: patrimônio, renda ou serviços — CF/88 art. 150, VI, a), e a
-- nota precisa dizer isso. Os códigos são os do leiaute nacional.
-- =============================================================================

alter table public.notas_fiscais
  -- 1 tributável, 2 imunidade, 3 exportação, 4 não incidência. Vazio = 1.
  add column trib_issqn   smallint check (trib_issqn between 1 and 4),
  -- Só na imunidade: 0 não informado, 1 patrimônio/renda/serviços, 2 templos,
  -- 3 partidos/sindicatos/educação/assistência, 4 livros e papel, 5 fonogramas.
  add column tp_imunidade smallint check (tp_imunidade between 0 and 5),
  add constraint imunidade_so_imune check (tp_imunidade is null or trib_issqn = 2);

-- O rascunho copia também a tributação do ISS da nota anterior.
create or replace function privado.gerar_rascunhos_notas(p_mes date)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_mes   date := date_trunc('month', p_mes)::date;
  v_total int;
begin
  insert into public.notas_fiscais
    (tipo, status, cliente_id, contrato_id, lancamento_id, data_emissao, competencia, vencimento,
     forma_pagamento, descricao, codigo_tributacao, codigo_nbs, valor_servico, iss_retido,
     aliquota_iss, pis_cofins_retidos, aliquota_pis, aliquota_cofins, valor_pis, valor_cofins,
     valor_irrf, valor_csll, valor_inss, municipio_prestacao, cst_piscofins, tp_ret_piscofins,
     trib_issqn, tp_imunidade, observacoes)
  select
    'contrato', 'rascunho', u.cliente_id, k.id, l.id, v_mes, v_mes, l.vencimento,
    u.forma_pagamento,
    privado.descricao_proximo_mes(u.descricao, u.competencia, v_mes, u.vencimento, l.vencimento),
    u.codigo_tributacao, u.codigo_nbs, l.valor, u.iss_retido, u.aliquota_iss,
    u.pis_cofins_retidos, u.aliquota_pis, u.aliquota_cofins,
    -- PIS e COFINS: base × alíquota (o fisco confere a conta); os outros, na proporção.
    coalesce(round(l.valor * u.aliquota_pis / 100, 2), round(u.valor_pis * l.valor / u.valor_servico, 2)),
    coalesce(round(l.valor * u.aliquota_cofins / 100, 2), round(u.valor_cofins * l.valor / u.valor_servico, 2)),
    round(u.valor_irrf * l.valor / u.valor_servico, 2),
    round(u.valor_csll * l.valor / u.valor_servico, 2),
    round(u.valor_inss * l.valor / u.valor_servico, 2),
    u.municipio_prestacao, u.cst_piscofins, u.tp_ret_piscofins, u.trib_issqn, u.tp_imunidade,
    'Montada pelo sistema a partir da NF ' || coalesce(u.numero, '(sem número)') || '.'
  from public.contratos k
  join public.lancamentos l
    on l.contrato_id = k.id and l.competencia = v_mes and l.status <> 'cancelado'
  join lateral (
    select n.* from public.notas_fiscais n
     where n.contrato_id = k.id and n.status = 'emitida' and n.competencia < v_mes
     order by n.competencia desc, n.data_emissao desc
     limit 1
  ) u on true
  where k.status = 'ativo'
    and not exists (
      select 1 from public.notas_fiscais n
       where n.contrato_id = k.id and n.competencia = v_mes and n.status <> 'cancelada'
    );

  get diagnostics v_total = row_count;

  if v_total > 0 then
    insert into public.avisos (papel_destino, tipo, titulo, mensagem, link, chave_unica)
    select 'financeiro', 'notas_para_emitir',
           'Notas de contrato de ' || to_char(v_mes, 'MM/YYYY') || ' para conferir',
           count(*) || ' nota(s) prontas em rascunho. Confira e emita.',
           '/financeiro/notas?status=rascunho&mes=' || to_char(v_mes, 'YYYY-MM'),
           'rascunhos:' || to_char(v_mes, 'YYYY-MM')
      from public.notas_fiscais
     where status = 'rascunho' and competencia = v_mes
    on conflict (chave_unica) do nothing;
  end if;
  return v_total;
end
$$;
