import { describe, expect, it } from 'vitest'

import { PAPEIS, type Papel } from '@/lib/papeis'

import { barraDoPapel, menuDoPapel } from './navegacao'

const caminhos = (papel: Papel) => menuDoPapel(papel).map((item) => item.caminho)

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

  it('vendedor vê as próprias comissões; os outros perfis não têm esse item', () => {
    expect(caminhos('vendedor')).toContain('/comissoes')
    expect(caminhos('admin')).not.toContain('/comissoes')
    expect(caminhos('recepcao')).not.toContain('/comissoes')
  })

  it('recepção tem início, clientes, ordens de serviço e avisos', () => {
    expect(caminhos('recepcao')).toEqual(['/', '/clientes', '/os', '/avisos'])
  })

  it('operador só tem as OS dele (no início) e os avisos', () => {
    expect(caminhos('operador')).toEqual(['/', '/avisos'])
  })
})

describe('barraDoPapel', () => {
  it('nunca passa de 4 atalhos e todo atalho também está no menu', () => {
    for (const papel of PAPEIS) {
      const barra = barraDoPapel(papel)
      expect(barra.length).toBeLessThanOrEqual(4)
      for (const item of barra) expect(caminhos(papel)).toContain(item.caminho)
    }
  })

  it('vendedor tem atalho para serviços; admin, para o financeiro', () => {
    expect(barraDoPapel('vendedor').map((i) => i.caminho)).toContain('/servicos')
    expect(barraDoPapel('admin').map((i) => i.caminho)).toContain('/financeiro')
  })
})
