-- =============================================================================
-- Cópia automática dos PDFs no Google Drive (Drive compartilhado da unidade).
--
-- Todo PDF que o sistema gera e guarda nos arquivos do cliente vai também para o Drive:
--
--   FINANCEIRO / <ano> / <Cliente - CNPJ> / NFSe-123.pdf, Boleto NF 123.pdf
--   GERAL      / <ano> / <Cliente - CNPJ> / OS-2026-0001.pdf, CERT-2026-0001.pdf
--
-- Como funciona:
--   drive_fila     um registro por PDF a mandar (o gatilho em "arquivos" enche a fila)
--   drive_pastas   as pastas já achadas/criadas no Drive (para não procurar toda vez)
--   a cada minuto o pg_cron chama a Edge Function "drive", que manda o que estiver na fila
--
-- Só funciona na unidade em que os segredos do Vault foram cadastrados:
--   drive_funcao_url  endereço da função (https://<projeto>.supabase.co/functions/v1/drive)
--   drive_segredo     a mesma senha cadastrada no segredo DRIVE_SEGREDO da função
-- Sem eles (ex.: RS, que guarda tudo no servidor próprio), nada entra na fila.
-- O certificado não fica nos arquivos: o navegador manda o PDF direto para a função.
-- Veja docs/CONFIGURACAO-DRIVE.md.
-- =============================================================================

create extension if not exists pg_net with schema extensions;

create table public.drive_fila (
  arquivo_id        uuid primary key references public.arquivos (id) on delete cascade,
  criado_em         timestamptz not null default now(),
  tentativas        int not null default 0,
  -- Enquanto uma execução da função trabalha no item, ninguém mais pega.
  travado_ate       timestamptz,
  proxima_tentativa timestamptz not null default now(),
  ultimo_erro       text,
  enviado_em        timestamptz,
  drive_arquivo_id  text
);

create index drive_fila_pendentes_idx on public.drive_fila (proxima_tentativa)
  where enviado_em is null;

create table public.drive_pastas (
  -- 'setor:GERAL', 'ano:GERAL:2026' ou 'cliente:GERAL:2026:<id do cliente>'
  chave     text primary key,
  pasta_id  text not null,
  criado_em timestamptz not null default now()
);

alter table public.drive_fila enable row level security;
alter table public.drive_pastas enable row level security;
revoke all on public.drive_fila, public.drive_pastas from anon, authenticated;
grant all on public.drive_fila, public.drive_pastas to service_role;

-- A gestão vê como anda a fila (o que deu erro).
grant select on public.drive_fila to authenticated;
create policy "gestão vê a fila do drive" on public.drive_fila for select to authenticated
  using (privado.tem_acesso_gestao());

-- -----------------------------------------------------------------------------
-- O Drive está ligado nesta unidade? (os dois segredos estão no Vault)
-- -----------------------------------------------------------------------------
create function privado.drive_ligado()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (select count(*) from vault.decrypted_secrets
           where name in ('drive_funcao_url', 'drive_segredo')
             and coalesce(decrypted_secret, '') <> '') = 2
$$;

revoke execute on function privado.drive_ligado() from public, anon, authenticated;

-- Categorias que vão para o Drive (só PDF): nota, boleto e PDF da OS.
create function privado.vai_para_o_drive(categoria public.categoria_arquivo, tipo_mime text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select categoria in ('nota_fiscal', 'boleto', 'relatorio')
     and coalesce(tipo_mime, '') = 'application/pdf'
$$;

create function privado.arquivo_para_o_drive()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if privado.vai_para_o_drive(new.categoria, new.tipo_mime) and privado.drive_ligado() then
    insert into public.drive_fila (arquivo_id) values (new.id) on conflict do nothing;
  end if;
  return null;
end
$$;

create trigger para_o_drive after insert on public.arquivos
  for each row execute function privado.arquivo_para_o_drive();

-- -----------------------------------------------------------------------------
-- A função pega um lote da fila (quem pegou trabalha 5 minutos sem concorrência).
-- -----------------------------------------------------------------------------
create function public.drive_pegar_fila(p_limite int default 10)
returns table (arquivo_id uuid, tentativas int)
language sql security definer
set search_path = ''
as $$
  update public.drive_fila f
     set travado_ate = now() + interval '5 minutes', tentativas = f.tentativas + 1
   where f.arquivo_id in (
     select q.arquivo_id from public.drive_fila q
      where q.enviado_em is null
        and q.proxima_tentativa <= now()
        and (q.travado_ate is null or q.travado_ate < now())
        and q.tentativas < 10
      order by q.criado_em
      limit p_limite
      for update skip locked
   )
  returning f.arquivo_id, f.tentativas
$$;

revoke execute on function public.drive_pegar_fila(int) from public, anon, authenticated;
grant execute on function public.drive_pegar_fila(int) to service_role;

-- -----------------------------------------------------------------------------
-- PDFs que já estavam no sistema antes de ligar o Drive (carga inicial, uma vez só).
-- Rodar no SQL Editor:  select public.drive_enviar_antigos();
-- -----------------------------------------------------------------------------
create function public.drive_enviar_antigos()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_total int;
begin
  if not privado.drive_ligado() then
    raise exception 'O Drive ainda não foi ligado nesta unidade (segredos do Vault).';
  end if;
  insert into public.drive_fila (arquivo_id, criado_em)
  select a.id, a.criado_em from public.arquivos a
   where privado.vai_para_o_drive(a.categoria, a.tipo_mime)
  on conflict do nothing;
  get diagnostics v_total = row_count;
  return v_total;
end
$$;

revoke execute on function public.drive_enviar_antigos() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- A cada minuto, se houver algo na fila, chama a função "drive".
-- -----------------------------------------------------------------------------
create function privado.drive_processar_fila()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_url text;
  v_segredo text;
begin
  if not exists (
    select 1 from public.drive_fila
     where enviado_em is null and proxima_tentativa <= now() and tentativas < 10
       and (travado_ate is null or travado_ate < now())
  ) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'drive_funcao_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'drive_segredo';
  if coalesce(v_url, '') = '' or coalesce(v_segredo, '') = '' then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-drive-segredo', v_segredo),
    body := jsonb_build_object('acao', 'processar'),
    timeout_milliseconds := 60000
  );
end
$$;

revoke execute on function privado.drive_processar_fila() from public, anon, authenticated;

select cron.schedule('drive-processar-fila', '* * * * *', $$select privado.drive_processar_fila()$$);

-- O que já foi para o Drive há mais de 90 dias sai da fila (o Drive é o registro).
select cron.schedule(
  'drive-limpar-fila',
  '40 3 * * *',
  $$delete from public.drive_fila where enviado_em < now() - interval '90 days'$$
);
