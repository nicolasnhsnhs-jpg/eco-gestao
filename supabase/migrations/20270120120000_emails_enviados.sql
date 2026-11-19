-- =============================================================================
-- E-mails enviados: registro de todo e-mail que o sistema manda ao cliente, para
-- o funcionário consultar sem abrir a caixa de e-mail e procurar a cópia.
--
--   setor 'financeiro'      nota fiscal (e boleto)       → Financeiro > E-mails enviados
--   setor 'administrativo'  certificado e/ou OS          → Administrativo > E-mails enviados
--   setor 'comercial'       proposta                     → Propostas > E-mails enviados
--
-- Quem grava: só as Edge Functions (service role), logo depois que o Resend aceita
-- o e-mail. Ninguém cadastra, altera nem apaga pela tela.
--
-- Quem vê:
--   admin e financeiro: tudo;
--   ADM: os do administrativo;
--   todos: os e-mails de proposta que enxergam (a regra da própria proposta) e os
--          que eles mesmos mandaram (o vendedor vê os dele).
-- =============================================================================

create table public.emails_enviados (
  id               uuid primary key default gen_random_uuid(),
  enviado_em       timestamptz not null default now(),
  setor            text not null check (setor in ('financeiro', 'administrativo', 'comercial')),
  tipo             text not null check (tipo in ('nota', 'proposta', 'certificado', 'os')),
  cliente_id       uuid references public.clientes (id) on delete set null,
  -- Nome do cliente na hora do envio (fica mesmo se o cadastro mudar).
  cliente_nome     text not null default '',
  para             text not null,
  copia_oculta     text,
  remetente        text,
  assunto          text not null,
  -- Resumo do que foi: "NF 123 + boleto", "Proposta 2026/045", "Certificado 12 + OS 33".
  descricao        text not null default '',
  -- Valor da nota ou da proposta (vazio no certificado e na OS).
  valor            numeric(14, 2),
  anexos           text[] not null default '{}',
  nota_id          uuid references public.notas_fiscais (id) on delete set null,
  proposta_id      uuid references public.propostas (id) on delete set null,
  certificado_id   uuid references public.certificados (id) on delete set null,
  os_ids           uuid[] not null default '{}',
  enviado_por      uuid references public.perfis (id) on delete set null,
  -- A nota que sai sozinha logo depois de emitida (ou ao anexar o PDF).
  automatico       boolean not null default false,
  resend_id        text,
  busca            text generated always as (
    privado.sem_acento(cliente_nome || ' ' || para || ' ' || descricao || ' ' || assunto)
  ) stored
);

comment on table public.emails_enviados is
  'Registro dos e-mails mandados ao cliente pelo sistema (nota, proposta, certificado, OS).';

create index emails_enviados_setor_idx on public.emails_enviados (setor, enviado_em desc);
create index emails_enviados_enviado_em_idx on public.emails_enviados (enviado_em desc);
create index emails_enviados_cliente_idx on public.emails_enviados (cliente_id);
create index emails_enviados_nota_idx on public.emails_enviados (nota_id);
create index emails_enviados_proposta_idx on public.emails_enviados (proposta_id);
create index emails_enviados_certificado_idx on public.emails_enviados (certificado_id);
create index emails_enviados_enviado_por_idx on public.emails_enviados (enviado_por);
create index emails_enviados_busca_idx on public.emails_enviados
  using gin (busca extensions.gin_trgm_ops);

alter table public.emails_enviados enable row level security;

create policy "ver e-mails enviados" on public.emails_enviados for select to authenticated
  using (
    privado.tem_acesso_total()
    or (setor = 'administrativo' and privado.meu_papel() = 'administrativo')
    or (setor = 'comercial' and proposta_id is not null and privado.pode_ver_proposta(proposta_id))
    or (enviado_por = (select auth.uid()) and privado.meu_papel() is not null)
  );

revoke all on public.emails_enviados from anon;
revoke insert, update, delete on public.emails_enviados from authenticated;
grant select on public.emails_enviados to authenticated;
