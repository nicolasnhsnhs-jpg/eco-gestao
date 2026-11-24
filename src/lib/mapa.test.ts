import { describe, expect, it } from 'vitest'

import { enderecoParaMapa, linkRotaMapa } from './mapa'

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

  it('sem número, bairro nem CEP', () => {
    expect(
      enderecoParaMapa({ logradouro: 'Estrada X', cidade: 'Vacaria', uf: 'RS', cep: '123' }),
    ).toBe('Estrada X, Vacaria - RS, Brasil')
    expect(linkRotaMapa({ logradouro: 'A', cidade: 'B', uf: 'SC' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=A%2C%20B%20-%20SC%2C%20Brasil',
    )
  })
})
