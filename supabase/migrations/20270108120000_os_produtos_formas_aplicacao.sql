-- =============================================================================
-- Produtos da OS: além de "Líquido (pulverização)", o técnico marca a técnica de
-- aplicação — atomização, nebulização e polvilhamento (pedido de 16/11/2026).
-- =============================================================================

alter table public.os_produtos drop constraint os_produtos_forma_check;
alter table public.os_produtos add constraint os_produtos_forma_check
  check (forma in ('bloco', 'semente', 'granulada', 'po', 'polvilhamento', 'placa',
                   'liquido', 'atomizacao', 'nebulizacao', 'outro'));
