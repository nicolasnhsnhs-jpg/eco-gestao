import { describe, expect, it } from 'vitest'

import { esquemaProposta, ITEM_VAZIO, totalDosItens } from './esquema'

describe('totalDosItens', () => {
  it('soma quantidade × valor sem erro de centavos', () => {
    expect(
      totalDosItens([
        { quantidade: '2', valor_unitario: '450,50' },
        { quantidade: '1', valor_unitario: '300,00' },
      ]),
    ).toBe(1201)
    expect(totalDosItens([{ quantidade: '3', valor_unitario: '0,10' }])).toBe(0.3)
  })

  it('aceita quantidade com vírgula', () => {
    expect(totalDosItens([{ quantidade: '1,5', valor_unitario: '100,00' }])).toBe(150)
  })
})

describe('esquemaProposta', () => {
  const base = {
    cliente_id: 'c1',
    cliente_nome: 'Cliente',
    endereco_id: '',
    vendedor_id: 'v1',
    data_envio: '2026-10-28',
    validade: '2026-11-12',
    prazo_pagamento_dias: '15',
    condicao_pagamento: '',
    observacoes: '',
    itens: [{ ...ITEM_VAZIO, descricao: 'Limpeza de coifa', valor_unitario: '500,00' }],
  }

  it('aceita uma proposta completa', () => {
    expect(esquemaProposta.safeParse(base).success).toBe(true)
  })

  it('exige pelo menos um item e validade depois do envio', () => {
    expect(esquemaProposta.safeParse({ ...base, itens: [] }).success).toBe(false)
    expect(esquemaProposta.safeParse({ ...base, validade: '2026-10-01' }).success).toBe(false)
  })

  it('recusa periodicidade fora de 1 a 60 meses', () => {
    const item = { ...base.itens[0], periodicidade_meses: '0' }
    expect(esquemaProposta.safeParse({ ...base, itens: [item] }).success).toBe(false)
  })
})
