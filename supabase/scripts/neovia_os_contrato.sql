-- =============================================================================
-- O.S de contrato da NEOVIA NUTRIÇÃO E SAÚDE ANIMAL LTDA (Canoas/RS, CNPJ
-- 18.631.739/0024-53), feitas a partir das fichas em Word de 16/11/2026:
--
-- 1. Controle de pragas (insetos e roedores) — junta a ficha "CI CR" com a de
--    feromônio: 66 porta-iscas externos (1-66), 40 internos (101-140; na ficha
--    antiga 01-40), 3 armadilhas luminosas, 2 armadilhas biológicas de moscas,
--    12 armadilhas de feromônio, planilha de ocorrências e envelope. Os
--    porta-iscas "Ret" (retirados: 39, 60, 62, 137 e 139) ficam à vista com
--    "(RETIRADO)" no local.
-- 2. Controle de insetos — "Profilaxia e higiene + CI (mensal)", com os produtos
--    e as dosagens já prontas para o técnico marcar.
--
-- Rodar UMA vez no banco do RS (SQL Editor do Supabase, projeto eco-gestao-rs),
-- depois das migrations 20270105120000 e 20270105120100. Não mexe em O.S de
-- contrato que já exista para o mesmo local e serviço (avisa e pula).
-- Gerado por um script; para mudar algo depois, use a tela da O.S de contrato.
-- =============================================================================

do $$
declare
  v_cliente   uuid;
  v_endereco  uuid;
  v_tipo_pr   uuid;
  v_tipo_in   uuid;
  v_pragas    uuid;
  v_insetos   uuid;
begin
  select id into v_cliente from public.clientes
   where regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') = '18631739002453';
  if v_cliente is null then
    raise exception 'Cliente Neovia (CNPJ 18.631.739/0024-53) não encontrado.';
  end if;
  -- O endereço da Av. Guilherme Schell, se estiver cadastrado como unidade.
  select id into v_endereco from public.enderecos
   where cliente_id = v_cliente and logradouro ilike '%guilherme schell%'
   order by criado_em limit 1;

  select id into v_tipo_pr from public.tipos_servico where formulario_os = 'pragas' and ativo
   order by (nome = 'Controle de pragas') desc, criado_em limit 1;
  select id into v_tipo_in from public.tipos_servico
   where formulario_os = 'pragas_simples' and nome ilike '%inseto%' and ativo
   order by criado_em limit 1;
  if v_tipo_pr is null or v_tipo_in is null then
    raise exception 'Tipos de serviço "Controle de pragas" e "Controle de insetos" não encontrados.';
  end if;

  -- 1. Controle de pragas ----------------------------------------------------
  if exists (select 1 from public.os_modelos
              where cliente_id = v_cliente and endereco_id is not distinct from v_endereco
                and tipo_servico_id = v_tipo_pr and categoria = 'contrato') then
    raise notice 'Já existe O.S de contrato de controle de pragas da Neovia: pulei.';
  else
    insert into public.os_modelos
      (cliente_id, endereco_id, tipo_servico_id, categoria, descricao, escopo, observacoes_adm_padrao)
    values
      (v_cliente, v_endereco, v_tipo_pr, 'contrato',
       'Monitoramento de pragas — insetos, roedores e pragas de cereais (feromônio)',
       '{"subtipo": "insetos_roedores", "pragas_alvo": [], "areas_insetos": "Portaria, Administrativo, Laboratório, Almoxarifado, Refeitório, Sanitários, Vestiários, Áreas de Produção, Depósitos e demais áreas não mencionadas, contemplando área total de aproximadamente 71.962,5 m²", "pragas_insetos": "Baratas (B), Formigas (F), Moscas (M), Mosquito (MQ), Aranhas (A), Traças (T), Lesma (L)", "armadilhas_contrato": 3, "planilha_ocorrencias": true, "envelope": true, "objetivo_feromonio": "Monitoramento semanal: identificar as principais espécies de pragas (como o gorgulho-dos-cereais, traças, lagarta-do-cartucho, entre outros). Troque a armadilha a cada 60 dias ou quando houver excesso de pó ou de insetos aderidos à cola."}'::jsonb,
       'Chegar sempre até às 14:00h. Sempre levar máscara, capacete, protetor auricular e óculos. Usar camiseta de manga longa. EPIs adequados como a touca e protetor de barba. Dúvidas: chamar TST Oraildes.')
    returning id into v_pragas;

    insert into public.pontos_controle
      (modelo_id, tipo, numero, area, forma_iscagem, tipo_isca, modelo_armadilha, ultima_troca_lampada)
    values
    (v_pragas, 'porta_isca', 1, 'Frente Subestação', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 2, 'Subestação Extintor', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 3, 'Portaria', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 4, 'Cerca frente', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 5, 'Cerca frente', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 6, 'Cerca lateral Caixa D''água', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 7, 'Cerca lateral refeitório', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 8, 'Cerca lateral vestiários', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 9, 'Lateral Refeitório', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 10, 'Lateral Refeitório', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 11, 'Sala lazer porta', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 12, 'Frente Administrativo', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 13, 'Administrativo balança', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 14, 'Sala Motoristas', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 15, 'Hidrante armazém MP', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 16, 'Frente expedição', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 17, 'Área Externa Moega Grão', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 18, 'Cerca Lateral direito', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 19, 'Armazenagem PA', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 20, 'Cerca Armazém PA/SM Lat. direito', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 21, 'Cerca Armazém PA/SM Lat. direito', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 22, 'Cerca Armazém PA/SM Lat. direito', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 23, 'Porta Sal mineral', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 24, 'Cerca lateral direita', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 25, 'Prod. Sal Mineral', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 26, 'Armazém MP Cerca lateral direito', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 27, 'Área Externa Armazém MP', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 28, 'Área Externa Armazém MP', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 29, 'Área Externa Armazém MP', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 30, 'Cerca lateral direito Armazém MP', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 31, 'Área Externa Armazém MP', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 32, 'Área Externa Armazém MP', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 33, 'Área Externa Armazém MP', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 34, 'Cerca Silos', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 35, 'Cerca Silos', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 36, 'Salão de Festas lateral', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 37, 'Salão de Festas frente', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 38, 'Campo Futebol fundos', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 39, 'Campo Futebol fundos', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 40, 'Cerca lateral esquerdo', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 41, 'Cerca lateral esquerdo', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 42, 'Cerca lateral esquerdo', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 43, 'Descarte EPI''s', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 44, 'Descarte lâmpadas', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 45, 'Hidrante Dep. Resíduos', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 46, 'Área Externa Pesagem Micro', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 47, 'Armazém Embalagem Pet', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 48, 'Armazém MP e PA - 2', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 49, 'Armazém MP e PA - 2', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 50, 'Escada Térreo Multicomponente', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 51, 'Manutenção', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 52, 'Cerca Gerador', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 53, 'Cerca Lateral Esquerdo', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 54, 'Cerca Lateral Esquerdo', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 55, 'Cerca GLP Lateral esquerdo', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 56, 'Cerca Lateral esquerdo', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 57, 'Cerca balança', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 58, 'Cerca balança', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 59, 'Cerca estacionamento', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 60, 'Armazém de lona', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 61, 'Silo desativado', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 62, 'Tendas', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 63, 'Armazém de Lona', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 64, 'Laje Superior escada', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 65, 'Laje Superior porta', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 66, 'Laje Superior extintor', 'PIE', 'IP', null, null),
    (v_pragas, 'porta_isca', 101, 'Armazém Prod. Acab. extintor', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 102, 'Armazém Prod. Acab. hidrante', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 103, 'Armazém Produto acabado', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 104, 'Armazém Prod. Acab. Portão', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 105, 'Armazém Produto acabado', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 106, 'Armazém Produto acabado', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 107, 'Armazém Prod. Acab. extintor', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 108, 'Estrechadeira Armazém', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 109, 'Micro ingrediente porta', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 110, 'Arm. Matéria Prima escada', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 111, 'Arm. Matéria Prima extintor', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 112, 'Arm. Matéria Prima porta', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 113, 'Arm. Matéria Prima porta', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 114, 'Arm. Matéria Prima extintor', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 115, 'Arm. Matéria Prima extintor', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 116, 'Arm. Matéria Prima porta saída', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 117, 'Extintor Armazém PA', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 118, 'Armazém Porta PA', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 119, 'Arm. Mat. Prima', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 120, 'Arm. Mat. Prima e Pet', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 121, 'Pet Arm. Mat. Prima Extintor', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 122, 'Pet Arm. Mat. Prima Porta', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 123, 'Pet Arm. Mat. Prima Porta', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 124, 'Produção Sal Mineral', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 125, 'Produção Sal Mineral', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 126, 'Produção Sal Mineral', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 127, 'Subsolo Porão Extintor', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 128, 'Multicomponente 1° Piso', 'PII', 'IP', null, null),
    (v_pragas, 'porta_isca', 129, 'Multicomponente 2° Piso', 'PII', 'IP', null, null),
    (v_pragas, 'porta_isca', 130, 'Manutenção', 'PII', 'IP', null, null),
    (v_pragas, 'porta_isca', 131, 'Manutenção', 'PII', 'IP', null, null),
    (v_pragas, 'porta_isca', 132, 'Caldeira', 'PII', 'IP', null, null),
    (v_pragas, 'porta_isca', 133, 'Estoque Cozinha', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 134, 'Cozinha', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 135, 'Armazém MP e PA - 2', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 136, 'Armazém MP e PA - 2', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 137, 'Armazém MP e PA - 2', 'PII', 'CO', null, null),
    (v_pragas, 'porta_isca', 138, 'Armazém MP e PA - 2', 'PII', 'TR', null, null),
    (v_pragas, 'porta_isca', 139, 'Subsolo Porão Extintor', 'PII', 'IP', null, null),
    (v_pragas, 'porta_isca', 140, 'Subsolo Porão Túnel', 'PII', 'TR', null, null),
    (v_pragas, 'armadilha_luminosa', 1, 'Refeitório (Entrada)', null, null, 'G', date '2025-06-09'),
    (v_pragas, 'armadilha_luminosa', 2, 'Refeitório (Interior)', null, null, 'G', date '2025-12-08'),
    (v_pragas, 'armadilha_luminosa', 3, 'Cozinha Refeitório', null, null, 'G', date '2025-09-22'),
    (v_pragas, 'armadilha_moscas', 1, 'Ao redor da bomba melaço (manutenção)', null, null, null, null),
    (v_pragas, 'armadilha_moscas', 2, 'Atrás da bomba melaço (descarte farinha)', null, null, null, null),
    (v_pragas, 'feromonio', 1, 'Depósito Material Acabado', null, null, null, date '2026-10-26'),
    (v_pragas, 'feromonio', 2, 'Depósito Material Acabado', null, null, null, date '2026-10-26'),
    (v_pragas, 'feromonio', 3, 'Depósito Material Acabado', null, null, null, date '2026-10-26'),
    (v_pragas, 'feromonio', 4, 'Masipack', null, null, null, date '2026-10-26'),
    (v_pragas, 'feromonio', 5, 'Produção Sal Mineral', null, null, null, date '2026-10-26'),
    (v_pragas, 'feromonio', 6, 'Depósito Embalagens', null, null, null, date '2026-10-26'),
    (v_pragas, 'feromonio', 7, 'Produção', null, null, null, date '2026-10-26'),
    (v_pragas, 'feromonio', 8, 'Sala Micro Geral', null, null, null, date '2026-10-26'),
    (v_pragas, 'feromonio', 9, 'Depósito Matéria Prima', null, null, null, date '2026-10-26'),
    (v_pragas, 'feromonio', 10, 'Sala Micro para cavalos', null, null, null, date '2026-10-26'),
    (v_pragas, 'feromonio', 11, 'Depósito Matéria Prima', null, null, null, date '2026-10-26'),
    (v_pragas, 'feromonio', 12, 'Depósito Matéria Prima 2', null, null, null, date '2026-10-26');

    -- "Ret" na ficha antiga: porta-iscas retirados continuam à vista, marcados no local.
    update public.pontos_controle set area = area || ' (RETIRADO)'
     where modelo_id = v_pragas and tipo = 'porta_isca' and numero in (39, 60, 62, 137, 139);
    raise notice 'Controle de pragas criado: %', v_pragas;
  end if;

  -- 2. Profilaxia e higiene + controle de insetos ------------------------------
  if exists (select 1 from public.os_modelos
              where cliente_id = v_cliente and endereco_id is not distinct from v_endereco
                and tipo_servico_id = v_tipo_in and categoria = 'contrato') then
    raise notice 'Já existe O.S de contrato de controle de insetos da Neovia: pulei.';
  else
    insert into public.os_modelos
      (cliente_id, endereco_id, tipo_servico_id, categoria, descricao, escopo, observacoes_adm_padrao)
    values
      (v_cliente, v_endereco, v_tipo_in, 'contrato',
       'Profilaxia e higiene — controle de insetos em grãos + controle de insetos (mensal)',
       '{"todas_areas": false, "areas_atendidas": "Profilaxia: Armazém Matéria Prima, Produção, Depósito, Produto Acabado, Área de Produção e Porão. Controle de insetos: Portaria, Administrativo, Laboratório, Almoxarifado, Refeitório, Sanitários, Vestiários e demais áreas não mencionadas.", "programas": [{"id": "profilaxia", "titulo": "Profilaxia e higiene — controle de insetos em grãos (mensal)", "areas": "Armazém Matéria Prima, Produção, Depósito, Produto Acabado, Área de Produção e Porão", "produtos": [{"id": "ddvp", "nome_comercial": "DDVP", "principio_ativo": "Diclorvós", "diluente": "H²O", "procedimento": "(Atom.) / (Pulv.)", "alvos": "baratas, pulgas e moscas", "doses": [{"qnt": "100ml", "calda": "10lts"}, {"qnt": "150ml", "calda": "15lts"}, {"qnt": "200ml", "calda": "20lts"}, {"qnt": "250ml", "calda": "25lts"}]}, {"id": "bergard", "nome_comercial": "BERGARD", "principio_ativo": "Pirimifós-Metílico", "diluente": "H²O", "procedimento": "(Atom.) / (Pulv.)", "alvos": "baratas, moscas, larvas de moscas, carunchos, pulgas e mosquitos", "doses": [{"qnt": "100ml", "calda": "10lts"}, {"qnt": "200ml", "calda": "20lts"}, {"qnt": "300ml", "calda": "30lts"}, {"qnt": "400ml", "calda": "40lts"}]}, {"id": "icon-agua", "nome_comercial": "ICON 5CE", "principio_ativo": "Lambda Cialotrina", "diluente": "H²O", "procedimento": "(Atom.) / (Pulv.)", "alvos": "baratas, cupins de madeira seca, formigas, moscas e mosquitos", "doses": [{"qnt": "5ml", "calda": "1lts"}]}, {"id": "icon-oleo", "nome_comercial": "ICON 5CE", "principio_ativo": "Lambda Cialotrina", "diluente": "Óleo", "procedimento": "(Termo)", "alvos": "moscas, mosquitos", "doses": [{"qnt": "20ml", "calda": "2lts"}]}]}, {"id": "insetos", "titulo": "Controle de insetos (mensal)", "areas": "Portaria, Administrativo, Laboratório, Almoxarifado, Refeitório, Sanitários, Vestiários e demais áreas não mencionadas", "produtos": [{"id": "fendona", "nome_comercial": "FENDONA", "principio_ativo": "Alfa-Cipermetrina", "diluente": "H²O", "procedimento": "Pulverizado", "alvos": "baratas, moscas, pulgas, formigas, mosquitos e aranhas", "doses": [{"qnt": "50ml", "calda": "10lts", "alvo": "baratas, carrapatos, moscas"}, {"qnt": "33ml", "calda": "10lts", "alvo": "mosquitos"}, {"qnt": "17ml", "calda": "10lts", "alvo": "pulgas e formigas"}, {"qnt": "170ml", "calda": "10lts", "alvo": "barbeiros"}]}, {"id": "ciperprag", "nome_comercial": "CIPERPRAG", "principio_ativo": "Cipermetrina", "diluente": "H²O", "procedimento": "Pulverizado", "alvos": "baratas, moscas, larvas de moscas e mosquitos", "doses": [{"qnt": "20ml", "calda": "10lts"}, {"qnt": "40ml", "calda": "20lts"}, {"qnt": "60ml", "calda": "30lts"}, {"qnt": "80ml", "calda": "40lts"}]}]}]}'::jsonb,
       'Sempre levar máscara, usar camiseta de manga comprida, levar capacete, protetor auricular e óculos. Entregar a O.S. na segunda para a Josiane assinar. Portaria libera: Analice 51 99685-4468 ou Josiane 66 99912-0108. Não passar FOG próximo ao CCM, pois vai disparar o alarme de detecção de fumaça.')
    returning id into v_insetos;
    raise notice 'Controle de insetos (profilaxia) criado: %', v_insetos;
  end if;
end
$$;
