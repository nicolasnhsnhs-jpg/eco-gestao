-- OS simples de controle de insetos e de roedores: valor novo do enum (migration só dele).
alter type public.formulario_os add value if not exists 'pragas_simples';
