-- =============================================================================
-- Neovia (RS): porta-iscas marcados "Ret" (retirados) na ficha antiga. Continuam
-- à vista na O.S de contrato, na ficha de campo e no PDF, com "(RETIRADO)" no
-- nome do local:
--   Externos: 39 (Campo Futebol fundos), 60 (Armazém de lona), 62 (Tendas)
--   Internos: 37 → 137 (Armazém MP e PA - 2), 39 → 139 (Subsolo Porão Extintor)
--
-- Rodar no banco do RS (SQL Editor), depois do neovia_os_contrato.sql.
-- Pode rodar de novo: não repete a marcação.
-- =============================================================================

update public.pontos_controle p
   set area = p.area || ' (RETIRADO)',
       ativo = true
  from public.os_modelos m
  join public.clientes c on c.id = m.cliente_id
 where p.modelo_id = m.id
   and regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g') = '18631739002453'
   and m.categoria = 'contrato'
   and m.endereco_id in (select id from public.enderecos where logradouro ilike '%guilherme schell%')
   and p.tipo = 'porta_isca'
   and p.numero in (39, 60, 62, 137, 139)
   and p.area not ilike '%retirado%'
returning p.numero, p.area;
