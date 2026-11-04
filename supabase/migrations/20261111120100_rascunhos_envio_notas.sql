-- =============================================================================
-- Notas de contrato do mês montadas pelo sistema (rascunhos) e envio do PDF da
-- nota ao cliente por e-mail.
--
-- Todo dia 1 o sistema copia a última nota emitida de cada contrato, como o
-- financeiro fazia à mão: mesma descrição e impostos, mês e vencimento do mês
-- novo, valor da mensalidade (aditivo ajusta os impostos na mesma proporção).
-- O financeiro confere, emite e anexa o PDF; o sistema manda ao e-mail do
-- cliente. Sem e-mail cadastrado (ou se o envio falhar), vira aviso de envio
-- pendente para o financeiro mandar à mão.
-- =============================================================================

alter table public.notas_fiscais
  add column arquivo_pdf_id uuid references public.arquivos (id) on delete set null,
  add column enviada_em     timestamptz,
  add column enviada_para   text,
  add column erro_envio     text;

-- Um rascunho por contrato e mês.
create unique index notas_fiscais_rascunho_unico on public.notas_fiscais (contrato_id, competencia)
  where status = 'rascunho';

-- Para onde vai a nota: o e-mail do cliente ou, sem ele, o do contato principal.
create function privado.email_do_cliente(p_cliente_id uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    nullif(trim(c.email), ''),
    (select nullif(trim(k.email), '') from public.contatos_cliente k
      where k.cliente_id = c.id and nullif(trim(k.email), '') is not null
      order by k.principal desc, k.criado_em limit 1))
  from public.clientes c where c.id = p_cliente_id
$$;

revoke execute on function privado.email_do_cliente(uuid) from public;
grant execute on function privado.email_do_cliente(uuid) to authenticated;

-- A descrição do mês seguinte (igual a proximaNota em src/features/financeiro/notas.ts):
-- troca a data de vencimento e o "NOVEMBRO/2026" do mês de referência.
create function privado.descricao_proximo_mes(
  p_descricao text, p_competencia_antiga date, p_competencia_nova date,
  p_vencimento_antigo date, p_vencimento_novo date)
returns text
language sql immutable
set search_path = ''
as $$
  with meses(m) as (
    select array['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO',
                 'SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO']
  )
  select regexp_replace(
           case when p_vencimento_antigo is null or p_vencimento_novo is null then p_descricao
                else replace(p_descricao, to_char(p_vencimento_antigo, 'DD/MM/YYYY'),
                             to_char(p_vencimento_novo, 'DD/MM/YYYY')) end,
           m[extract(month from p_competencia_antiga)::int] || '/' || extract(year from p_competencia_antiga),
           m[extract(month from p_competencia_nova)::int] || '/' || extract(year from p_competencia_nova),
           'gi')
    from meses
$$;

-- -----------------------------------------------------------------------------
-- Rascunhos do mês
-- -----------------------------------------------------------------------------

create function privado.gerar_rascunhos_notas(p_mes date)
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
     valor_irrf, valor_csll, valor_inss, observacoes)
  select
    'contrato', 'rascunho', u.cliente_id, k.id, l.id, v_mes, v_mes, l.vencimento,
    u.forma_pagamento,
    privado.descricao_proximo_mes(u.descricao, u.competencia, v_mes, u.vencimento, l.vencimento),
    u.codigo_tributacao, u.codigo_nbs, l.valor, u.iss_retido, u.aliquota_iss,
    u.pis_cofins_retidos, u.aliquota_pis, u.aliquota_cofins,
    round(u.valor_pis * l.valor / u.valor_servico, 2),
    round(u.valor_cofins * l.valor / u.valor_servico, 2),
    round(u.valor_irrf * l.valor / u.valor_servico, 2),
    round(u.valor_csll * l.valor / u.valor_servico, 2),
    round(u.valor_inss * l.valor / u.valor_servico, 2),
    'Montada pelo sistema a partir da NF ' || coalesce(u.numero, '(sem número)') || '.'
  from public.contratos k
  join public.lancamentos l
    on l.contrato_id = k.id and l.competencia = v_mes and l.status <> 'cancelado'
  -- A última nota emitida do contrato, de um mês anterior.
  join lateral (
    select n.* from public.notas_fiscais n
     where n.contrato_id = k.id and n.status = 'emitida' and n.competencia < v_mes
     order by n.competencia desc, n.data_emissao desc
     limit 1
  ) u on true
  where k.status = 'ativo'
    -- Ainda sem nota (nem rascunho) neste mês.
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

revoke execute on function privado.gerar_rascunhos_notas(date) from public, authenticated;

-- Todo dia às 5h55 (depois das mensalidades das 5h50): no dia 1 monta as notas do mês;
-- nos outros dias só pega o contrato que ficou de fora (ex.: nota antiga cadastrada depois).
select cron.schedule(
  'gerar-rascunhos-notas',
  '55 8 * * *',
  $$select privado.gerar_rascunhos_notas(privado.hoje())$$
);

-- -----------------------------------------------------------------------------
-- Aditivo ou troca do vencimento: o rascunho acompanha a mensalidade.
-- -----------------------------------------------------------------------------

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

  -- Rascunhos: valor (impostos na mesma proporção) e vencimento da mensalidade.
  update public.notas_fiscais n
     set valor_servico = l.valor,
         valor_pis    = round(n.valor_pis * l.valor / n.valor_servico, 2),
         valor_cofins = round(n.valor_cofins * l.valor / n.valor_servico, 2),
         valor_irrf   = round(n.valor_irrf * l.valor / n.valor_servico, 2),
         valor_csll   = round(n.valor_csll * l.valor / n.valor_servico, 2),
         valor_inss   = round(n.valor_inss * l.valor / n.valor_servico, 2),
         vencimento   = l.vencimento,
         descricao    = privado.descricao_proximo_mes(
                          n.descricao, n.competencia, n.competencia, n.vencimento, l.vencimento)
    from public.lancamentos l
   where n.lancamento_id = l.id
     and n.contrato_id = new.id
     and n.status = 'rascunho'
     and (n.valor_servico, n.vencimento) is distinct from (l.valor, l.vencimento);
  return null;
end
$$;

-- -----------------------------------------------------------------------------
-- Envio pendente: nota emitida, com PDF, ainda não enviada, e o cliente não tem
-- e-mail (ou o envio deu erro) → aviso para o financeiro. Enviada → aviso resolvido.
-- -----------------------------------------------------------------------------

create function privado.avisar_envio_nota()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.enviada_em is not null or new.status <> 'emitida' then
    update public.avisos set resolvido_em = now()
     where chave_unica = 'envio_nota:' || new.id and resolvido_em is null;
  elsif new.arquivo_pdf_id is not null
        and (new.erro_envio is not null or privado.email_do_cliente(new.cliente_id) is null) then
    insert into public.avisos (papel_destino, tipo, titulo, mensagem, link, lancamento_id, chave_unica)
    select 'financeiro', 'nota_envio_pendente',
           'Enviar NF ' || coalesce(new.numero, '') || ' ao cliente',
           concat_ws(' · ', coalesce(c.nome_fantasia, c.nome),
             coalesce(new.erro_envio, 'cliente sem e-mail cadastrado: envie à mão')),
           '/financeiro/notas/' || new.id, new.lancamento_id, 'envio_nota:' || new.id
      from public.clientes c where c.id = new.cliente_id
    on conflict (chave_unica) do update
      set mensagem = excluded.mensagem, resolvido_em = null;
  end if;
  return null;
end
$$;

revoke execute on function privado.avisar_envio_nota() from public, authenticated;

create trigger avisar_envio after insert or update of status, arquivo_pdf_id, enviada_em, erro_envio
  on public.notas_fiscais
  for each row execute function privado.avisar_envio_nota();

-- O rascunho que não vai ser emitido pode ser descartado (nota emitida só se cancela).
create policy "financeiro descarta rascunho" on public.notas_fiscais for delete to authenticated
  using (privado.tem_acesso_total() and status = 'rascunho');
grant delete on public.notas_fiscais to authenticated;
