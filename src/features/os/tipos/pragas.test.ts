import { describe, expect, it } from 'vitest'

import { escreverFaixas, lerFaixas, nivelPorContagem, sugerirNivelRoedores } from './pragas'

describe('lerFaixas', () => {
  it('entende números soltos e faixas', () => {
    expect(lerFaixas('12, 15, 40-43').numeros).toEqual([12, 15, 40, 41, 42, 43])
  })

  it('aceita espaço, ponto e vírgula e "a" como separador de faixa', () => {
    expect(lerFaixas('7; 9 3a5').numeros).toEqual([3, 4, 5, 7, 9])
  })

  it('aponta o que não entendeu', () => {
    expect(lerFaixas('12, doze, 3-').invalidos).toEqual(['doze', '3-'])
  })

  it('recusa faixas enormes (provável erro de digitação)', () => {
    expect(lerFaixas('1-9000').invalidos).toEqual(['1-9000'])
  })
})

describe('escreverFaixas', () => {
  it('junta números seguidos em faixas', () => {
    expect(escreverFaixas([45, 12, 40, 41, 42, 43, 44, 15])).toBe('12, 15, 40-45')
  })

  it('dois números seguidos não viram faixa', () => {
    expect(escreverFaixas([7, 8])).toBe('7, 8')
  })
})

describe('sugerirNivelRoedores', () => {
  it('até 10% de consumo é baixo', () => {
    const situacoes = [...Array(9).fill('MS'), 'MC']
    expect(sugerirNivelRoedores(situacoes)).toEqual({ nivel: 'B', percentual: 10 })
  })

  it('sem acesso e não encontrado não contam como visitados', () => {
    expect(sugerirNivelRoedores(['MS', 'MC', 'SA', 'NE']).nivel).toBe('A')
  })

  it('placas adesivas ficam fora da conta', () => {
    expect(sugerirNivelRoedores(['M', 'T', 'MS', 'MS', 'MS', 'DT']).nivel).toBe('M')
  })

  it('sem nada visitado não sugere', () => {
    expect(sugerirNivelRoedores(['SA']).nivel).toBeNull()
  })
})

describe('nivelPorContagem', () => {
  it('segue a legenda da ficha', () => {
    expect(nivelPorContagem(0)).toBeNull()
    expect(nivelPorContagem(50)).toBe('B')
    expect(nivelPorContagem(99)).toBe('M')
    expect(nivelPorContagem(100)).toBe('A')
  })
})
