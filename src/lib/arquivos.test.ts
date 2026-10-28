import { describe, expect, it } from 'vitest'

import { formatarTamanho, nomeSeguro } from './arquivos'

describe('nomeSeguro', () => {
  it('tira acentos, espaços e símbolos, mantendo a extensão', () => {
    expect(nomeSeguro('Proposta Nº 12 (final).PDF')).toBe('proposta-n-12-final.pdf')
    expect(nomeSeguro('Certificado coifa – São José.jpeg')).toBe('certificado-coifa-sao-jose.jpeg')
  })

  it('funciona sem extensão e com nome vazio', () => {
    expect(nomeSeguro('contrato')).toBe('contrato')
    expect(nomeSeguro('###.pdf')).toBe('arquivo.pdf')
  })
})

describe('formatarTamanho', () => {
  it('mostra o tamanho de um jeito legível', () => {
    expect(formatarTamanho(500)).toBe('500 B')
    expect(formatarTamanho(250 * 1024)).toBe('250 KB')
    expect(formatarTamanho(1.5 * 1024 * 1024)).toBe('1,5 MB')
  })
})
