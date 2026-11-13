-- Listas de e-mail no padrão do Outlook: "a@x.com; b@y.com".
-- O histórico de envio gravava "a@x.com, b@y.com"; daqui em diante as funções gravam com "; ".
update public.notas_fiscais
set enviada_para = regexp_replace(enviada_para, '\s*,\s*', '; ', 'g')
where enviada_para like '%,%';

update public.certificados
set enviado_para = regexp_replace(enviado_para, '\s*,\s*', '; ', 'g')
where enviado_para like '%,%';
