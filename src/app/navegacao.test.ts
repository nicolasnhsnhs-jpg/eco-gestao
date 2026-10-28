import { describe, expect, it } from 'vitest'

import { menuDoPapel } from './navegacao'

const caminhos = (papel: Parameters<typeof menuDoPapel>[0]) =>
  menuDoPapel(papel).map((item) => item.caminho)

describe('menuDoPapel', () => {
  it('admin vê tudo, inclusive usuários', () => {
    expect(caminhos('admin')).toContain('/usuarios')
    expect(caminhos('admin')).toContain('/financeiro')
  })

  it('financeiro vê o financeiro, mas não gerencia usuários', () => {
    expect(caminhos('financeiro')).toContain('/financeiro')
    expect(caminhos('financeiro')).not.toContain('/usuarios')
  })

  it('vendedor e recepção não veem o financeiro', () => {
    expect(caminhos('vendedor')).not.toContain('/financeiro')
    expect(caminhos('recepcao')).not.toContain('/financeiro')
  })

  it('recepção não vê propostas', () => {
    expect(caminhos('recepcao')).not.toContain('/propostas')
  })

  it('a barra inferior do celular nunca passa de 4 itens', () => {
    for (const papel of ['admin', 'financeiro', 'vendedor', 'recepcao'] as const) {
      expect(menuDoPapel(papel).filter((i) => i.barraInferior).length).toBeLessThanOrEqual(4)
    }
  })
})
