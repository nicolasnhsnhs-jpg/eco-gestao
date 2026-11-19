-- =============================================================================
-- O ADM (administrativo) também preenche a execução da OS, como o Administrador
-- ("Preencher execução" na tela da OS): pontos, produtos, insetos, dados da
-- execução, iniciar e concluir. Antes era "OS do técnico OU admin".
--
-- Fotos e assinaturas já passavam pelas regras do escritório (enviar arquivos do
-- sistema), que valem para o ADM.
-- =============================================================================

create or replace function privado.pode_preencher_execucao()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(privado.meu_papel() in ('admin', 'administrativo'), false)
$$;

revoke execute on function privado.pode_preencher_execucao() from public;
grant execute on function privado.pode_preencher_execucao() to authenticated;

-- Regras das tabelas da execução: troca o "é admin" por "admin ou ADM".
do $$
declare
  r       record;
  v_usar  text;
  v_conf  text;
  v_sql   text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and tablename in ('os_execucao', 'os_pontos', 'os_produtos', 'os_insetos')
       and (coalesce(qual, '') like '%os_e_minha%e_admin()%'
            or coalesce(with_check, '') like '%os_e_minha%e_admin()%')
  loop
    v_usar := replace(r.qual, 'privado.e_admin()', 'privado.pode_preencher_execucao()');
    v_conf := replace(r.with_check, 'privado.e_admin()', 'privado.pode_preencher_execucao()');
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if v_usar is not null then v_sql := v_sql || format(' using (%s)', v_usar); end if;
    if v_conf is not null then v_sql := v_sql || format(' with check (%s)', v_conf); end if;
    execute v_sql;
  end loop;
end
$$;

-- Iniciar e concluir a OS: mesma troca na checagem de quem pode mexer.
do $$
declare
  v_funcao regprocedure;
  v_def    text;
begin
  foreach v_funcao in array array['privado.iniciar_os(uuid)'::regprocedure,
                                  'privado.concluir_os(uuid)'::regprocedure]
  loop
    v_def := pg_get_functiondef(v_funcao);
    if position('privado.os_e_minha(p_os) or privado.e_admin()' in v_def) = 0 then
      raise exception 'Checagem esperada não encontrada em %', v_funcao;
    end if;
    execute replace(v_def, 'privado.os_e_minha(p_os) or privado.e_admin()',
                    'privado.os_e_minha(p_os) or privado.pode_preencher_execucao()');
  end loop;
end
$$;
