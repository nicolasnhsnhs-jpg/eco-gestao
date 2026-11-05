import { describe, expect, it } from 'vitest'

import { descontoEmReais, porcentagemDoDesconto, totalBruto } from './antecipacao'

describe('antecipação', () => {
  it('soma os valores sem erro de arredondamento', () => {
    expect(totalBruto([0.1, 0.2, '333.34'])).toBe(333.64)
  })

  it('converte a porcentagem em reais', () => {
    expect(descontoEmReais(1000, 'porcentagem', 3.5)).toBe(35)
    expect(descontoEmReais(333.33, 'porcentagem', 2)).toBe(6.67)
    expect(descontoEmReais(1000, 'reais', 12.345)).toBe(12.35)
  })

  it('mostra quanto o desconto representa', () => {
    expect(porcentagemDoDesconto(1000, 35)).toBe(3.5)
    expect(porcentagemDoDesconto(0, 10)).toBe(0)
  })
})
