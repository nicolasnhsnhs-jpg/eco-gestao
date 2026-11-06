-- Catálogo de produtos dos certificados (RS; copiado também para SC em 06/11/2026).
-- Lista tirada do modelo "Certificado CICR com produtos" (lotes de 2026).
-- Não é migration: roda à parte em cada banco, com o aval do usuário:
--   npx supabase db query --linked -f supabase/dados/produtos_certificado_rs.sql
-- Pode rodar de novo: produto que já existe (mesmo nome comercial e
-- princípio ativo) é ignorado; lotes novos são trocados pela tela.

insert into public.produtos_certificado
  (nome_comercial, principio_ativo, registro, quantidade_padrao, lote, fabricacao, validade)
select v.nome, v.principio, v.registro, v.qtd, v.lote, v.fab::date, v.val::date
from (values
  ('TERMIGAMA 2,5 CE', 'Fipronil', '3.0425.0124.001-4', '50ml', '024/26', '2026-05-01', '2028-05-01'),
  ('BLATUM GEL', 'Fipronil', '3.2699.0006.001-4', '30g', '052/15', '2025-12-01', '2027-12-01'),
  ('MOSCAZUM', 'Azametifós', 'MS 3.2699.0009.001-0', '20g', '045/25', '2025-06-01', '2027-06-01'),
  ('ACTELLIC', 'Pirimifós-Metilico', 'MS 3.0119.6669', '200ml', '0005-25-06300', '2025-10-01', '2029-10-01'),
  ('F3', 'Deltametrina/Praletrina', 'MS 3.0425.0105.001-0', '10ml', '415.45.15.415', '2026-03-01', '2028-03-01'),
  ('MAXFORCE GEL BARATAS', 'Imidacloprido', 'MS 3.3222.0040', '2p/m²', '41-44-7463', '2026-01-01', '2028-01-01'),
  ('MAXFORCE GEL FORMIGAS', 'Imidacloprido', 'MS 3.3222.0054', '2p/m²', '52-41-0415', '2024-10-01', '2028-10-01'),
  ('SCRE4M', 'Bifentrina, Tiametoxam, Piriproxifem e Fipronil', 'MS 3.2781.0085', '400ml', '425/25', '2025-03-01', '2027-03-01'),
  ('TRIAFOL 250 WG', 'Tiametoxan', 'MS 356850013', '10g', '524', '2025-02-01', '2027-02-01'),
  ('Polímeros', 'Gel Pombos', 'Isento de Registro', '100g', '458/25', '2025-11-01', '2027-11-01'),
  ('MATA MOSCA', 'Acetamiprido/Bifentrina', 'MS 3.2781.0081', '50g', '415/25', '2025-04-01', '2027-04-01'),
  ('LARVEK', 'Temefós', 'MS 3383-96-8', '1,5Kg', '41541', '2025-08-01', '2027-08-01'),
  ('COBRAS', 'Enxofre', 'MAPA PR-05850 03001', '30g', '0415', '2025-04-01', '2027-04-01'),
  (null, 'Alfacipermetrina - Flufenoxuron', 'MS 3.5685.0050.001-8', '100ml', '154', '2025-10-01', '2027-10-01'),
  ('FENDONA', 'Alfa-Cipermetrina', 'MS 304040031', '100ml', '004-24-15600', '2024-07-01', '2027-07-01'),
  ('ICON 2.5 EW', 'Lambda-cialotrina', 'MS 3.0119.6656', '30ml', '0451-22-0452', '2025-04-01', '2027-04-01'),
  ('ICON 5 CE', 'Lambda-cialotrina', 'MS 3.0119.0014', '50ml', '4156-41-0415', '2025-10-01', '2027-10-01'),
  ('IDEMAND 2,5 (UNIMED)', 'Lambda-cialotrina', 'MS 3.0119.6626.001-7', '50ml', '5263-15-4152', '2025-07-01', '2027-07-01'),
  ('LANKRON 2,5 ME', 'Lambda-cialotrina', 'MS 3.0425.0085.001-3', '50ml', '526/25', '2025-07-01', '2027-07-01'),
  ('K-OTRINE WG 250', 'Deltametrina', 'MS 3.3222.0042', '40g', 'SE415', '2026-06-01', '2028-06-01'),
  ('K-OTRINE 2P', 'Deltametrina', 'MS 3.3222.0015', '40g', '04525489654', '2025-11-01', '2029-11-01'),
  ('RATUM', 'Brodifacoum', 'MS 3.2699.0001.002-5', '20g/bl', '415/25', '2025-04-01', '2027-04-01'),
  ('RATOL GRAN GS', 'Brodifacoum - Semente', 'MS 3.2398.0009.001-7', '580g', '526/25', '2025-08-01', '2027-08-01'),
  ('FULMI RAT', 'Cumatetralil', 'MS 3.1606.0021.002-9', '100g', '415/26', '2026-05-01', '2028-05-01'),
  ('RACOMIN (NEOVIA)', 'Cumatetralil', 'MS 3.3222.0049', '100g', '5264-15-04189', '2026-04-01', '2028-04-01'),
  ('COLLY RATO', 'Cola Atóxica', 'Isento de Registro', '1 placa a cada 5-10m', '659', '2025-05-01', '2027-05-01'),
  ('CYPERPRAG 250 CE', 'Cipermetrina', 'MS 3.1606.0046.001-7', '100ml', '052464158', '2025-11-01', '2027-11-01'),
  ('CYPEREX 400 PM', 'Cipermetrina', 'M.S 3.0425.0082.001-7', '100g', '003/25', '2025-03-01', '2027-03-01'),
  ('DEVETION', 'Diclorvós', 'MS 3.1606.0050.001-9', '10ml', '045-25-4184', '2025-10-01', '2027-10-01'),
  ('MAKI SOFT BAIT', 'Bromadiolona', 'MS 322330111', '10g', '0415489654', '2025-08-01', '2027-08-01'),
  ('FORMITEX GEL', 'Indoxacarb', 'M.S 3.0425.0090.001-0', '10g', '04152', '2025-12-01', '2027-12-01'),
  ('LANDREX PLUS', 'Indoxacarb/Fipronil', 'M.S 3.1333.0021', '10g', '01533', '2026-02-01', '2028-02-01'),
  ('RODILON SOFT BAIT ISCA FRESCA', 'Difetialona', 'MS 317.890.015', '10g', '458-89-5241', '2025-08-01', '2027-08-01'),
  ('RODILON BLOCO EXTRUSADO', 'Difetialona', 'MS 317.890.014', '15g', '4545-85-639', '2025-11-01', '2027-11-01'),
  -- Usado na limpeza de reservatórios.
  (null, 'Clorin', null, null, '2405048', '2024-03-01', '2027-03-01')
) as v(nome, principio, registro, qtd, lote, fab, val)
where not exists (
  select 1 from public.produtos_certificado p
  where p.nome_comercial is not distinct from v.nome
    and p.principio_ativo = v.principio
);
