-- =============================================================================
-- Boleto gerado pelo próprio sistema, na API de Cobrança do Sicredi (unidade RS
-- primeiro). Quem faz o trabalho é a Edge Function "boleto" (e a "nfse", logo
-- depois de emitir, quando a nota é paga por boleto). O PDF do Sicredi fica em
-- arquivo_boleto_id, como o boleto anexado à mão, e segue no e-mail da nota.
-- =============================================================================

alter table public.notas_fiscais
  -- O boleto registrado no Sicredi para esta nota (nulo = anexado à mão ou sem boleto).
  add column boleto_nosso_numero    text,
  add column boleto_linha_digitavel text,
  add column boleto_codigo_barras   text,
  -- Pix copia e cola do boleto híbrido.
  add column boleto_pix             text,
  add column boleto_valor           numeric(14, 2),
  add column boleto_vencimento      date,
  -- Situação no Sicredi (EM CARTEIRA, LIQUIDADO, BAIXADO POR SOLICITACAO…), da última consulta.
  add column boleto_situacao        text,
  add column boleto_consultado_em   timestamptz,
  add column boleto_gerado_em       timestamptz,
  -- Enquanto a função registra o boleto, ninguém gera outro para a mesma nota.
  add column gerando_boleto_em      timestamptz,
  add column erro_boleto            text;

create unique index notas_fiscais_boleto_nosso_numero_idx
  on public.notas_fiscais (boleto_nosso_numero) where boleto_nosso_numero is not null;

comment on column public.notas_fiscais.boleto_nosso_numero is
  'Nosso número do boleto registrado no Sicredi pela função "boleto".';

-- -----------------------------------------------------------------------------
-- Configuração. boleto_ambiente: desligado → sandbox (testes do Sicredi, nada
-- vale) → producao. As credenciais ficam nos segredos (SICREDI_API_KEY e
-- SICREDI_CODIGO_ACESSO), nunca aqui.
-- -----------------------------------------------------------------------------

insert into public.configuracoes (chave, valor, descricao) values
  ('boleto_ambiente', 'desligado',
   'Boleto pelo sistema (Sicredi): desligado, sandbox (testes do Sicredi) ou producao.'),
  ('boleto_cooperativa', '', 'Sicredi: código da cooperativa (4 números).'),
  ('boleto_posto', '', 'Sicredi: código do posto/agência (2 números).'),
  ('boleto_codigo_beneficiario', '', 'Sicredi: código do beneficiário (convênio de cobrança, 5 números).'),
  ('boleto_tipo_cobranca', 'HIBRIDO', 'HIBRIDO (boleto com QR Code Pix) ou NORMAL.'),
  ('boleto_especie', 'DUPLICATA_SERVICO_INDICACAO', 'Espécie do documento no Sicredi.'),
  ('boleto_multa', '2', 'Multa por atraso (% do valor). 0 = sem multa.'),
  ('boleto_juros_mes', '1', 'Juros por atraso (% ao mês, cobrado por dia). 0 = sem juros.'),
  ('boleto_ao_emitir', 'sim',
   'sim: ao emitir uma nota paga por boleto, o sistema gera o boleto e manda junto no e-mail.')
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
  if new.chave = 'boleto_ambiente' and new.valor not in ('desligado', 'sandbox', 'producao') then
    raise exception 'Ambiente do boleto: desligado, sandbox ou producao.' using errcode = '23514';
  end if;
  if new.chave = 'boleto_cooperativa' and new.valor !~ '^(\d{4})?$' then
    raise exception 'A cooperativa do Sicredi tem 4 números.' using errcode = '23514';
  end if;
  if new.chave = 'boleto_posto' and new.valor !~ '^(\d{2})?$' then
    raise exception 'O posto do Sicredi tem 2 números.' using errcode = '23514';
  end if;
  if new.chave = 'boleto_codigo_beneficiario' and new.valor !~ '^(\d{5})?$' then
    raise exception 'O código do beneficiário do Sicredi tem 5 números.' using errcode = '23514';
  end if;
  if new.chave = 'boleto_tipo_cobranca' and new.valor not in ('HIBRIDO', 'NORMAL') then
    raise exception 'Tipo de cobrança: HIBRIDO ou NORMAL.' using errcode = '23514';
  end if;
  if new.chave in ('boleto_multa', 'boleto_juros_mes')
     and (new.valor !~ '^\d+(\.\d{1,2})?$' or new.valor::numeric >= 100) then
    raise exception 'Multa e juros do boleto: um percentual de 0 a 99,99.' using errcode = '23514';
  end if;
  if new.chave = 'boleto_ao_emitir' and new.valor not in ('sim', 'nao') then
    raise exception 'Boleto ao emitir: sim ou nao.' using errcode = '23514';
  end if;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end
$$;

-- Trava do registro: devolve true se esta chamada pegou a nota (ninguém gerando há 2 min
-- e sem boleto do Sicredi ainda).
create function public.travar_boleto_nota(p_nota_id uuid)
returns boolean
language sql security definer
set search_path = ''
as $$
  with t as (
    update public.notas_fiscais
       set gerando_boleto_em = now(), erro_boleto = null
     where id = p_nota_id
       and status <> 'cancelada'
       and boleto_nosso_numero is null
       and (gerando_boleto_em is null or gerando_boleto_em < now() - interval '2 minutes')
    returning 1
  )
  select exists (select 1 from t)
$$;

revoke execute on function public.travar_boleto_nota(uuid) from public, anon, authenticated;
grant execute on function public.travar_boleto_nota(uuid) to service_role;
