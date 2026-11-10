-- =============================================================================
-- Vendedor passa a VER os certificados dos clientes da carteira dele (só leitura).
--
-- Ele consulta a lista e baixa o PDF para mandar ao cliente. Emitir, corrigir,
-- cancelar, mexer no catálogo de produtos e nas assinaturas continua só com o
-- Administrador e o ADM (as regras de insert/update não mudam).
--
-- Para montar o PDF ele também lê a assinatura escaneada do responsável técnico
-- (bucket "assinaturas"), que de todo jeito vai impressa no certificado.
-- =============================================================================

create function privado.pode_ver_certificado()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(privado.meu_papel() in ('admin', 'administrativo', 'vendedor'), false)
$$;

revoke execute on function privado.pode_ver_certificado() from public;
grant execute on function privado.pode_ver_certificado() to authenticated;

-- pode_ver_cliente já limita o vendedor aos clientes da carteira dele.
drop policy "admin e ADM veem certificados" on public.certificados;
create policy "quem pode ver certificados" on public.certificados for select to authenticated
  using (privado.pode_ver_certificado() and privado.pode_ver_cliente(cliente_id));

drop policy "quem emite certificado vê assinaturas" on storage.objects;
create policy "quem vê certificado vê assinaturas" on storage.objects for select to authenticated
  using (bucket_id = 'assinaturas' and privado.pode_ver_certificado());
