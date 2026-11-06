-- =============================================================================
-- Aviso de certificado de contrato: 14 dias antes (era 15) e texto que diz o que
-- fazer: agendar a próxima limpeza e emitir o novo certificado.
-- O resto das regras continua como em 20261126120100_avisos_certificados_contrato.
-- =============================================================================

create or replace function privado.gerar_avisos_certificados()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_hoje  date := privado.hoje();
  v_total integer;
begin
  insert into public.avisos (papel_destino, tipo, titulo, mensagem, link, certificado_id, chave_unica)
  select
    'administrativo',
    'certificado_contrato_vencendo',
    case when ce.validade < v_hoje
      then 'Certificado de contrato vencido: agendar ' || lower(t.nome)
      else 'Certificado de contrato vencendo: agendar ' || lower(t.nome)
    end,
    concat_ws(' · ',
      coalesce(c.nome_fantasia, c.nome),
      e.apelido,
      ce.numero,
      case when ce.validade < v_hoje then 'venceu em ' else 'vale até ' end
        || to_char(ce.validade, 'DD/MM/YYYY')
    ) || '. É contrato: agende o serviço e emita o novo certificado.',
    '/certificados/' || ce.id,
    ce.id,
    'certificado:' || ce.id
  from public.certificados ce
  join public.clientes c on c.id = ce.cliente_id
  join public.tipos_servico t on t.id = ce.tipo_servico_id
  left join public.enderecos e on e.id = ce.endereco_id
  where ce.tipo_validade = 'contrato'
    and ce.cancelado_em is null
    and ce.validade is not null
    and ce.validade - 14 <= v_hoje
    and c.ativo
    and exists (
      select 1 from public.contratos ct where ct.cliente_id = ce.cliente_id and ct.status = 'ativo'
    )
    -- Já foi emitido o certificado seguinte? Então este não precisa avisar.
    and not exists (
      select 1 from public.certificados n
       where n.cliente_id = ce.cliente_id
         and n.endereco_id is not distinct from ce.endereco_id
         and n.tipo_servico_id = ce.tipo_servico_id
         and n.cancelado_em is null
         and n.id <> ce.id
         and n.validade > ce.validade
    )
  on conflict (chave_unica) do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end
$$;

-- Avisos já abertos ficam com o texto novo.
update public.avisos a
   set titulo = case when ce.validade < privado.hoje()
                  then 'Certificado de contrato vencido: agendar ' || lower(t.nome)
                  else 'Certificado de contrato vencendo: agendar ' || lower(t.nome)
                end,
       mensagem = concat_ws(' · ',
                    coalesce(c.nome_fantasia, c.nome),
                    e.apelido,
                    ce.numero,
                    case when ce.validade < privado.hoje() then 'venceu em ' else 'vale até ' end
                      || to_char(ce.validade, 'DD/MM/YYYY')
                  ) || '. É contrato: agende o serviço e emita o novo certificado.'
  from public.certificados ce
  join public.clientes c on c.id = ce.cliente_id
  join public.tipos_servico t on t.id = ce.tipo_servico_id
  left join public.enderecos e on e.id = ce.endereco_id
 where a.certificado_id = ce.id
   and a.tipo = 'certificado_contrato_vencendo'
   and a.resolvido_em is null;
