-- Cronograma: e-mails próprios do cliente para o aviso das datas (o SAC troca ou
-- acrescenta pela tela do Cronograma). Vazio = o e-mail principal do cadastro (ou o
-- do contato principal), como antes. Não mexe no e-mail principal, que vale para
-- certificados, propostas etc. Vários e-mails no padrão do Outlook ("a@x.com; b@y.com").
alter table public.clientes
  add column email_cronograma text check (email_cronograma is null or length(email_cronograma) <= 500);

comment on column public.clientes.email_cronograma is
  'E-mails do aviso do cronograma (separados por "; "); vazio = e-mail principal do cliente.';
