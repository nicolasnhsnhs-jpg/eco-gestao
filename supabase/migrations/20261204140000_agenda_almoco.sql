-- Agenda do dia: a primeira coluna das marcas é a volta para almoçar na empresa.
--   volta          atendimento perto: o técnico volta para almoçar (verde)
--   fica           não dá para voltar (vermelho)
--   nao_se_aplica  ex.: atendimento da tarde (traço)

alter table public.agenda_itens
  add column almoco text not null default 'fica'
    check (almoco in ('volta', 'fica', 'nao_se_aplica'));

update public.agenda_itens set almoco = case marca_1
  when 'verde' then 'volta'
  when 'traco' then 'nao_se_aplica'
  else 'fica'
end;

alter table public.agenda_itens drop column marca_1;
