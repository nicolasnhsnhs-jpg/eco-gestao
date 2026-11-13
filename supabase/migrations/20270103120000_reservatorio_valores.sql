-- OS de reservatórios: valores novos dos enums (migration só deles).
alter type public.tipo_ponto add value if not exists 'reservatorio';
alter type public.formulario_os add value if not exists 'reservatorio';
