import { describe, expect, it } from 'vitest'

import { gerarParcelas } from './parcelas'

describe('gerarParcelas', () => {
  it('divide o valor e põe os centavos que sobram na primeira parcela', () => {
    const parcelas = gerarParcelas(1000, 3, '2026-11-10')
    expect(parcelas.map((p) => p.valor)).toEqual([333.34, 333.33, 333.33])
    expect(parcelas.reduce((soma, p) => soma + p.valor * 100, 0)).toBe(100000)
  })

  it('vence um mês depois do outro, com a competência no mês de cada vencimento', () => {
    const parcelas = gerarParcelas(300, 3, '2026-11-10')
    expect(parcelas.map((p) => p.vencimento)).toEqual(['2026-11-10', '2026-12-10', '2027-01-10'])
    expect(parcelas.map((p) => p.competencia)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01'])
  })

  it('usa o último dia quando o mês não tem o dia do vencimento', () => {
    const parcelas = gerarParcelas(400, 4, '2027-01-31')
    expect(parcelas.map((p) => p.vencimento)).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
    ])
  })

  it('recusa quantidade inválida', () => {
    expect(() => gerarParcelas(100, 0, '2026-11-10')).toThrow()
    expect(() => gerarParcelas(100, 1.5, '2026-11-10')).toThrow()
  })
})
