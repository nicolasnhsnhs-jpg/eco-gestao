-- =============================================================================
-- Cronograma (Serviços > Cronograma): as datas do mês de cada rota de controle de
-- pragas, e o aviso a cada cliente por e-mail, pelo SAC.
--
-- A logística escolhe o mês e a rota (as mesmas rotas da emissão de OS) e digita
-- os dias de atendimento da rota (ex.: 10 e 25). Cada unidade da rota (cliente +
-- endereço) recebe essas datas; uma unidade pode ter as suas (só 1 visita, semanal,
-- outro dia), um turno/horário quando for preciso, ou ficar fora do mês.
--
-- Depois de conferir, o SAC manda um e-mail para cada cliente (CNPJ) com as datas
-- de cada unidade dele (função "cronograma"). Sem e-mail cadastrado, a unidade fica
-- "pendente de envio": o SAC avisa por outro meio (WhatsApp, telefone) e marca aqui.
--
--   cronograma_rotas  uma rota num mês: dias da rota, turno/horário e observação
--   cronograma_itens  cada unidade da rota no mês: dias próprios, fora do mês, e o
--                     registro do envio (quando, para quem e quais dias foram)
--
-- O envio só é gravado pela função (service role); pela tela, o escritório mexe nas
-- datas e marca o aviso feito à mão.
-- =============================================================================

create table public.cronograma_rotas (
  id             uuid primary key default gen_random_uuid(),
  rota_id        uuid not null references public.os_rotas (id) on delete cascade,
  -- Primeiro dia do mês do cronograma.
  mes            date not null check (extract(day from mes) = 1),
  -- Dias de atendimento da rota no mês (cada unidade usa estes, se não tiver os seus).
  datas          date[] not null default '{}',
  -- Opcional: "Manhã", "Às 9h"… (vazio: horário comercial, o normal).
  horario        text check (char_length(horario) <= 80),
  observacoes    text check (char_length(observacoes) <= 1000),
  criado_em      timestamptz not null default now(),
  criado_por     uuid references public.perfis (id),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id),
  constraint uma_vez_por_mes unique (rota_id, mes)
);

create index cronograma_rotas_mes_idx on public.cronograma_rotas (mes);

create table public.cronograma_itens (
  id                uuid primary key default gen_random_uuid(),
  cronograma_id     uuid not null references public.cronograma_rotas (id) on delete cascade,
  cliente_id        uuid not null references public.clientes (id) on delete cascade,
  endereco_id       uuid references public.enderecos (id) on delete set null,
  -- Serviços desta unidade na rota (nomes das O.S salvas), para conferência.
  servicos          text[] not null default '{}',
  ordem             integer not null default 0,
  -- Dias próprios da unidade; vazio (null) usa os da rota.
  datas             date[],
  -- Sem dias próprios: só a Nª visita da rota (o cliente mensal numa rota quinzenal).
  -- Passa para o mês seguinte ao montar a rota de novo.
  so_visita         smallint check (so_visita between 1 and 6),
  -- Fora deste mês (não recebe e-mail).
  incluido          boolean not null default true,
  -- Turno/horário só desta unidade (vazio: o da rota, ou horário comercial).
  horario           text check (char_length(horario) <= 80),
  -- Vai no e-mail do cliente (ex.: "entre 25 e 27").
  observacoes       text check (char_length(observacoes) <= 500),
  -- Envio por e-mail (gravado pela função).
  enviado_em        timestamptz,
  enviado_para      text,
  datas_enviadas    date[],
  horario_enviado   text,
  email_id          uuid references public.emails_enviados (id) on delete set null,
  -- Última tentativa sem e-mail cadastrado (fica pendente de envio).
  sem_email_em      timestamptz,
  -- Aviso feito à mão pelo SAC (WhatsApp, telefone…).
  aviso_manual_em   timestamptz,
  aviso_manual_por  uuid references public.perfis (id) on delete set null,
  aviso_manual_obs  text check (char_length(aviso_manual_obs) <= 300),
  criado_em         timestamptz not null default now(),
  criado_por        uuid references public.perfis (id),
  atualizado_em     timestamptz not null default now(),
  atualizado_por    uuid references public.perfis (id),
  constraint unidade_uma_vez unique nulls not distinct (cronograma_id, cliente_id, endereco_id)
);

create index cronograma_itens_cronograma_idx on public.cronograma_itens (cronograma_id);
create index cronograma_itens_cliente_idx on public.cronograma_itens (cliente_id);
create index cronograma_itens_endereco_idx on public.cronograma_itens (endereco_id);
create index cronograma_itens_email_idx on public.cronograma_itens (email_id);

create trigger carimbar before insert or update on public.cronograma_rotas
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.cronograma_rotas
  for each row execute function privado.registrar_auditoria();
create trigger carimbar before insert or update on public.cronograma_itens
  for each row execute function privado.carimbar();
create trigger auditoria after insert or update or delete on public.cronograma_itens
  for each row execute function privado.registrar_auditoria();

alter table public.cronograma_rotas enable row level security;
alter table public.cronograma_itens enable row level security;

-- O escritório (quem agenda OS: admin, financeiro, ADM e recepção).
create policy "escritório vê cronograma" on public.cronograma_rotas for select to authenticated
  using (privado.pode_gerir_os());
create policy "escritório cria cronograma" on public.cronograma_rotas for insert to authenticated
  with check (privado.pode_gerir_os());
create policy "escritório altera cronograma" on public.cronograma_rotas for update to authenticated
  using (privado.pode_gerir_os()) with check (privado.pode_gerir_os());
create policy "escritório apaga cronograma" on public.cronograma_rotas for delete to authenticated
  using (privado.pode_gerir_os());

create policy "escritório vê unidades do cronograma" on public.cronograma_itens
  for select to authenticated using (privado.pode_gerir_os());
create policy "escritório põe unidades no cronograma" on public.cronograma_itens
  for insert to authenticated with check (privado.pode_gerir_os());
create policy "escritório altera unidades do cronograma" on public.cronograma_itens
  for update to authenticated using (privado.pode_gerir_os()) with check (privado.pode_gerir_os());
create policy "escritório tira unidades do cronograma" on public.cronograma_itens
  for delete to authenticated using (privado.pode_gerir_os());

revoke all on public.cronograma_rotas, public.cronograma_itens from anon, authenticated;
grant select, insert, update, delete on public.cronograma_rotas to authenticated;
grant select, delete on public.cronograma_itens to authenticated;
-- Pela tela não se grava o envio por e-mail (só a função): só estas colunas.
grant insert (id, cronograma_id, cliente_id, endereco_id, servicos, ordem, datas, so_visita, incluido,
              horario, observacoes)
  on public.cronograma_itens to authenticated;
grant update (servicos, ordem, datas, so_visita, incluido, horario, observacoes,
              aviso_manual_em, aviso_manual_por, aviso_manual_obs)
  on public.cronograma_itens to authenticated;
grant all on public.cronograma_rotas, public.cronograma_itens to service_role;

-- -----------------------------------------------------------------------------
-- E-mails enviados: o aviso do cronograma entra no registro (Administrativo).
-- -----------------------------------------------------------------------------

alter table public.emails_enviados drop constraint emails_enviados_tipo_check;
alter table public.emails_enviados add constraint emails_enviados_tipo_check
  check (tipo in ('nota', 'proposta', 'certificado', 'os', 'cronograma'));

comment on table public.emails_enviados is
  'Registro dos e-mails mandados ao cliente pelo sistema (nota, proposta, certificado, OS, cronograma).';
