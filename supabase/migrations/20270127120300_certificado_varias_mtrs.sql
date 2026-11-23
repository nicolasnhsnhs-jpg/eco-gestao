-- =============================================================================
-- Certificado de sucção com várias MTRs (pedido de 23/11/2026): vários clientes têm
-- mais de uma sucção por serviço, cada uma com a sua MTR e a quantidade retirada.
--
--   mtrs: [{"numero": "123456", "quantidade": "2,000m³"}, ...]
--
-- As colunas antigas (mtr e volume) ficam para os certificados já emitidos; a tela
-- grava nelas também o resumo (números e quantidades juntos).
-- =============================================================================

alter table public.certificados
  add column mtrs jsonb not null default '[]' check (jsonb_typeof(mtrs) = 'array');

comment on column public.certificados.mtrs is
  'Sucção: uma linha por MTR, com o número e a quantidade retirada naquela MTR.';

grant insert (mtrs), update (mtrs) on public.certificados to authenticated;
