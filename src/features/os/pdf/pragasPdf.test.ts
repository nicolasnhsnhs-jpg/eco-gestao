import { describe, expect, it } from 'vitest'

import { SITUACOES_ISCA, SITUACOES_PLACA } from '../tipos/pragas'
import type { PontoOs } from '../pragasApi'
import { contarSituacoes, resumoSituacoes } from './pragasPdf'

const ponto = (tipo_isca: string, situacao: string | null) =>
  ({ tipo_isca, situacao }) as unknown as PontoOs

describe('pizza e resumo das situações', () => {
  it('conta as colas pelas siglas da placa (em branco = M)', () => {
    const colas = [ponto('CO', 'M'), ponto('CO', null), ponto('CO', 'SC'), ponto('CO', 'T')]
    const contagem = contarSituacoes(colas, SITUACOES_PLACA)
    expect(contagem.map((s) => [s.codigo, s.n])).toEqual([
      ['M', 2],
      ['SC', 1],
      ['T', 1],
    ])
    expect(resumoSituacoes(contagem, 4, 'placas de cola')).toBe(
      'De 4 placas de cola, 2 M (mantido), 1 SC (substituído c/ captura) e 1 T (trocado).',
    )
  })

  it('resume a isca parafinada com o nome de cada sigla', () => {
    const iscas = [ponto('IP', 'MS'), ponto('IP', 'MS'), ponto('IP', 'MC')]
    expect(resumoSituacoes(contarSituacoes(iscas, SITUACOES_ISCA), 3, 'iscas parafinadas')).toBe(
      'De 3 iscas parafinadas, 2 MS (mantido sem consumo) e 1 MC (mantido com consumo).',
    )
  })
})
