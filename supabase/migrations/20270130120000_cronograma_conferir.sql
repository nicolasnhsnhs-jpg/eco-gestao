-- Cronograma: unidade que "precisa conferir" (ex.: nome repetido na rota ao montar o mês
-- pela planilha). Fica na rota com o aviso em destaque e NÃO é enviada até alguém
-- marcar "Conferido" (ou salvar a unidade), que limpa o campo.
alter table public.cronograma_itens
  add column conferir text check (conferir is null or length(conferir) <= 300);

comment on column public.cronograma_itens.conferir is
  'Motivo para conferir antes de enviar; enquanto preenchido, a unidade não recebe o e-mail.';

grant insert (conferir) on public.cronograma_itens to authenticated;
grant update (conferir) on public.cronograma_itens to authenticated;
