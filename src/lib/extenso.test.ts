import { describe, expect, it } from 'vitest'

import { inteiroPorExtenso, reaisPorExtenso } from './extenso'

describe('valor por extenso', () => {
  it('escreve os valores das propostas', () => {
    expect(reaisPorExtenso(2680)).toBe('dois mil, seiscentos e oitenta reais')
    expect(reaisPorExtenso(1960)).toBe('mil, novecentos e sessenta reais')
    expect(reaisPorExtenso(806.45)).toBe('oitocentos e seis reais e quarenta e cinco centavos')
    expect(reaisPorExtenso(1080)).toBe('mil e oitenta reais')
    expect(reaisPorExtenso(5000)).toBe('cinco mil reais')
    expect(reaisPorExtenso(105)).toBe('cento e cinco reais')
    expect(reaisPorExtenso(100)).toBe('cem reais')
    expect(reaisPorExtenso(1)).toBe('um real')
    expect(reaisPorExtenso(0.5)).toBe('cinquenta centavos')
    expect(reaisPorExtenso(1100)).toBe('mil e cem reais')
    expect(reaisPorExtenso(2000000)).toBe('dois milhões de reais')
  })

  it('escreve números grandes', () => {
    expect(inteiroPorExtenso(21_580)).toBe('vinte e um mil, quinhentos e oitenta')
    expect(inteiroPorExtenso(1_000_001)).toBe('um milhão e um')
    expect(inteiroPorExtenso(0)).toBe('zero')
  })
})
