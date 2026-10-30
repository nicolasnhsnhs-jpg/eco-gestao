import { describe, expect, it } from 'vitest'

import { textoSeguro } from './gerarPdfOs'

describe('textoSeguro', () => {
  it('mantém os acentos do português', () => {
    expect(textoSeguro('Ação, coração, pão e Sucção')).toBe('Ação, coração, pão e Sucção')
  })

  it('troca aspas curvas, travessão e reticências por versões simples', () => {
    expect(textoSeguro('“Sifão” – trocado…')).toBe('"Sifão" - trocado...')
  })

  it('troca o que a fonte do PDF não tem (ex.: emoji) por "?"', () => {
    expect(textoSeguro('ok 👍')).toBe('ok ??')
  })
})
