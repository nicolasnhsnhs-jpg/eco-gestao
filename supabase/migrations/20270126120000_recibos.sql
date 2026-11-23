-- =============================================================================
-- Recibos (Financeiro > Recibos).
--
-- Para o que não dá para dar nota fiscal (uma taxa de deslocamento, por exemplo):
-- o financeiro preenche quem pagou, o que foi e o valor, e o sistema gera o PDF do
-- recibo com os dados da empresa. O número é sequencial em cada unidade.
--
-- O pagador pode ser um cliente do cadastro ou só um nome digitado. O nome e o
-- documento ficam gravados no recibo (não mudam se o cadastro mudar depois).
--
-- Nada é apagado: um recibo feito errado é cancelado e continua na lista.
-- Quem vê e mexe: só Admin e Financeiro, como o resto do financeiro.
-- =============================================================================

create table public.recibos (
  id                uuid primary key default gen_random_uuid(),
  numero            integer generated always as identity unique,
  data              date not null default (now() at time zone 'America/Sao_Paulo')::date,
  cliente_id        uuid references public.clientes (id) on delete set null,
  pagador_nome      text not null check (char_length(trim(pagador_nome)) between 2 and 200),
  pagador_documento text,
  -- "Referente a": o serviço feito ou a taxa cobrada.
  descricao         text not null check (char_length(trim(descricao)) between 2 and 2000),
  valor             numeric(12, 2) not null check (valor > 0),
  forma_pagamento   text,
  observacoes       text,
  cancelado         boolean not null default false,
  criado_em         timestamptz not null default now(),
  criado_por        uuid references public.perfis (id),
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid references public.perfis (id)
);

comment on table public.recibos is
  'Recibos avulsos (o que não tem nota fiscal), com número sequencial e PDF gerado na tela.';

create index recibos_data_idx on public.recibos (data desc, numero desc);
create index recibos_cliente_idx on public.recibos (cliente_id);

create trigger carimbar before insert or update on public.recibos
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.recibos
  for each row execute function privado.registrar_auditoria();

alter table public.recibos enable row level security;

create policy "financeiro vê recibos" on public.recibos for select to authenticated
  using (privado.tem_acesso_total());
create policy "financeiro cadastra recibos" on public.recibos for insert to authenticated
  with check (privado.tem_acesso_total());
create policy "financeiro altera recibos" on public.recibos for update to authenticated
  using (privado.tem_acesso_total()) with check (privado.tem_acesso_total());

revoke all on public.recibos from anon;
revoke delete on public.recibos from authenticated;
grant select, insert, update on public.recibos to authenticated;
