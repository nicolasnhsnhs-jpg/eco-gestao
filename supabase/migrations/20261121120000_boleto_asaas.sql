-- =============================================================================
-- Boleto também pelo Asaas, além do Sicredi. Cada nota diz por qual banco sai
-- o boleto (boleto_banco): no rascunho é a escolha para a emissão; depois de
-- registrado, é o banco do boleto. O id da cobrança no banco fica em
-- boleto_cobranca_id (Sicredi: o nosso número; Asaas: o id "pay_…").
-- =============================================================================

alter table public.notas_fiscais
  add column boleto_banco       text check (boleto_banco in ('sicredi', 'asaas')),
  add column boleto_cobranca_id text;

-- Boletos do Sicredi registrados antes desta mudança.
update public.notas_fiscais
   set boleto_banco = 'sicredi', boleto_cobranca_id = boleto_nosso_numero
 where boleto_nosso_numero is not null;

drop index if exists public.notas_fiscais_boleto_nosso_numero_idx;
create unique index notas_fiscais_boleto_cobranca_idx
  on public.notas_fiscais (boleto_banco, boleto_cobranca_id) where boleto_cobranca_id is not null;

comment on column public.notas_fiscais.boleto_banco is
  'Banco do boleto: sicredi ou asaas (no rascunho, o escolhido para a emissão).';
comment on column public.notas_fiscais.boleto_cobranca_id is
  'Id da cobrança no banco (Sicredi: nosso número; Asaas: id da cobrança).';

-- Trava do registro: agora vale para os dois bancos.
create or replace function public.travar_boleto_nota(p_nota_id uuid)
returns boolean
language sql security definer
set search_path = ''
as $$
  with t as (
    update public.notas_fiscais
       set gerando_boleto_em = now(), erro_boleto = null
     where id = p_nota_id
       and status <> 'cancelada'
       and boleto_cobranca_id is null
       and (gerando_boleto_em is null or gerando_boleto_em < now() - interval '2 minutes')
    returning 1
  )
  select exists (select 1 from t)
$$;

-- -----------------------------------------------------------------------------
-- Configuração. boleto_ambiente continua sendo o do Sicredi; o Asaas tem o seu.
-- boleto_ao_emitir: por qual banco sai o boleto da nota paga por boleto, quando
-- o rascunho não escolheu (nao, sicredi, asaas ou valor: até boleto_limite_asaas
-- pelo Asaas, acima pelo Sicredi).
-- -----------------------------------------------------------------------------

insert into public.configuracoes (chave, valor, descricao) values
  ('boleto_asaas_ambiente', 'desligado',
   'Boleto pelo Asaas: desligado, sandbox (testes do Asaas) ou producao.'),
  ('boleto_limite_asaas', '',
   'Regra "por valor": boletos até este valor (R$) saem pelo Asaas; acima, pelo Sicredi.')
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
  if new.chave in ('boleto_ambiente', 'boleto_asaas_ambiente')
     and new.valor not in ('desligado', 'sandbox', 'producao') then
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
  if new.chave = 'boleto_ao_emitir' and new.valor not in ('nao', 'sicredi', 'asaas', 'valor') then
    raise exception 'Boleto ao emitir: nao, sicredi, asaas ou valor.' using errcode = '23514';
  end if;
  if new.chave = 'boleto_limite_asaas' and new.valor !~ '^(\d+(\.\d{1,2})?)?$' then
    raise exception 'O limite do Asaas é um valor em reais (ex.: 1500 ou 1500.50).' using errcode = '23514';
  end if;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end
$$;

-- Depois da validação nova (a antiga só aceitava sim ou nao).
update public.configuracoes
   set valor = case valor when 'sim' then 'sicredi' else valor end,
       descricao = 'Banco do boleto ao emitir nota paga por boleto: nao, sicredi, asaas ou valor.'
 where chave = 'boleto_ao_emitir';
