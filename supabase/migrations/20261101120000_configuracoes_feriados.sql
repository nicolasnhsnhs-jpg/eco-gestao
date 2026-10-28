-- =============================================================================
-- Configurações ajustáveis, feriados e cálculo do "n-ésimo dia útil"
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Configurações (chave → valor), editáveis na tela por Admin/Financeiro
-- -----------------------------------------------------------------------------

create table public.configuracoes (
  chave          text primary key,
  valor          text not null,
  descricao      text,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id)
);

create function privado.antes_salvar_configuracao()
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
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end
$$;

create trigger antes_salvar before insert or update on public.configuracoes
  for each row execute function privado.antes_salvar_configuracao();

-- Auditoria das configurações (a chave não é uuid: grava o registro sem id).
create function privado.auditar_configuracao()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.auditoria (tabela, acao, dados_antes, dados_depois, usuario_id)
  values ('configuracoes', lower(tg_op), to_jsonb(old), to_jsonb(new), auth.uid());
  return null;
end
$$;

revoke execute on function privado.auditar_configuracao() from public, authenticated;

create trigger auditoria after update on public.configuracoes
  for each row execute function privado.auditar_configuracao();

alter table public.configuracoes enable row level security;
create policy "acesso total vê configurações" on public.configuracoes for select to authenticated
  using (privado.tem_acesso_total());
create policy "acesso total altera configurações" on public.configuracoes for update to authenticated
  using (privado.tem_acesso_total()) with check (privado.tem_acesso_total());

revoke all on public.configuracoes from anon, authenticated;
grant select on public.configuracoes to authenticated;
grant update (valor) on public.configuracoes to authenticated;
grant all on public.configuracoes to service_role;

insert into public.configuracoes (chave, valor, descricao) values
  ('contrato_dia_util_cobranca', '1', 'Em qual dia útil do mês vencem as mensalidades dos contratos.'),
  ('comissao_percentual_padrao', '8', 'Percentual de comissão dos vendedores (quando o vendedor não tem um próprio).');

-- Leitura interna (as funções do banco usam, sem depender de quem chama).
create function privado.config(p_chave text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select valor from public.configuracoes where chave = p_chave
$$;

revoke execute on function privado.config(text) from public;
grant execute on function privado.config(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Feriados
--   Nacionais: calculados pelo banco para qualquer ano (inclusive os móveis,
--   a partir da Páscoa). Estaduais (SC) e municipais (Palhoça): cadastrados na tela.
-- -----------------------------------------------------------------------------

-- Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
create function privado.pascoa(ano integer)
returns date
language plpgsql immutable
set search_path = ''
as $$
declare
  a int := ano % 19;
  b int := ano / 100;
  c int := ano % 100;
  d int := b / 4;
  e int := b % 4;
  f int := (b + 8) / 25;
  g int := (b - f + 1) / 3;
  h int := (19 * a + b - d - g + 15) % 30;
  i int := c / 4;
  k int := c % 4;
  l int := (32 + 2 * e + 2 * i - h - k) % 7;
  m int := (a + 11 * h + 22 * l) / 451;
  mes int := (h + l - 7 * m + 114) / 31;
  dia int := ((h + l - 7 * m + 114) % 31) + 1;
begin
  return make_date(ano, mes, dia);
end
$$;

create function public.feriados_nacionais(ano integer)
returns table (data date, descricao text)
language sql immutable
set search_path = ''
as $$
  select * from (values
    (make_date(ano, 1, 1),   'Confraternização Universal'),
    (privado.pascoa(ano) - 48, 'Carnaval (bancos fechados)'),
    (privado.pascoa(ano) - 47, 'Carnaval (bancos fechados)'),
    (privado.pascoa(ano) - 2,  'Sexta-feira Santa'),
    (make_date(ano, 4, 21),  'Tiradentes'),
    (make_date(ano, 5, 1),   'Dia do Trabalho'),
    (privado.pascoa(ano) + 60, 'Corpus Christi (bancos fechados)'),
    (make_date(ano, 9, 7),   'Independência do Brasil'),
    (make_date(ano, 10, 12), 'Nossa Senhora Aparecida'),
    (make_date(ano, 11, 2),  'Finados'),
    (make_date(ano, 11, 15), 'Proclamação da República'),
    (make_date(ano, 11, 20), 'Dia da Consciência Negra'),
    (make_date(ano, 12, 25), 'Natal')
  ) as f(data, descricao)
$$;

create type public.abrangencia_feriado as enum ('estadual', 'municipal', 'outro');

-- Feriados de SC, de Palhoça e outros dias sem expediente (cadastrados à mão).
create table public.feriados (
  id          uuid primary key default gen_random_uuid(),
  data        date not null unique,
  descricao   text not null check (char_length(trim(descricao)) between 2 and 120),
  abrangencia public.abrangencia_feriado not null default 'municipal',
  criado_em   timestamptz not null default now(),
  criado_por  uuid references public.perfis (id)
);

create function privado.antes_salvar_feriado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.criado_por := auth.uid();
  new.criado_em := now();
  return new;
end
$$;

create trigger antes_salvar before insert on public.feriados
  for each row execute function privado.antes_salvar_feriado();

alter table public.feriados enable row level security;
create policy "acesso total vê feriados" on public.feriados for select to authenticated
  using (privado.tem_acesso_total());
create policy "acesso total cadastra feriados" on public.feriados for insert to authenticated
  with check (privado.tem_acesso_total());
create policy "acesso total apaga feriados" on public.feriados for delete to authenticated
  using (privado.tem_acesso_total());

revoke all on public.feriados from anon, authenticated;
grant select, insert, delete on public.feriados to authenticated;
grant all on public.feriados to service_role;

-- -----------------------------------------------------------------------------
-- Dia útil
-- -----------------------------------------------------------------------------

create function privado.e_dia_util(dia date)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select extract(isodow from dia) < 6
     and not exists (select 1 from public.feriados_nacionais(extract(year from dia)::int) f where f.data = dia)
     and not exists (select 1 from public.feriados f where f.data = dia)
$$;

-- O n-ésimo dia útil de um mês (ex.: 1º dia útil de novembro/2026 = 03/11, pois 02/11 é Finados).
create function public.dia_util(ano integer, mes integer, n integer default 1)
returns date
language plpgsql stable
set search_path = ''
as $$
declare
  v_dia   date := make_date(ano, mes, 1);
  v_conta int := 0;
begin
  if n < 1 or n > 20 then
    raise exception 'n precisa estar entre 1 e 20.' using errcode = '22023';
  end if;
  loop
    if privado.e_dia_util(v_dia) then
      v_conta := v_conta + 1;
      if v_conta = n then
        return v_dia;
      end if;
    end if;
    v_dia := v_dia + 1;
  end loop;
end
$$;

revoke execute on function privado.e_dia_util(date) from public;
grant execute on function privado.e_dia_util(date) to authenticated;
revoke execute on function public.dia_util(integer, integer, integer),
  public.feriados_nacionais(integer) from public, anon;
grant execute on function public.dia_util(integer, integer, integer),
  public.feriados_nacionais(integer) to authenticated;
