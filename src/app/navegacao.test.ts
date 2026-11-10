import { describe, expect, it } from 'vitest'

import { PAPEIS, type Papel } from '@/lib/papeis'

import { barraDoPapel, entradasDoPapel, menuDoPapel } from './navegacao'

const caminhos = (papel: Papel) => menuDoPapel(papel).map((item) => item.caminho)

describe('menuDoPapel', () => {
  it('só o admin gerencia usuários', () => {
    for (const papel of PAPEIS.filter((p) => p !== 'admin'))
      expect(caminhos(papel)).not.toContain('/usuarios')
  })

  it('admin vê tudo, inclusive usuários', () => {
    expect(caminhos('admin')).toContain('/usuarios')
    expect(caminhos('admin')).toContain('/financeiro')
  })

  it('financeiro vê o financeiro, mas não gerencia usuários', () => {
    expect(caminhos('financeiro')).toContain('/financeiro')
    expect(caminhos('financeiro')).not.toContain('/usuarios')
  })

  it('vendedor, recepção e ADM não veem o financeiro', () => {
    expect(caminhos('vendedor')).not.toContain('/financeiro')
    expect(caminhos('recepcao')).not.toContain('/financeiro')
    expect(caminhos('administrativo')).not.toContain('/financeiro')
  })

  it('ADM vê tudo, menos o financeiro e os usuários', () => {
    expect(caminhos('administrativo')).toEqual([
      '/',
      '/clientes',
      '/propostas',
      '/orcamentos',
      '/servicos',
      '/os',
      '/certificados',
      '/contratos',
      '/administrativo',
      '/avisos',
    ])
  })

  it('admin e ADM emitem certificados; o vendedor só consulta', () => {
    expect(caminhos('admin')).toContain('/certificados')
    expect(caminhos('administrativo')).toContain('/certificados')
    expect(caminhos('vendedor')).toContain('/certificados')
    for (const papel of ['financeiro', 'recepcao', 'operador'] as const)
      expect(caminhos(papel)).not.toContain('/certificados')
  })

  it('admin, financeiro e ADM veem o administrativo', () => {
    for (const papel of ['admin', 'financeiro', 'administrativo'] as const)
      expect(caminhos(papel)).toContain('/administrativo')
    for (const papel of ['vendedor', 'recepcao', 'operador'] as const)
      expect(caminhos(papel)).not.toContain('/administrativo')
  })

  it('vendedor vê as próprias comissões; os outros perfis não têm esse item', () => {
    expect(caminhos('vendedor')).toContain('/comissoes')
    expect(caminhos('admin')).not.toContain('/comissoes')
    expect(caminhos('recepcao')).not.toContain('/comissoes')
  })

  it('só admin, ADM e vendedor veem a calculadora de orçamentos', () => {
    expect(caminhos('admin')).toContain('/orcamentos')
    expect(caminhos('administrativo')).toContain('/orcamentos')
    expect(caminhos('vendedor')).toContain('/orcamentos')
    for (const papel of ['financeiro', 'recepcao', 'operador'] as const)
      expect(caminhos(papel)).not.toContain('/orcamentos')
  })

  it('recepção tem início, clientes, ordens de serviço e avisos', () => {
    expect(caminhos('recepcao')).toEqual(['/', '/clientes', '/os', '/avisos'])
  })

  it('operador só tem as OS dele (no início) e os avisos', () => {
    expect(caminhos('operador')).toEqual(['/', '/avisos'])
  })
})

describe('entradasDoPapel', () => {
  const resumo = (papel: Papel) =>
    entradasDoPapel(papel).map((e) =>
      e.tipo === 'grupo' ? `${e.rotulo}: ${e.itens.map((i) => i.caminho).join(' ')}` : e.caminho,
    )

  it('ADM: agenda, OS, certificados, contratos e assinatura dentro do Administrativo', () => {
    expect(resumo('administrativo')).toEqual([
      '/',
      '/clientes',
      'Propostas: /propostas /orcamentos',
      'Administrativo: /servicos /os /certificados /contratos /administrativo',
      '/avisos',
    ])
  })

  it('vendedor não tem grupo Administrativo: agenda e contratos ficam soltos', () => {
    expect(resumo('vendedor')).toEqual([
      '/',
      '/clientes',
      'Propostas: /propostas /orcamentos',
      '/servicos',
      '/certificados',
      '/contratos',
      '/comissoes',
      '/avisos',
    ])
  })

  it('grupo com um item só vira item solto', () => {
    expect(resumo('recepcao')).toEqual(['/', '/clientes', '/os', '/avisos'])
    expect(resumo('financeiro')).toContain('/propostas')
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

  it('vendedor tem atalho para serviços; admin, para o financeiro; ADM, para as OS', () => {
    expect(barraDoPapel('vendedor').map((i) => i.caminho)).toContain('/servicos')
    expect(barraDoPapel('admin').map((i) => i.caminho)).toContain('/financeiro')
    expect(barraDoPapel('administrativo').map((i) => i.caminho)).toContain('/os')
  })
})
