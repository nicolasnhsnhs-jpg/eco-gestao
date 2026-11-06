-- Assinatura escaneada dos responsáveis técnicos, usada no PDF do certificado.
-- Fica num bucket privado (não em public/, que qualquer um baixa pela internet):
--   responsavel.png          → responsável técnico da unidade
--   responsavel-succao.png   → responsável da sucção (RS)
-- Ler: quem emite certificado (Admin e ADM). Trocar: só o Admin.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assinaturas', 'assinaturas', false, 2 * 1024 * 1024, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "quem emite certificado vê assinaturas" on storage.objects for select to authenticated
  using (bucket_id = 'assinaturas' and privado.pode_emitir_certificado());

create policy "admin envia assinaturas" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assinaturas'
    and privado.meu_papel() = 'admin'
    and name in ('responsavel.png', 'responsavel-succao.png')
  );

create policy "admin troca assinaturas" on storage.objects for update to authenticated
  using (bucket_id = 'assinaturas' and privado.meu_papel() = 'admin')
  with check (
    bucket_id = 'assinaturas'
    and privado.meu_papel() = 'admin'
    and name in ('responsavel.png', 'responsavel-succao.png')
  );

create policy "admin apaga assinaturas" on storage.objects for delete to authenticated
  using (bucket_id = 'assinaturas' and privado.meu_papel() = 'admin');
