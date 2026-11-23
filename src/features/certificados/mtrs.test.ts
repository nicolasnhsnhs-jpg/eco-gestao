import { describe, expect, it } from 'vitest'

import { lerMtrs, linhasMtrs, resumoMtrs } from './mtrs'

describe('MTRs do certificado de sucção', () => {
  it('lê a lista nova e ignora linhas vazias', () => {
    expect(
      lerMtrs({
        mtrs: [
          { numero: ' 123 ', quantidade: '2,000m³' },
          { numero: '', quantidade: '' },
          { numero: '456', quantidade: '3,500m³' },
        ],
        mtr: 'velho',
      }),
    ).toEqual([
      { numero: '123', quantidade: '2,000m³' },
      { numero: '456', quantidade: '3,500m³' },
    ])
  })

  it('certificado antigo: o MTR e o volume viram uma linha', () => {
    expect(lerMtrs({ mtrs: [], mtr: '999', volume: '1m³' })).toEqual([
      { numero: '999', quantidade: '1m³' },
    ])
    expect(lerMtrs({ mtrs: [], mtr: null, volume: null })).toEqual([])
  })

  it('resumo para as colunas antigas e linhas do PDF', () => {
    const l = [
      { numero: '123', quantidade: '2m³' },
      { numero: '456', quantidade: '' },
    ]
    expect(resumoMtrs(l)).toEqual({ mtr: '123, 456', volume: '2m³' })
    expect(resumoMtrs([])).toEqual({ mtr: null, volume: null })
    expect(linhasMtrs(l)).toEqual(['MTR nº 123 · Quantidade: 2m³', 'MTR nº 456'])
  })
})
