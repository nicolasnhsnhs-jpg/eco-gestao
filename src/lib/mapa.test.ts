import { describe, expect, it } from 'vitest'

import { enderecoParaMapa, linkGps, linkRotaMapa } from './mapa'

describe('endereço para o GPS', () => {
  it('vai com bairro, cidade, CEP e sem complemento', () => {
    expect(
      enderecoParaMapa({
        logradouro: 'Rua Dorival Cândido Luz de Oliveira',
        numero: '1200',
        bairro: 'São Vicente',
        cidade: 'Gravataí',
        uf: 'RS',
        cep: '94045390',
      }),
    ).toBe(
      'Rua Dorival Cândido Luz de Oliveira, 1200 - São Vicente, Gravataí - RS, 94045-390, Brasil',
    )
  })

  it('não repete o número que já está na rua', () => {
    expect(
      enderecoParaMapa({
        logradouro: 'RODOVIA RSC-453 2780 QUILOMETRO 3,5',
        numero: '2780',
        bairro: 'CIDADE NOVA',
        cidade: 'CAXIAS DO SUL',
        uf: 'RS',
        cep: '95110900',
      }),
    ).toBe(
      'RODOVIA RSC-453 2780 QUILOMETRO 3,5 - CIDADE NOVA, CAXIAS DO SUL - RS, 95110-900, Brasil',
    )
    expect(
      enderecoParaMapa({ logradouro: 'Rua 12780', numero: '2780', cidade: 'X', uf: 'RS' }),
    ).toBe('Rua 12780, 2780, X - RS, Brasil')
  })

  it('sem número, bairro nem CEP', () => {
    expect(
      enderecoParaMapa({ logradouro: 'Estrada X', cidade: 'Vacaria', uf: 'RS', cep: '123' }),
    ).toBe('Estrada X, Vacaria - RS, Brasil')
    expect(linkRotaMapa({ logradouro: 'A', cidade: 'B', uf: 'SC' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=A%2C%20B%20-%20SC%2C%20Brasil',
    )
  })
})

describe('linkGps', () => {
  const e = { logradouro: 'Rua A', numero: '10', cidade: 'Gravataí', uf: 'RS' }
  it('no Android abre o app de mapas do técnico; no iPhone, a rota do Google Maps', () => {
    expect(linkGps(e, 'Mozilla/5.0 (Linux; Android 14)')).toBe(
      'geo:0,0?q=' + encodeURIComponent('Rua A, 10, Gravataí - RS, Brasil'),
    )
    expect(linkGps(e, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)')).toBe(linkRotaMapa(e))
  })
})
