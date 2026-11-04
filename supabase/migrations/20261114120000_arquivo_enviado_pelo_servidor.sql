-- A emissão da NFS-e (função nfse, com a chave de serviço) guarda o XML e o PDF da nota
-- em nome de quem clicou em "Confirmar e emitir". Sem usuário na sessão, auth.uid() é
-- nulo e o gatilho apagava o enviado_por informado. Quem está logado continua sem poder
-- escolher: vale sempre o próprio usuário.

create or replace function privado.antes_salvar_arquivo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.enviado_por := coalesce(auth.uid(), new.enviado_por);
  new.criado_em := now();
  if new.proposta_id is not null and not exists (
    select 1 from public.propostas p where p.id = new.proposta_id and p.cliente_id = new.cliente_id
  ) then
    raise exception 'A proposta não é deste cliente.' using errcode = '23514';
  end if;
  if new.servico_id is not null and not exists (
    select 1 from public.servicos s where s.id = new.servico_id and s.cliente_id = new.cliente_id
  ) then
    raise exception 'O serviço não é deste cliente.' using errcode = '23514';
  end if;
  return new;
end
$$;
