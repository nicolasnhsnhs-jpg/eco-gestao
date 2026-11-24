import { describe, expect, it } from 'vitest'

import { escreverExecucao, lerExecucao } from './execucao'

const PRAGAS = 'Mão de obra especializada;\nExecução do serviço: 02 horas / 02 operadores técnicos.'

describe('tempo e operadores da proposta', () => {
  it('lê as variações dos modelos', () => {
    expect(lerExecucao(PRAGAS)).toEqual({ tempo: '02 horas', operadores: 2, resto: [] })
    expect(lerExecucao('Execução do serviço: 01h30 / 01 operador técnico.')).toEqual({
      tempo: '01h30',
      operadores: 1,
      resto: [],
    })
    expect(lerExecucao('Execução do serviço: 02 operadores técnicos.')).toEqual({
      tempo: '',
      operadores: 2,
      resto: [],
    })
    expect(
      lerExecucao('Execução do serviço: 02 operadores / caminhão de auto vácuo e hidrojato.'),
    ).toEqual({ tempo: '', operadores: 2, resto: ['caminhão de auto vácuo e hidrojato'] })
    expect(lerExecucao('Execução do serviço: 02 técnicos, tempo previsto de 03 horas;')).toEqual({
      tempo: '03 horas',
      operadores: 2,
      resto: [],
    })
    expect(lerExecucao('Outra coisa;')).toEqual({ tempo: '', operadores: null, resto: [] })
  })

  it('reescreve só a linha da execução', () => {
    expect(escreverExecucao(PRAGAS, { tempo: '04 horas', operadores: 3, resto: [] })).toBe(
      'Mão de obra especializada;\nExecução do serviço: 04 horas / 03 operadores técnicos.',
    )
    expect(escreverExecucao(PRAGAS, { tempo: '', operadores: 1, resto: [] })).toBe(
      'Mão de obra especializada;\nExecução do serviço: 01 operador técnico.',
    )
    expect(escreverExecucao(PRAGAS, { tempo: '', operadores: null, resto: [] })).toBe(
      'Mão de obra especializada;',
    )
    expect(escreverExecucao('A;', { tempo: '1 hora', operadores: 2, resto: [] })).toBe(
      'A;\nExecução do serviço: 1 hora / 02 operadores técnicos.',
    )
    expect(
      escreverExecucao('Execução do serviço: 02 operadores / caminhão.', {
        tempo: '',
        operadores: 3,
        resto: ['caminhão'],
      }),
    ).toBe('Execução do serviço: 03 operadores técnicos / caminhão.')
  })
})
