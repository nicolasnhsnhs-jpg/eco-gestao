-- =============================================================================
-- Agenda do dia: o ADM (papel "administrativo") só consulta.
-- Continua vendo a agenda (e as mudanças ao vivo), mas não cria, altera nem apaga
-- nada: nem os dias, nem as linhas, nem o cadastro de técnicos e veículos.
-- =============================================================================

create function privado.pode_editar_agenda()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(privado.meu_papel() in ('admin', 'financeiro', 'vendedor'), false)
$$;

revoke execute on function privado.pode_editar_agenda() from public;
grant execute on function privado.pode_editar_agenda() to authenticated;

alter policy "agenda: quem tem a aba cria" on public.agenda_dias
  with check (privado.pode_editar_agenda());
alter policy "agenda: quem tem a aba altera" on public.agenda_dias
  using (privado.pode_editar_agenda()) with check (privado.pode_editar_agenda());
alter policy "agenda: quem tem a aba apaga" on public.agenda_dias
  using (privado.pode_editar_agenda());

alter policy "agenda: quem tem a aba cria linhas" on public.agenda_itens
  with check (privado.pode_editar_agenda());
alter policy "agenda: quem tem a aba altera linhas" on public.agenda_itens
  using (privado.pode_editar_agenda()) with check (privado.pode_editar_agenda());
alter policy "agenda: quem tem a aba apaga linhas" on public.agenda_itens
  using (privado.pode_editar_agenda());

-- Cadastro de técnicos e veículos: só admin e financeiro.
alter policy "agenda: gestão cadastra técnicos" on public.agenda_tecnicos
  with check (privado.tem_acesso_gestao() and privado.pode_editar_agenda());
alter policy "agenda: gestão altera técnicos" on public.agenda_tecnicos
  using (privado.tem_acesso_gestao() and privado.pode_editar_agenda())
  with check (privado.tem_acesso_gestao() and privado.pode_editar_agenda());
alter policy "agenda: gestão apaga técnicos" on public.agenda_tecnicos
  using (privado.tem_acesso_gestao() and privado.pode_editar_agenda());
alter policy "agenda: gestão cadastra veículos" on public.agenda_veiculos
  with check (privado.tem_acesso_gestao() and privado.pode_editar_agenda());
alter policy "agenda: gestão altera veículos" on public.agenda_veiculos
  using (privado.tem_acesso_gestao() and privado.pode_editar_agenda())
  with check (privado.tem_acesso_gestao() and privado.pode_editar_agenda());
alter policy "agenda: gestão apaga veículos" on public.agenda_veiculos
  using (privado.tem_acesso_gestao() and privado.pode_editar_agenda());
