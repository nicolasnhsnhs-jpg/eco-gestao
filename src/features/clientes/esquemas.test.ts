import { describe, expect, it } from 'vitest'

import { CLIENTE_VAZIO, clienteParaBanco, esquemaCliente } from './esquemas'

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

describe('e-mails do financeiro separados', () => {
  it('marcado: guarda a lista sem vazios e repetidos', () => {
    const b = clienteParaBanco({
      ...CLIENTE_VAZIO,
      nome: 'Solar',
      email: 'qualidade@solar.com',
      separar_financeiro: true,
      emails_financeiro: [{ valor: 'NF@Solar.com' }, { valor: '' }, { valor: 'nf@solar.com' }],
    })
    expect(b.email).toBe('qualidade@solar.com')
    expect(b.emails_financeiro).toEqual(['nf@solar.com'])
  })

  it('desmarcado: a lista some, mesmo com algo digitado', () => {
    const b = clienteParaBanco({
      ...CLIENTE_VAZIO,
      nome: 'Solar',
      separar_financeiro: false,
      emails_financeiro: [{ valor: 'nf@solar.com' }],
    })
    expect(b.emails_financeiro).toEqual([])
  })

  it('marcado sem e-mail não deixa salvar', () => {
    const r = esquemaCliente.safeParse({
      ...CLIENTE_VAZIO,
      nome: 'Solar',
      separar_financeiro: true,
      emails_financeiro: [{ valor: '' }],
    })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['emails_financeiro'])
  })
})
