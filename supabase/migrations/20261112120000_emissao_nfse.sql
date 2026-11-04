-- =============================================================================
-- Emissão da NFS-e pelo próprio sistema, direto na API do Sistema Nacional
-- (Sefin Nacional), com o certificado A1 da empresa. Quem faz o trabalho é a
-- Edge Function "nfse"; aqui ficam a configuração, a numeração da DPS e o que
-- a nota precisa guardar.
-- =============================================================================

-- O endereço do tomador vai na nota com o código IBGE do município (obrigatório
-- para o indicador de operação das notas da empresa).
alter table public.enderecos
  add column codigo_ibge text check (codigo_ibge ~ '^\d{7}$');

-- Mudou o CEP sem mandar o código novo: o antigo deixa de valer (a função "nfse" busca
-- de novo pelo CEP na hora de emitir).
create or replace function privado.antes_salvar_endereco()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.cep is distinct from old.cep
     and new.codigo_ibge is not distinct from old.codigo_ibge then
    new.codigo_ibge := null;
  end if;
  -- Só um endereço principal por cliente: ao marcar um, os outros deixam de ser.
  if new.principal then
    update public.enderecos
       set principal = false
     where cliente_id = new.cliente_id and id <> new.id and principal;
  end if;
  return new;
end
$$;

alter table public.notas_fiscais
  -- A DPS que gerou a nota: série + número (o Id da DPS sai deles) e o ambiente.
  add column serie_dps        text,
  add column ambiente_nfse    text check (ambiente_nfse in ('producao', 'homologacao')),
  add column arquivo_xml_id   uuid references public.arquivos (id) on delete set null,
  -- Emitida por aqui (e não importada nem lançada à mão).
  add column emitida_sistema  boolean not null default false,
  -- Enquanto a função envia a nota, ninguém manda a mesma de novo.
  add column emitindo_em      timestamptz,
  add column erro_emissao     text,
  -- Campos da nota que mudam de cliente para cliente (vêm da nota anterior):
  -- município onde o serviço é prestado (IBGE), CST do PIS/COFINS (00, 01, 07, 08…) e o
  -- tipo de retenção do PIS/COFINS/CSLL no código do leiaute nacional (0 a 9).
  add column municipio_prestacao text check (municipio_prestacao ~ '^\d{7}$'),
  add column cst_piscofins       text check (cst_piscofins ~ '^\d{2}$'),
  add column tp_ret_piscofins    smallint check (tp_ret_piscofins between 0 and 9);

-- O rascunho copia esses campos da nota anterior.
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
     observacoes)
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
    u.municipio_prestacao, u.cst_piscofins, u.tp_ret_piscofins,
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

-- XML da nota autorizada também vai para o Storage.
update storage.buckets
   set allowed_mime_types = array_append(allowed_mime_types, 'application/xml')
 where id = 'arquivos' and not ('application/xml' = any (allowed_mime_types));

-- -----------------------------------------------------------------------------
-- Configuração (por unidade). nfse_ambiente: desligado → homologacao (testes no
-- ambiente do governo, nada vale) → producao.
-- -----------------------------------------------------------------------------

insert into public.configuracoes (chave, valor, descricao) values
  ('nfse_ambiente', 'desligado',
   'Emissão da NFS-e pelo sistema: desligado, homologacao (testes do governo) ou producao.'),
  ('nfse_serie', '2', 'Série da DPS das notas emitidas pelo sistema (o Safenota usa a 1).'),
  ('nfse_inscricao_municipal', '', 'Inscrição municipal da empresa (prestador).'),
  ('nfse_municipio_ibge', '', 'Código IBGE do município da empresa (onde a nota é emitida).'),
  ('nfse_regime_simples', '1', 'Situação no Simples Nacional: 1 não optante, 2 MEI, 3 ME/EPP.'),
  ('nfse_regime_especial', '0', 'Regime especial de tributação (0 = nenhum).'),
  ('nfse_cst_piscofins', '01', 'CST do PIS/COFINS (01 = tributável com alíquota básica).'),
  ('nfse_aliquota_csll', '1', 'Alíquota da CSLL retida (%), quando o tomador retém.'),
  ('nfse_ibscbs_indicador_operacao', '050102', 'IBS/CBS: código indicador da operação.'),
  ('nfse_ibscbs_cst', '000', 'IBS/CBS: situação tributária.'),
  ('nfse_ibscbs_classificacao', '000001', 'IBS/CBS: classificação tributária.')
on conflict (chave) do nothing;

create or replace function privado.antes_salvar_configuracao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Validação das chaves conhecidas.
  if new.chave = 'contrato_dia_util_cobranca'
     and (new.valor !~ '^\d+$' or new.valor::int not between 1 and 20) then
    raise exception 'O dia útil de cobrança precisa ser um número de 1 a 20.' using errcode = '23514';
  end if;
  if new.chave = 'comissao_percentual_padrao'
     and (new.valor !~ '^\d+(\.\d{1,2})?$' or new.valor::numeric > 100) then
    raise exception 'O percentual de comissão precisa estar entre 0 e 100.' using errcode = '23514';
  end if;
  if new.chave = 'nfse_ambiente' and new.valor not in ('desligado', 'homologacao', 'producao') then
    raise exception 'Ambiente da NFS-e: desligado, homologacao ou producao.' using errcode = '23514';
  end if;
  if new.chave = 'nfse_serie' and new.valor !~ '^0{0,4}[1-9]\d{0,4}$' then
    raise exception 'A série da DPS é um número de 1 a 49999.' using errcode = '23514';
  end if;
  if new.chave = 'nfse_municipio_ibge' and new.valor !~ '^(\d{7})?$' then
    raise exception 'O código IBGE do município tem 7 dígitos.' using errcode = '23514';
  end if;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end
$$;

-- -----------------------------------------------------------------------------
-- Numeração da DPS: um contador por ambiente e série. A nota guarda o número
-- reservado; se o envio falhar, a nova tentativa usa o MESMO número (a Sefin
-- reconhece a DPS já processada e não duplica a nota).
-- -----------------------------------------------------------------------------

create table public.nfse_numeracao (
  ambiente text not null check (ambiente in ('producao', 'homologacao')),
  serie    text not null,
  ultimo   bigint not null default 0 check (ultimo >= 0),
  primary key (ambiente, serie)
);

alter table public.nfse_numeracao enable row level security;
revoke all on public.nfse_numeracao from anon, authenticated;
grant all on public.nfse_numeracao to service_role;

-- Só a Edge Function (chave secreta) chama.
create function public.reservar_numero_dps(p_nota_id uuid, p_ambiente text, p_serie text)
returns table (serie text, numero text)
language plpgsql security definer
set search_path = ''
as $$
-- serie/numero são também as colunas devolvidas: nos comandos, valem as da tabela.
#variable_conflict use_column
declare
  v_nota public.notas_fiscais;
  v_num  bigint;
begin
  select * into v_nota from public.notas_fiscais where id = p_nota_id for update;
  if not found then
    raise exception 'Nota não encontrada.';
  end if;
  -- Já tem número deste ambiente: reaproveita.
  if v_nota.numero_dps is not null and v_nota.ambiente_nfse = p_ambiente then
    return query select v_nota.serie_dps, v_nota.numero_dps;
    return;
  end if;

  insert into public.nfse_numeracao (ambiente, serie, ultimo) values (p_ambiente, p_serie, 1)
  on conflict (ambiente, serie) do update set ultimo = public.nfse_numeracao.ultimo + 1
  returning ultimo into v_num;

  -- Em homologação a nota real não muda: o número fica só no ensaio.
  if p_ambiente = 'producao' then
    update public.notas_fiscais
       set serie_dps = p_serie, numero_dps = v_num::text, ambiente_nfse = p_ambiente
     where id = p_nota_id;
  end if;
  return query select p_serie, v_num::text;
end
$$;

revoke execute on function public.reservar_numero_dps(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reservar_numero_dps(uuid, text, text) to service_role;

-- Trava de envio: devolve true se esta chamada pegou a nota (ninguém emitindo há 2 min).
create function public.travar_emissao_nota(p_nota_id uuid)
returns boolean
language sql security definer
set search_path = ''
as $$
  with t as (
    update public.notas_fiscais
       set emitindo_em = now(), erro_emissao = null
     where id = p_nota_id
       and status = 'rascunho'
       and (emitindo_em is null or emitindo_em < now() - interval '2 minutes')
    returning 1
  )
  select exists (select 1 from t)
$$;

revoke execute on function public.travar_emissao_nota(uuid) from public, anon, authenticated;
grant execute on function public.travar_emissao_nota(uuid) to service_role;

-- O PDF e o XML da nota emitida também ficam ligados à conta a receber.
comment on column public.notas_fiscais.arquivo_xml_id is 'XML da NFS-e autorizada (guardado por 5 anos, como o fisco exige).';
