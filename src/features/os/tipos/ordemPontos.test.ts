import { describe, expect, it } from 'vitest'

import { numeracaoPorForma, ordenarPontos } from './pragas'

const pi = (numero: number, forma: string) => ({ tipo: 'porta_isca', numero, forma_iscagem: forma })

describe('ordenarPontos', () => {
  it('numeração única: só pelo número, mesmo misturando externos e internos', () => {
    const lista = [pi(3, 'PIE'), pi(1, 'PIE'), pi(2, 'PII')]
    expect(numeracaoPorForma(lista)).toBe(false)
    expect(ordenarPontos(lista).map((p) => p.numero)).toEqual([1, 2, 3])
  })

  it('externos 01-02 e internos 01-02: externos primeiro, depois internos', () => {
    const lista = [pi(1, 'PII'), pi(2, 'PIE'), pi(1, 'PIE'), pi(2, 'PII')]
    expect(numeracaoPorForma(lista)).toBe(true)
    expect(ordenarPontos(lista).map((p) => `${p.forma_iscagem}${p.numero}`)).toEqual([
      'PIE1',
      'PIE2',
      'PII1',
      'PII2',
    ])
  })

  it('número repetido dentro da mesma forma (recomeça por área): não é por forma', () => {
    expect(numeracaoPorForma([pi(1, 'PII'), pi(1, 'PII'), pi(1, 'PIE')])).toBe(false)
  })

  it('outros tipos ficam pelo número', () => {
    const lista = [
      { tipo: 'feromonio', numero: 2 },
      { tipo: 'feromonio', numero: 1 },
    ]
    expect(ordenarPontos(lista).map((p) => p.numero)).toEqual([1, 2])
  })
})
