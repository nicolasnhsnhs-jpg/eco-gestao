-- OS feita a partir de uma proposta aprovada guarda a proposta: o financeiro vê o valor
-- no "A faturar" sem precisar perguntar ao escritório.
alter table public.ordens_servico
  add column proposta_id uuid references public.propostas (id) on delete set null;

create index ordens_servico_proposta_id_idx on public.ordens_servico (proposta_id);

grant update (proposta_id) on public.ordens_servico to authenticated;
