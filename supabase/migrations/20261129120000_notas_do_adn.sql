-- =============================================================================
-- Notas do Sistema Nacional (ADN): cópia das NFS-e que a empresa emitiu, também as
-- feitas fora deste sistema (Safe Nota, portal), para a nota avulsa poder copiar a
-- última do mesmo cliente.
--
-- O ADN não busca por cliente: entrega os documentos em sequência (NSU), de 50 em
-- 50. A função "nfse" (ação ultimasNotas) puxa o que veio depois do último NSU lido,
-- guarda o resumo aqui e devolve as últimas do CNPJ/CPF pedido.
--
-- Só a função (service role) mexe nestas tabelas; o app recebe a lista por ela.
-- =============================================================================

create table public.nfse_adn_notas (
  chave               text primary key check (chave ~ '^\d{50}$'),
  nsu                 bigint not null,
  numero              text,
  emitida_em          timestamptz,
  tomador_doc         text,
  tomador_nome        text,
  valor               numeric(12, 2),
  descricao           text,
  codigo_tributacao   text,
  codigo_municipal    text,
  codigo_nbs          text,
  municipio_prestacao text,
  iss_retido          boolean not null default false,
  aliquota_iss        numeric(5, 2),
  tp_ret_piscofins    smallint,
  aliquota_pis        numeric(5, 2),
  aliquota_cofins     numeric(5, 2),
  valor_pis           numeric(12, 2),
  valor_cofins        numeric(12, 2),
  -- vRetCSLL como veio: no leiaute novo é a soma das contribuições retidas.
  valor_ret_csll      numeric(12, 2),
  valor_irrf          numeric(12, 2),
  valor_inss          numeric(12, 2),
  cancelada           boolean not null default false,
  criado_em           timestamptz not null default now()
);

create index nfse_adn_notas_tomador on public.nfse_adn_notas (tomador_doc, emitida_em desc);

-- Até onde a leitura do ADN já foi (uma linha só).
create table public.nfse_adn_leitura (
  id            smallint primary key default 1 check (id = 1),
  ultimo_nsu    bigint not null default 0,
  atualizado_em timestamptz not null default now()
);
insert into public.nfse_adn_leitura (id) values (1);

alter table public.nfse_adn_notas enable row level security;
alter table public.nfse_adn_leitura enable row level security;
grant all on public.nfse_adn_notas to service_role;
grant all on public.nfse_adn_leitura to service_role;
