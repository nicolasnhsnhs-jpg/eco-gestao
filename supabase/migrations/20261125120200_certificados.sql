-- =============================================================================
-- Certificados de serviço (controle de pragas, reservatório, coifa, sucção…)
--
-- Feito a partir dos certificados que a empresa usa hoje (PowerPoint):
--   - cada tipo de serviço tem o seu modelo (cor do fundo, título e blocos);
--   - frase "Certificamos para os devidos fins…" com cliente, data(s), endereço e CNPJ;
--   - áreas atendidas, produtos (princípio ativo, registro MS, quantidade, lote,
--     fabricação e validade), reservatórios (reservatório) ou descrição/MTR (sucção);
--   - responsável técnico e validade, que segue duas regras:
--       contrato → vale até o ÚLTIMO DIA DO MÊS ("Certificado válido até o dia 30/04/2027.");
--       avulso   → vale até a data exata: o dia do serviço vai embaixo
--                  ("Esteio, 12 de Setembro de 2026.") e a validade ao lado ("Validade: 06 meses").
--     A renovação muda de cliente para cliente (mensal, trimestral, quadrimestral, semestral…).
--
-- Número sequencial por ano (CERT-2026-0001). Os dados do cliente e dos produtos
-- ficam "congelados" na emissão: mudar o cadastro depois não muda o certificado.
-- O PDF é montado na tela a partir destes dados.
-- Quem usa: Administrador e ADM. Certificado não se apaga: cancela-se, com motivo.
-- =============================================================================

create function privado.pode_emitir_certificado()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(privado.meu_papel() in ('admin', 'administrativo'), false)
$$;

revoke execute on function privado.pode_emitir_certificado() from public;
grant execute on function privado.pode_emitir_certificado() to authenticated;

-- -----------------------------------------------------------------------------
-- Catálogo de produtos (com o lote em uso). Na emissão, o produto é copiado para
-- o certificado; trocar o lote aqui não muda certificados já emitidos.
-- -----------------------------------------------------------------------------
create table public.produtos_certificado (
  id              uuid primary key default gen_random_uuid(),
  -- Ex.: "FENDONA" (pode ficar vazio)
  nome_comercial  text check (nome_comercial is null or char_length(trim(nome_comercial)) between 1 and 80),
  -- Ex.: "Alfa-Cipermetrina"
  principio_ativo text not null check (char_length(trim(principio_ativo)) between 2 and 160),
  -- Ex.: "MS 304040031" ou "Isento de Registro"
  registro        text check (registro is null or char_length(trim(registro)) <= 80),
  lote            text check (lote is null or char_length(trim(lote)) <= 60),
  -- Mês de fabricação e de validade do lote (guardado como o 1º dia do mês).
  fabricacao      date,
  validade        date,
  -- Quantidade mais usada, para já vir preenchida (ex.: "100ml").
  quantidade_padrao text check (quantidade_padrao is null or char_length(trim(quantidade_padrao)) <= 40),
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references public.perfis (id),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.perfis (id),
  constraint lote_valido check (validade is null or fabricacao is null or validade >= fabricacao)
);

comment on table public.produtos_certificado is 'Produtos (e lotes) que aparecem nos certificados.';

create index produtos_certificado_criado_por_idx on public.produtos_certificado (criado_por);
create index produtos_certificado_atualizado_por_idx on public.produtos_certificado (atualizado_por);

create trigger carimbar before insert or update on public.produtos_certificado
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.produtos_certificado
  for each row execute function privado.registrar_auditoria();

alter table public.produtos_certificado enable row level security;

create policy "admin e ADM veem produtos" on public.produtos_certificado for select to authenticated
  using (privado.pode_emitir_certificado());
create policy "admin e ADM cadastram produtos" on public.produtos_certificado for insert to authenticated
  with check (privado.pode_emitir_certificado());
create policy "admin e ADM alteram produtos" on public.produtos_certificado for update to authenticated
  using (privado.pode_emitir_certificado()) with check (privado.pode_emitir_certificado());

revoke all on public.produtos_certificado from anon, authenticated;
grant select, insert, update on public.produtos_certificado to authenticated;
grant all on public.produtos_certificado to service_role;

-- -----------------------------------------------------------------------------
-- Certificados emitidos
-- -----------------------------------------------------------------------------
create table public.certificados (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,
  -- Layout do PDF: pragas (verde), reservatorio (azul), coifa e succao (cinza), geral (cinza).
  modelo              text not null default 'geral'
                        check (modelo in ('pragas', 'reservatorio', 'coifa', 'succao', 'geral')),
  cliente_id          uuid not null references public.clientes (id),
  endereco_id         uuid references public.enderecos (id) on delete set null,
  tipo_servico_id     uuid not null references public.tipos_servico (id),
  -- De onde veio (opcionais: dá para emitir avulso).
  os_id               uuid references public.ordens_servico (id) on delete set null,
  servico_id          uuid references public.servicos (id) on delete set null,

  -- Ex.: "CONTROLE DE INSETOS E CONTROLE DE ROEDORES"
  titulo              text not null check (char_length(trim(titulo)) between 3 and 160),
  -- Ex.: "baratas, formigas, traças e roedores" (só controle de pragas)
  pragas_alvo         text,
  -- Ex.: "CONTROLE de INSETOS" → "…foram realizados os serviços de CONTROLE de INSETOS nas dependências…"
  servico_descrito    text not null check (char_length(trim(servico_descrito)) between 3 and 200),
  -- Frase extra depois da declaração (ex.: "O Processo de Desinfecção foi através de limpeza mecânica.")
  complemento         text,
  data_execucao       date not null,
  -- Outros dias do mesmo serviço (ex.: apartamentos feitos em 21/10 e 27/10).
  outras_datas        date[] not null default '{}',
  -- Áreas atendidas, uma por linha.
  areas               text,
  -- [{"nome_comercial","principio_ativo","registro","quantidade","lote","fabricacao","validade"}]
  produtos            jsonb not null default '[]' check (jsonb_typeof(produtos) = 'array'),
  -- Reservatório: [{"quantidade","local","metragem","produto"}]
  reservatorios       jsonb not null default '[]' check (jsonb_typeof(reservatorios) = 'array'),
  -- Sucção: descrição do serviço, nº do MTR e volume retirado.
  descricao           text,
  mtr                 text,
  volume              text,
  -- Validade: "contrato" (até o fim do mês) ou "avulso" (até a data exata).
  tipo_validade       text not null default 'avulso' check (tipo_validade in ('contrato', 'avulso')),
  validade_meses      smallint check (validade_meses between 1 and 60),
  validade            date,
  -- Ex.: "Monitoramento quinzenal durante o período de 6 meses."
  observacao_final    text,
  responsavel_nome    text,
  responsavel_registro text,
  -- Cópia dos dados do cliente e da unidade no dia da emissão.
  ficha_cliente       jsonb not null default '{}',

  cancelado_em        timestamptz,
  cancelado_por       uuid references public.perfis (id),
  motivo_cancelamento text,
  criado_em           timestamptz not null default now(),
  criado_por          uuid references public.perfis (id),
  atualizado_em       timestamptz not null default now(),
  atualizado_por      uuid references public.perfis (id),

  constraint validade_depois_da_execucao check (validade is null or validade >= data_execucao),
  constraint cancelamento_com_motivo check (
    cancelado_em is null or char_length(trim(coalesce(motivo_cancelamento, ''))) >= 5
  )
);

comment on table public.certificados is 'Certificados de serviço emitidos para os clientes.';

create index certificados_cliente_idx on public.certificados (cliente_id, data_execucao desc);
create index certificados_data_idx on public.certificados (data_execucao desc);
create index certificados_endereco_idx on public.certificados (endereco_id);
create index certificados_tipo_idx on public.certificados (tipo_servico_id);
create index certificados_os_idx on public.certificados (os_id);
create index certificados_servico_idx on public.certificados (servico_id);
create index certificados_criado_por_idx on public.certificados (criado_por);
create index certificados_atualizado_por_idx on public.certificados (atualizado_por);
create index certificados_cancelado_por_idx on public.certificados (cancelado_por);

-- Antes de salvar: número, ficha do cliente, coerência com a OS/serviço e cancelamento.
create function privado.antes_salvar_certificado()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ano text;
begin
  if new.endereco_id is not null and not exists (
    select 1 from public.enderecos e where e.id = new.endereco_id and e.cliente_id = new.cliente_id
  ) then
    raise exception 'A unidade escolhida não é deste cliente.' using errcode = '23514';
  end if;
  if new.os_id is not null and not exists (
    select 1 from public.ordens_servico o where o.id = new.os_id and o.cliente_id = new.cliente_id
  ) then
    raise exception 'A OS escolhida não é deste cliente.' using errcode = '23514';
  end if;
  if new.servico_id is not null and not exists (
    select 1 from public.servicos s where s.id = new.servico_id and s.cliente_id = new.cliente_id
  ) then
    raise exception 'O serviço escolhido não é deste cliente.' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    v_ano := to_char(new.data_execucao, 'YYYY');
    new.numero := 'CERT-' || v_ano || '-'
               || lpad(privado.proximo_numero('certificado-' || v_ano)::text, 4, '0');
    new.cancelado_em := null;
    new.cancelado_por := null;
    new.motivo_cancelamento := null;
  else
    -- Número e cliente não mudam depois de emitido.
    new.numero := old.numero;
    new.cliente_id := old.cliente_id;
    if old.cancelado_em is not null then
      raise exception 'Este certificado foi cancelado e não pode mais ser alterado.'
        using errcode = '42501';
    end if;
    if new.cancelado_em is not null then
      new.cancelado_em := now();
      new.cancelado_por := auth.uid();
    end if;
  end if;

  -- A ficha é refeita na emissão e quando a unidade muda.
  if tg_op = 'INSERT' or new.endereco_id is distinct from old.endereco_id then
    new.ficha_cliente := privado.ficha_cliente(new.cliente_id, new.endereco_id) - 'contatos';
  else
    new.ficha_cliente := old.ficha_cliente;
  end if;
  return new;
end
$$;

revoke execute on function privado.antes_salvar_certificado() from public, authenticated;

create trigger antes_salvar before insert or update on public.certificados
  for each row execute function privado.antes_salvar_certificado();
create trigger carimbar before insert or update on public.certificados
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.certificados
  for each row execute function privado.registrar_auditoria();

-- O serviço realizado de origem passa a mostrar o número do certificado.
-- Roda como dono do banco: só preenche quando o serviço ainda não tem número
-- (o serviço já foi conferido como sendo do mesmo cliente no gatilho anterior).
create function privado.depois_emitir_certificado()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.servico_id is not null then
    update public.servicos set numero_certificado = new.numero
     where id = new.servico_id and coalesce(numero_certificado, '') = '';
  end if;
  return new;
end
$$;

revoke execute on function privado.depois_emitir_certificado() from public, authenticated;

create trigger depois_emitir after insert on public.certificados
  for each row execute function privado.depois_emitir_certificado();

alter table public.certificados enable row level security;

create policy "admin e ADM veem certificados" on public.certificados for select to authenticated
  using (privado.pode_emitir_certificado() and privado.pode_ver_cliente(cliente_id));
create policy "admin e ADM emitem certificados" on public.certificados for insert to authenticated
  with check (privado.pode_emitir_certificado() and privado.pode_ver_cliente(cliente_id));
create policy "admin e ADM corrigem certificados" on public.certificados for update to authenticated
  using (privado.pode_emitir_certificado() and privado.pode_ver_cliente(cliente_id))
  with check (privado.pode_emitir_certificado() and privado.pode_ver_cliente(cliente_id));

revoke all on public.certificados from anon, authenticated;
grant select on public.certificados to authenticated;
-- O número é sempre trocado pelo gatilho (o que vier da tela é ignorado).
grant insert (id, numero, modelo, cliente_id, endereco_id, tipo_servico_id, os_id, servico_id, titulo,
  pragas_alvo, servico_descrito, complemento, data_execucao, outras_datas, areas, produtos,
  reservatorios, descricao, mtr, volume, tipo_validade, validade_meses, validade,
  observacao_final, responsavel_nome, responsavel_registro)
  on public.certificados to authenticated;
grant update (modelo, endereco_id, tipo_servico_id, os_id, servico_id, titulo, pragas_alvo,
  servico_descrito, complemento, data_execucao, outras_datas, areas, produtos, reservatorios,
  descricao, mtr, volume, tipo_validade, validade_meses, validade, observacao_final,
  responsavel_nome, responsavel_registro, cancelado_em, motivo_cancelamento)
  on public.certificados to authenticated;
grant all on public.certificados to service_role;
