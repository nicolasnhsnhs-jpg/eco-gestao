-- =============================================================================
-- Neovia (RS): completa a O.S de contrato de controle de pragas que JÁ EXISTIA
-- antes do neovia_os_contrato.sql (o script viu que ela existia e pulou).
--
-- Acrescenta só o que falta, sem mexer no que já está lá:
--   - porta-iscas internos 101-140 (e qualquer externo 1-66 que falte);
--   - 3 armadilhas luminosas, 2 de moscas e 12 de feromônio, se faltarem;
--   - no escopo: feromônio, planilha de ocorrências, envelope e pragas
--     combatidas (o que já estava preenchido continua valendo).
-- Os retirados (39, 60, 62, 137, 139) entram com "(RETIRADO)" no local.
--
-- Rodar no banco do RS (SQL Editor). Pode rodar de novo: não duplica nada.
-- =============================================================================

do $$
declare
  v_cliente uuid;
  v_modelo  uuid;
  v_qtd     integer;
begin
  select id into v_cliente from public.clientes
   where regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') = '18631739002453';
  if v_cliente is null then
    raise exception 'Cliente Neovia (CNPJ 18.631.739/0024-53) não encontrado.';
  end if;

  select m.id into v_modelo
    from public.os_modelos m
    join public.tipos_servico t on t.id = m.tipo_servico_id
    join public.enderecos e on e.id = m.endereco_id
   where m.cliente_id = v_cliente and m.categoria = 'contrato' and t.formulario_os = 'pragas'
     and e.logradouro ilike '%guilherme schell%'
   order by m.criado_em
   limit 1;
  if v_modelo is null then
    raise exception 'A Neovia não tem O.S de contrato de controle de pragas. Rode o neovia_os_contrato.sql.';
  end if;

  update public.os_modelos
     set escopo = '{"subtipo": "insetos_roedores", "pragas_alvo": [], "areas_insetos": "Portaria, Administrativo, Laboratório, Almoxarifado, Refeitório, Sanitários, Vestiários, Áreas de Produção, Depósitos e demais áreas não mencionadas, contemplando área total de aproximadamente 71.962,5 m²", "pragas_insetos": "Baratas (B), Formigas (F), Moscas (M), Mosquito (MQ), Aranhas (A), Traças (T), Lesma (L)", "armadilhas_contrato": 3, "planilha_ocorrencias": true, "envelope": true, "objetivo_feromonio": "Monitoramento semanal: identificar as principais espécies de pragas (como o gorgulho-dos-cereais, traças, lagarta-do-cartucho, entre outros). Troque a armadilha a cada 60 dias ou quando houver excesso de pó ou de insetos aderidos à cola."}'::jsonb || coalesce(escopo, '{}'::jsonb)
   where id = v_modelo;

  insert into public.pontos_controle
    (modelo_id, tipo, numero, area, forma_iscagem, tipo_isca, modelo_armadilha, ultima_troca_lampada)
  select v_modelo, n.tipo::public.tipo_ponto, n.numero,
         n.area || case when n.tipo = 'porta_isca' and n.numero in (39, 60, 62, 137, 139)
                        then ' (RETIRADO)' else '' end,
         n.forma_iscagem, n.tipo_isca, n.modelo_armadilha, n.ultima_troca_lampada
    from (values
    ('porta_isca', 1, 'Frente Subestação', 'PIE', 'IP', null, null),
    ('porta_isca', 2, 'Subestação Extintor', 'PIE', 'IP', null, null),
    ('porta_isca', 3, 'Portaria', 'PIE', 'IP', null, null),
    ('porta_isca', 4, 'Cerca frente', 'PIE', 'IP', null, null),
    ('porta_isca', 5, 'Cerca frente', 'PIE', 'IP', null, null),
    ('porta_isca', 6, 'Cerca lateral Caixa D''água', 'PIE', 'IP', null, null),
    ('porta_isca', 7, 'Cerca lateral refeitório', 'PIE', 'IP', null, null),
    ('porta_isca', 8, 'Cerca lateral vestiários', 'PIE', 'IP', null, null),
    ('porta_isca', 9, 'Lateral Refeitório', 'PIE', 'IP', null, null),
    ('porta_isca', 10, 'Lateral Refeitório', 'PIE', 'IP', null, null),
    ('porta_isca', 11, 'Sala lazer porta', 'PIE', 'IP', null, null),
    ('porta_isca', 12, 'Frente Administrativo', 'PIE', 'IP', null, null),
    ('porta_isca', 13, 'Administrativo balança', 'PIE', 'IP', null, null),
    ('porta_isca', 14, 'Sala Motoristas', 'PIE', 'IP', null, null),
    ('porta_isca', 15, 'Hidrante armazém MP', 'PIE', 'IP', null, null),
    ('porta_isca', 16, 'Frente expedição', 'PIE', 'IP', null, null),
    ('porta_isca', 17, 'Área Externa Moega Grão', 'PIE', 'IP', null, null),
    ('porta_isca', 18, 'Cerca Lateral direito', 'PIE', 'IP', null, null),
    ('porta_isca', 19, 'Armazenagem PA', 'PIE', 'IP', null, null),
    ('porta_isca', 20, 'Cerca Armazém PA/SM Lat. direito', 'PIE', 'IP', null, null),
    ('porta_isca', 21, 'Cerca Armazém PA/SM Lat. direito', 'PIE', 'IP', null, null),
    ('porta_isca', 22, 'Cerca Armazém PA/SM Lat. direito', 'PIE', 'IP', null, null),
    ('porta_isca', 23, 'Porta Sal mineral', 'PIE', 'IP', null, null),
    ('porta_isca', 24, 'Cerca lateral direita', 'PIE', 'IP', null, null),
    ('porta_isca', 25, 'Prod. Sal Mineral', 'PIE', 'IP', null, null),
    ('porta_isca', 26, 'Armazém MP Cerca lateral direito', 'PIE', 'IP', null, null),
    ('porta_isca', 27, 'Área Externa Armazém MP', 'PIE', 'IP', null, null),
    ('porta_isca', 28, 'Área Externa Armazém MP', 'PIE', 'IP', null, null),
    ('porta_isca', 29, 'Área Externa Armazém MP', 'PIE', 'IP', null, null),
    ('porta_isca', 30, 'Cerca lateral direito Armazém MP', 'PIE', 'IP', null, null),
    ('porta_isca', 31, 'Área Externa Armazém MP', 'PIE', 'IP', null, null),
    ('porta_isca', 32, 'Área Externa Armazém MP', 'PIE', 'IP', null, null),
    ('porta_isca', 33, 'Área Externa Armazém MP', 'PIE', 'IP', null, null),
    ('porta_isca', 34, 'Cerca Silos', 'PIE', 'IP', null, null),
    ('porta_isca', 35, 'Cerca Silos', 'PIE', 'IP', null, null),
    ('porta_isca', 36, 'Salão de Festas lateral', 'PIE', 'IP', null, null),
    ('porta_isca', 37, 'Salão de Festas frente', 'PIE', 'IP', null, null),
    ('porta_isca', 38, 'Campo Futebol fundos', 'PIE', 'IP', null, null),
    ('porta_isca', 39, 'Campo Futebol fundos', 'PIE', 'IP', null, null),
    ('porta_isca', 40, 'Cerca lateral esquerdo', 'PIE', 'IP', null, null),
    ('porta_isca', 41, 'Cerca lateral esquerdo', 'PIE', 'IP', null, null),
    ('porta_isca', 42, 'Cerca lateral esquerdo', 'PIE', 'IP', null, null),
    ('porta_isca', 43, 'Descarte EPI''s', 'PIE', 'IP', null, null),
    ('porta_isca', 44, 'Descarte lâmpadas', 'PIE', 'IP', null, null),
    ('porta_isca', 45, 'Hidrante Dep. Resíduos', 'PIE', 'IP', null, null),
    ('porta_isca', 46, 'Área Externa Pesagem Micro', 'PIE', 'IP', null, null),
    ('porta_isca', 47, 'Armazém Embalagem Pet', 'PIE', 'IP', null, null),
    ('porta_isca', 48, 'Armazém MP e PA - 2', 'PIE', 'IP', null, null),
    ('porta_isca', 49, 'Armazém MP e PA - 2', 'PIE', 'IP', null, null),
    ('porta_isca', 50, 'Escada Térreo Multicomponente', 'PIE', 'IP', null, null),
    ('porta_isca', 51, 'Manutenção', 'PIE', 'IP', null, null),
    ('porta_isca', 52, 'Cerca Gerador', 'PIE', 'IP', null, null),
    ('porta_isca', 53, 'Cerca Lateral Esquerdo', 'PIE', 'IP', null, null),
    ('porta_isca', 54, 'Cerca Lateral Esquerdo', 'PIE', 'IP', null, null),
    ('porta_isca', 55, 'Cerca GLP Lateral esquerdo', 'PIE', 'IP', null, null),
    ('porta_isca', 56, 'Cerca Lateral esquerdo', 'PIE', 'IP', null, null),
    ('porta_isca', 57, 'Cerca balança', 'PIE', 'IP', null, null),
    ('porta_isca', 58, 'Cerca balança', 'PIE', 'IP', null, null),
    ('porta_isca', 59, 'Cerca estacionamento', 'PIE', 'IP', null, null),
    ('porta_isca', 60, 'Armazém de lona', 'PIE', 'IP', null, null),
    ('porta_isca', 61, 'Silo desativado', 'PIE', 'IP', null, null),
    ('porta_isca', 62, 'Tendas', 'PIE', 'IP', null, null),
    ('porta_isca', 63, 'Armazém de Lona', 'PIE', 'IP', null, null),
    ('porta_isca', 64, 'Laje Superior escada', 'PIE', 'IP', null, null),
    ('porta_isca', 65, 'Laje Superior porta', 'PIE', 'IP', null, null),
    ('porta_isca', 66, 'Laje Superior extintor', 'PIE', 'IP', null, null),
    ('porta_isca', 101, 'Armazém Prod. Acab. extintor', 'PII', 'TR', null, null),
    ('porta_isca', 102, 'Armazém Prod. Acab. hidrante', 'PII', 'TR', null, null),
    ('porta_isca', 103, 'Armazém Produto acabado', 'PII', 'TR', null, null),
    ('porta_isca', 104, 'Armazém Prod. Acab. Portão', 'PII', 'TR', null, null),
    ('porta_isca', 105, 'Armazém Produto acabado', 'PII', 'TR', null, null),
    ('porta_isca', 106, 'Armazém Produto acabado', 'PII', 'TR', null, null),
    ('porta_isca', 107, 'Armazém Prod. Acab. extintor', 'PII', 'TR', null, null),
    ('porta_isca', 108, 'Estrechadeira Armazém', 'PII', 'TR', null, null),
    ('porta_isca', 109, 'Micro ingrediente porta', 'PII', 'TR', null, null),
    ('porta_isca', 110, 'Arm. Matéria Prima escada', 'PII', 'TR', null, null),
    ('porta_isca', 111, 'Arm. Matéria Prima extintor', 'PII', 'TR', null, null),
    ('porta_isca', 112, 'Arm. Matéria Prima porta', 'PII', 'TR', null, null),
    ('porta_isca', 113, 'Arm. Matéria Prima porta', 'PII', 'TR', null, null),
    ('porta_isca', 114, 'Arm. Matéria Prima extintor', 'PII', 'TR', null, null),
    ('porta_isca', 115, 'Arm. Matéria Prima extintor', 'PII', 'TR', null, null),
    ('porta_isca', 116, 'Arm. Matéria Prima porta saída', 'PII', 'TR', null, null),
    ('porta_isca', 117, 'Extintor Armazém PA', 'PII', 'TR', null, null),
    ('porta_isca', 118, 'Armazém Porta PA', 'PII', 'TR', null, null),
    ('porta_isca', 119, 'Arm. Mat. Prima', 'PII', 'TR', null, null),
    ('porta_isca', 120, 'Arm. Mat. Prima e Pet', 'PII', 'TR', null, null),
    ('porta_isca', 121, 'Pet Arm. Mat. Prima Extintor', 'PII', 'TR', null, null),
    ('porta_isca', 122, 'Pet Arm. Mat. Prima Porta', 'PII', 'TR', null, null),
    ('porta_isca', 123, 'Pet Arm. Mat. Prima Porta', 'PII', 'TR', null, null),
    ('porta_isca', 124, 'Produção Sal Mineral', 'PII', 'TR', null, null),
    ('porta_isca', 125, 'Produção Sal Mineral', 'PII', 'TR', null, null),
    ('porta_isca', 126, 'Produção Sal Mineral', 'PII', 'TR', null, null),
    ('porta_isca', 127, 'Subsolo Porão Extintor', 'PII', 'TR', null, null),
    ('porta_isca', 128, 'Multicomponente 1° Piso', 'PII', 'IP', null, null),
    ('porta_isca', 129, 'Multicomponente 2° Piso', 'PII', 'IP', null, null),
    ('porta_isca', 130, 'Manutenção', 'PII', 'IP', null, null),
    ('porta_isca', 131, 'Manutenção', 'PII', 'IP', null, null),
    ('porta_isca', 132, 'Caldeira', 'PII', 'IP', null, null),
    ('porta_isca', 133, 'Estoque Cozinha', 'PII', 'TR', null, null),
    ('porta_isca', 134, 'Cozinha', 'PII', 'TR', null, null),
    ('porta_isca', 135, 'Armazém MP e PA - 2', 'PII', 'TR', null, null),
    ('porta_isca', 136, 'Armazém MP e PA - 2', 'PII', 'TR', null, null),
    ('porta_isca', 137, 'Armazém MP e PA - 2', 'PII', 'CO', null, null),
    ('porta_isca', 138, 'Armazém MP e PA - 2', 'PII', 'TR', null, null),
    ('porta_isca', 139, 'Subsolo Porão Extintor', 'PII', 'IP', null, null),
    ('porta_isca', 140, 'Subsolo Porão Túnel', 'PII', 'TR', null, null),
    ('armadilha_luminosa', 1, 'Refeitório (Entrada)', null, null, 'G', date '2025-06-09'),
    ('armadilha_luminosa', 2, 'Refeitório (Interior)', null, null, 'G', date '2025-12-08'),
    ('armadilha_luminosa', 3, 'Cozinha Refeitório', null, null, 'G', date '2025-09-22'),
    ('armadilha_moscas', 1, 'Ao redor da bomba melaço (manutenção)', null, null, null, null),
    ('armadilha_moscas', 2, 'Atrás da bomba melaço (descarte farinha)', null, null, null, null),
    ('feromonio', 1, 'Depósito Material Acabado', null, null, null, date '2026-10-26'),
    ('feromonio', 2, 'Depósito Material Acabado', null, null, null, date '2026-10-26'),
    ('feromonio', 3, 'Depósito Material Acabado', null, null, null, date '2026-10-26'),
    ('feromonio', 4, 'Masipack', null, null, null, date '2026-10-26'),
    ('feromonio', 5, 'Produção Sal Mineral', null, null, null, date '2026-10-26'),
    ('feromonio', 6, 'Depósito Embalagens', null, null, null, date '2026-10-26'),
    ('feromonio', 7, 'Produção', null, null, null, date '2026-10-26'),
    ('feromonio', 8, 'Sala Micro Geral', null, null, null, date '2026-10-26'),
    ('feromonio', 9, 'Depósito Matéria Prima', null, null, null, date '2026-10-26'),
    ('feromonio', 10, 'Sala Micro para cavalos', null, null, null, date '2026-10-26'),
    ('feromonio', 11, 'Depósito Matéria Prima', null, null, null, date '2026-10-26'),
    ('feromonio', 12, 'Depósito Matéria Prima 2', null, null, null, date '2026-10-26')
    ) as n (tipo, numero, area, forma_iscagem, tipo_isca, modelo_armadilha, ultima_troca_lampada)
   where not exists (
     select 1 from public.pontos_controle p
      where p.modelo_id = v_modelo and p.tipo::text = n.tipo and p.numero = n.numero);
  get diagnostics v_qtd = row_count;
  raise notice 'Pontos acrescentados: %', v_qtd;
end
$$;

-- Confere: quantos pontos de cada tipo a O.S de contrato tem agora.
select p.tipo, count(*) as quantidade, min(p.numero) as do_numero, max(p.numero) as ate_numero
  from public.pontos_controle p
  join public.os_modelos m on m.id = p.modelo_id
  join public.clientes c on c.id = m.cliente_id
 where regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g') = '18631739002453'
   and m.categoria = 'contrato' and p.ativo
   and m.endereco_id in (select id from public.enderecos where logradouro ilike '%guilherme schell%')
 group by p.tipo
 order by p.tipo;
