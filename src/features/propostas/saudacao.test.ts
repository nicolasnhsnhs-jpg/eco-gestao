import { describe, expect, it } from 'vitest'

import { tratamentoDe, trocarTratamento } from './saudacao'

describe('saudação do e-mail', () => {
  it('reconhece o tratamento', () => {
    expect(tratamentoDe('Sra. Camila - Compras')).toBe('Sra.')
    expect(tratamentoDe('sr João')).toBe('Sr.')
    expect(tratamentoDe('Senhora Ana')).toBe('Sra.')
    expect(tratamentoDe('Srta. Bia')).toBe('Sra.')
    expect(tratamentoDe('Srinivas')).toBeNull()
    expect(tratamentoDe('Mercado Bom')).toBeNull()
  })

  it('troca, coloca e tira', () => {
    expect(trocarTratamento('Sra. Camila - Compras', 'Sr.')).toBe('Sr. Camila - Compras')
    expect(trocarTratamento('Senhor Paulo', 'Sra.')).toBe('Sra. Paulo')
    expect(trocarTratamento('Mercado Bom', 'Sr.')).toBe('Sr. Mercado Bom')
    expect(trocarTratamento('Sr. Paulo', null)).toBe('Paulo')
    expect(trocarTratamento('', 'Sra.')).toBe('Sra. ')
  })
})
