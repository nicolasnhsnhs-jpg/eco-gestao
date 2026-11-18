import { describe, expect, it } from 'vitest'

import { filtrosParaLevar, textoFiltrosParaLevar } from './bebedouro'

describe('filtrosParaLevar', () => {
  it('soma os bebedouros por código de filtro e ignora os sem código', () => {
    const filtros = filtrosParaLevar([
      { tipo: 'bebedouro', codigo_filtro: '1019' },
      { tipo: 'bebedouro', codigo_filtro: ' 1144 ' },
      { tipo: 'bebedouro_garrafao', codigo_filtro: '1019' },
      { tipo: 'bebedouro', codigo_filtro: null },
      { tipo: 'bebedouro', codigo_filtro: '' },
      { tipo: 'coifa', codigo_filtro: '1019' },
    ])
    expect(filtros).toEqual([
      { codigo: '1019', quantidade: 2 },
      { codigo: '1144', quantidade: 1 },
    ])
    expect(textoFiltrosParaLevar(filtros)).toBe('2× 1019 · 1× 1144')
  })

  it('não separa o mesmo código escrito com maiúscula ou minúscula', () => {
    expect(
      filtrosParaLevar([
        { tipo: 'bebedouro', codigo_filtro: 'Soft Flow WFS 042' },
        { tipo: 'bebedouro', codigo_filtro: 'soft flow wfs 042' },
      ]),
    ).toEqual([{ codigo: 'Soft Flow WFS 042', quantidade: 2 }])
  })
})
