-- =============================================================================
-- Cópia dos PDFs no Google Drive (fila).
--
--  1. Sem os segredos do Vault (unidade sem Drive), nada entra na fila.
--  2. Com eles: PDF de nota, boleto e OS entram; XML, foto e proposta não.
--  3. drive_pegar_fila trava o item: uma segunda chamada não pega o mesmo.
--  4. drive_enviar_antigos põe na fila os PDFs que já existiam.
--  5. Só a gestão vê a fila.
--
-- Rodar:  npm run test:db   (transação desfeita no final)
-- =============================================================================

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000d0a01', 'admin@drive.local', '{"nome":"Admin [drive]"}'),
  ('00000000-0000-0000-0000-0000000d0b01', 'vend@drive.local',  '{"nome":"Vendedor [drive]"}');
update public.perfis set papel = 'admin'    where id = '00000000-0000-0000-0000-0000000d0a01';
update public.perfis set papel = 'vendedor' where id = '00000000-0000-0000-0000-0000000d0b01';

create function pg_temp.como(usuario text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', usuario, 'role', 'authenticated')::text, true);
$$;

insert into public.clientes (id, tipo_pessoa, nome) values
  ('00000000-0000-0000-0000-0000000d0c01', 'PJ', 'Cliente do Drive [teste]');

create function pg_temp.arquivo(id text, categoria text, mime text) returns void language sql as $$
  insert into public.arquivos (id, caminho_storage, nome_original, tipo_mime, categoria, cliente_id)
  values (id::uuid, 'clientes/00000000-0000-0000-0000-0000000d0c01/' || id, id, mime,
          categoria::public.categoria_arquivo, '00000000-0000-0000-0000-0000000d0c01')
$$;

select pg_temp.como('00000000-0000-0000-0000-0000000d0a01');

-- 1. Sem segredos: não entra.
delete from vault.secrets where name in ('drive_funcao_url', 'drive_segredo');
select pg_temp.arquivo('00000000-0000-0000-0000-0000000d0f00', 'nota_fiscal', 'application/pdf');
do $$ begin
  assert not exists (select 1 from public.drive_fila where arquivo_id = '00000000-0000-0000-0000-0000000d0f00'),
    'Sem o Drive ligado, nada deveria entrar na fila';
end $$;

-- 2. Com segredos.
select vault.create_secret('https://exemplo.local/functions/v1/drive', 'drive_funcao_url');
select vault.create_secret('segredo-de-teste', 'drive_segredo');
select pg_temp.arquivo('00000000-0000-0000-0000-0000000d0f01', 'nota_fiscal', 'application/pdf');
select pg_temp.arquivo('00000000-0000-0000-0000-0000000d0f02', 'boleto', 'application/pdf');
select pg_temp.arquivo('00000000-0000-0000-0000-0000000d0f03', 'relatorio', 'application/pdf');
select pg_temp.arquivo('00000000-0000-0000-0000-0000000d0f04', 'nota_fiscal', 'application/xml');
select pg_temp.arquivo('00000000-0000-0000-0000-0000000d0f05', 'foto_antes', 'image/jpeg');
select pg_temp.arquivo('00000000-0000-0000-0000-0000000d0f06', 'proposta', 'application/pdf');
do $$ begin
  assert (select count(*) from public.drive_fila where arquivo_id::text like '00000000-0000-0000-0000-0000000d0f0%') = 3,
    'Só os PDFs de nota, boleto e OS deveriam entrar na fila';
  assert not exists (select 1 from public.drive_fila where arquivo_id in
    ('00000000-0000-0000-0000-0000000d0f04', '00000000-0000-0000-0000-0000000d0f05', '00000000-0000-0000-0000-0000000d0f06')),
    'XML, foto e proposta não vão para o Drive';
end $$;

-- 5. Quem vê a fila (antes de mexer nela como servidor).
set local role authenticated;
do $$ begin
  assert (select count(*) from public.drive_fila) >= 3, 'O admin deveria ver a fila';
end $$;
select pg_temp.como('00000000-0000-0000-0000-0000000d0b01');
do $$ begin
  assert (select count(*) from public.drive_fila) = 0, 'O vendedor não deveria ver a fila';
end $$;
do $$ begin
  perform public.drive_pegar_fila(10);
  raise exception 'O vendedor não deveria pegar a fila';
exception when insufficient_privilege then null;
end $$;
reset role;

-- 3. Trava.
do $$
declare
  v_primeira int;
  v_segunda int;
begin
  select count(*) into v_primeira from public.drive_pegar_fila(100)
   where arquivo_id::text like '00000000-0000-0000-0000-0000000d0f0%';
  select count(*) into v_segunda from public.drive_pegar_fila(100)
   where arquivo_id::text like '00000000-0000-0000-0000-0000000d0f0%';
  assert v_primeira = 3, 'A primeira chamada deveria pegar os 3';
  assert v_segunda = 0, 'Item travado não deveria ser pego de novo';
  assert (select tentativas from public.drive_fila where arquivo_id = '00000000-0000-0000-0000-0000000d0f01') = 1,
    'Pegar deveria contar a tentativa';
end $$;

-- 4. Carga dos antigos: o PDF de antes de ligar entra; os outros não duplicam.
do $$ begin
  assert public.drive_enviar_antigos() >= 1, 'Deveria pôr na fila o PDF que já existia';
  assert exists (select 1 from public.drive_fila where arquivo_id = '00000000-0000-0000-0000-0000000d0f00'),
    'O PDF de antes de ligar deveria entrar na fila';
end $$;

select 'drive: ok' as resultado;

rollback;
