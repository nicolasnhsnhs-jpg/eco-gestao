import { describe, expect, it } from 'vitest'

import { textoSeguro } from './gerarPdfOs'

describe('textoSeguro', () => {
  it('mantém os acentos do português', () => {
    expect(textoSeguro('Ação, coração, pão e Sucção')).toBe('Ação, coração, pão e Sucção')
  })

  it('troca aspas curvas, travessão e reticências por versões simples', () => {
    expect(textoSeguro('“Sifão” – trocado…')).toBe('"Sifão" - trocado...')
  })

  it('troca barras, espaços e traços especiais pelos comuns', () => {
    expect(textoSeguro('semanal \u2215 Maio')).toBe('semanal / Maio')
    expect(textoSeguro('semanal\u2044Maio')).toBe('semanal/Maio')
    expect(textoSeguro('semanal\uFF0FMaio')).toBe('semanal/Maio')
    expect(textoSeguro('semanal\u2009/\u202FMaio\u200B')).toBe('semanal / Maio')
    expect(textoSeguro('Dez\u2011Abr \u2212 2p/m²')).toBe('Dez-Abr - 2p/m²')
  })

  it('troca o que a fonte do PDF não tem (ex.: emoji) por "?"', () => {
    expect(textoSeguro('ok 👍')).toBe('ok ??')
  })
})
