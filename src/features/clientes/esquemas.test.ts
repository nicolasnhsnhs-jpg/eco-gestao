import { describe, expect, it } from 'vitest'

import { CLIENTE_VAZIO, clienteParaBanco } from './esquemas'

describe('vários e-mails e telefones', () => {
  it('o primeiro preenchido vira o principal; vazios e repetidos saem', () => {
    const b = clienteParaBanco({
      ...CLIENTE_VAZIO,
      nome: 'Solar',
      email: '',
      emails_extras: [
        { valor: 'Fiscal@Solar.com' },
        { valor: '' },
        { valor: 'fiscal@solar.com' },
        { valor: 'compras@solar.com' },
      ],
      telefone: '(48) 3222-1234',
      telefones_extras: [{ valor: '(48) 99999-8888' }],
    })
    expect(b.email).toBe('fiscal@solar.com')
    expect(b.emails_extras).toEqual(['compras@solar.com'])
    expect(b.telefone).toBe('4832221234')
    expect(b.telefones_extras).toEqual(['48999998888'])
  })

  it('sem nada fica nulo e lista vazia', () => {
    const b = clienteParaBanco({ ...CLIENTE_VAZIO, nome: 'Solar' })
    expect([b.email, b.emails_extras, b.telefone, b.telefones_extras]).toEqual([null, [], null, []])
  })
})
