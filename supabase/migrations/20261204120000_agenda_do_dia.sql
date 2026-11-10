-- =============================================================================
-- Agenda do dia (o quadro que vai na TV e, em imagem, no grupo dos operadores).
--
--   agenda_dias   um registro por dia: mensagem, observações, escalas e os veículos
--                 sem Sem Parar
--   agenda_itens  as linhas do quadro (hora, serviço, técnicos, veículo, marcas)
--
-- Quem tem a aba Agenda (admin, financeiro, ADM e vendedor) vê e mexe, todos ao
-- mesmo tempo: as mudanças chegam pelo Realtime. Operador não vê; ele recebe a
-- imagem no WhatsApp quando a agenda fica pronta.
-- =============================================================================

create function privado.pode_usar_agenda()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(privado.meu_papel() in ('admin', 'financeiro', 'administrativo', 'vendedor'), false)
$$;

revoke execute on function privado.pode_usar_agenda() from public;
grant execute on function privado.pode_usar_agenda() to authenticated;

create table public.agenda_dias (
  data            date primary key,
  mensagem        text not null default 'Excelente semana!',
  observacoes     text not null default '',
  -- [{ "inicio": "06:30", "fim": "16h", "tecnicos": [5, 7, 9] }, ...]
  escalas         jsonb not null default '[]'::jsonb,
  sem_sem_parar   text[] not null default '{}',
  criado_em       timestamptz not null default now(),
  criado_por      uuid references public.perfis (id),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid references public.perfis (id),
  constraint agenda_dias_escalas_lista check (jsonb_typeof(escalas) = 'array')
);

create table public.agenda_itens (
  id               uuid primary key default gen_random_uuid(),
  data             date not null references public.agenda_dias (data) on delete cascade,
  ordem            int not null default 0,
  hora             text not null default '07:30' check (hora ~ '^\d{2}:\d{2}$'),
  -- "Empresa: serviço"; várias separadas por " / " (ex.: "GHC: LR / IBIS: CI aptos")
  descricao        text not null default '',
  periodo          text not null default '',
  nota             text not null default '',
  avulso           boolean not null default false,
  -- A estrela: o cliente tem horário específico (o técnico confere na OS).
  horario_cliente  boolean not null default false,
  -- Opcional: a hora de chegada no cliente (ex.: "9h").
  chegada          text not null default '',
  tecnicos         int[] not null default '{}',
  veiculo          text not null default '',
  -- As três colunas da direita do quadro (câmera, R e F).
  marca_1          text not null default 'vazio' check (marca_1 in ('vazio', 'vermelho', 'verde', 'traco')),
  marca_2          text not null default 'vazio' check (marca_2 in ('vazio', 'vermelho', 'verde', 'traco')),
  marca_3          text not null default 'vazio' check (marca_3 in ('vazio', 'vermelho', 'verde', 'traco')),
  criado_em        timestamptz not null default now(),
  criado_por       uuid references public.perfis (id),
  atualizado_em    timestamptz not null default now(),
  atualizado_por   uuid references public.perfis (id)
);

create index agenda_itens_data_idx on public.agenda_itens (data, hora, ordem);

create trigger carimbar before insert or update on public.agenda_dias
  for each row execute function privado.carimbar();
create trigger carimbar before insert or update on public.agenda_itens
  for each row execute function privado.carimbar();

alter table public.agenda_dias enable row level security;
alter table public.agenda_itens enable row level security;
revoke all on public.agenda_dias, public.agenda_itens from anon, authenticated;
grant select, insert, update, delete on public.agenda_dias, public.agenda_itens to authenticated;
grant all on public.agenda_dias, public.agenda_itens to service_role;

create policy "agenda: quem tem a aba vê" on public.agenda_dias for select to authenticated
  using (privado.pode_usar_agenda());
create policy "agenda: quem tem a aba cria" on public.agenda_dias for insert to authenticated
  with check (privado.pode_usar_agenda());
create policy "agenda: quem tem a aba altera" on public.agenda_dias for update to authenticated
  using (privado.pode_usar_agenda()) with check (privado.pode_usar_agenda());
create policy "agenda: quem tem a aba apaga" on public.agenda_dias for delete to authenticated
  using (privado.pode_usar_agenda());

create policy "agenda: quem tem a aba vê as linhas" on public.agenda_itens for select to authenticated
  using (privado.pode_usar_agenda());
create policy "agenda: quem tem a aba cria linhas" on public.agenda_itens for insert to authenticated
  with check (privado.pode_usar_agenda());
create policy "agenda: quem tem a aba altera linhas" on public.agenda_itens for update to authenticated
  using (privado.pode_usar_agenda()) with check (privado.pode_usar_agenda());
create policy "agenda: quem tem a aba apaga linhas" on public.agenda_itens for delete to authenticated
  using (privado.pode_usar_agenda());

-- Tempo real: todo mundo que está com a agenda aberta vê as mudanças na hora.
alter publication supabase_realtime add table public.agenda_dias, public.agenda_itens;
