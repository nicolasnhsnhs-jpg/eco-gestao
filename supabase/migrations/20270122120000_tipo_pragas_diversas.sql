-- =============================================================================
-- Tipo de serviço "Controle de pragas diversas" (pombos, morcegos, abelhas,
-- marimbondos, escorpiões, pulgas, carrapatos...), feito com base na folha de OS
-- em papel de controle de pombos (ex.: "Controle de Pombos: Exclusão — limpeza,
-- aplicação de repelente e remoção de ninhos").
--
-- Usa o mesmo formulário das OS simples de insetos e roedores
-- (20270102120100_os_pragas_simples.sql): o escritório escreve a descrição do
-- serviço e as áreas atendidas e pode programar os produtos; o técnico marca se
-- foi conforme o planejado, escreve o que foi feito (obrigatório) e anota os
-- produtos; o cliente confere e assina. O certificado é o de pragas.
-- =============================================================================

insert into public.tipos_servico (nome, periodicidade_meses_padrao, tipo_vencimento, fotos_antes_depois, formulario_os)
select 'Controle de pragas diversas', 3, 'certificado', false, 'pragas_simples'
 where not exists (select 1 from public.tipos_servico where nome = 'Controle de pragas diversas');
