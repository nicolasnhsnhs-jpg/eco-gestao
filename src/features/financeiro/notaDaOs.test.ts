import { describe, expect, it } from 'vitest'

import {
  descricaoDaOs,
  formaDaProposta,
  valorDaOs,
  vencimentoDaProposta,
  type OsParaNota,
  type PropostaDaOs,
} from './notaDaOs'

const proposta: PropostaDaOs = {
  id: 'p1',
  numero: '2026/045',
  valor_total: 1500,
  prazo_pagamento_dias: 21,
  prazos_pagamento: null,
  condicao_pagamento: 'boleto bancário',
  itens: [
    {
      id: 'b',
      ordem: 2,
      descricao: "Limpeza de caixa d'água",
      quantidade: 1,
      valor_unitario: 600,
      tipo_servico_id: 'caixa',
    },
    {
      id: 'a',
      ordem: 1,
      descricao: '**Desinsetização**;',
      quantidade: 2,
      valor_unitario: 450,
      tipo_servico_id: 'pragas',
    },
  ],
}

const os: OsParaNota = {
  numero: 'OS-2026-0123',
  data_agendada: '2026-11-20',
  tipo_servico_id: 'pragas',
  proposta,
  pedidoCompra: null,
}

describe('nota a partir da OS', () => {
  it('valor: só os itens do serviço da OS; sem item do serviço, o total', () => {
    expect(valorDaOs(os)).toBe(900)
    expect(valorDaOs({ ...os, tipo_servico_id: 'outro' })).toBe(1500)
    expect(valorDaOs({ ...os, proposta: null })).toBeNull()
  })

  it('descrição com serviço, data, OS, proposta e pedido de compra', () => {
    expect(descricaoDaOs(os)).toBe(
      'Desinsetização. Serviço realizado em 20/11/2026 (OS-2026-0123), conforme proposta nº 2026/045.',
    )
    expect(descricaoDaOs({ ...os, pedidoCompra: ' 4500123 ' })).toMatch(
      /Pedido de compra nº 4500123\.$/,
    )
  })

  it('serviço adicional soma no valor e vai na descrição', () => {
    const comAdicional = {
      ...os,
      adicional: { descricao: 'Limpeza da caixa de gordura', valor: 250.5 },
    }
    expect(valorDaOs(comAdicional)).toBe(1150.5)
    expect(descricaoDaOs(comAdicional)).toMatch(
      /2026\/045\. Serviço adicional: Limpeza da caixa de gordura\.$/,
    )
    expect(valorDaOs({ ...comAdicional, proposta: null })).toBe(250.5)
  })

  it('vencimento pelo primeiro prazo da proposta, senão 10 dias', () => {
    expect(vencimentoDaProposta(proposta, '2026-11-23')).toBe('2026-12-14')
    expect(vencimentoDaProposta({ ...proposta, prazos_pagamento: [28, 56] }, '2026-11-23')).toBe(
      '2026-12-21',
    )
    expect(vencimentoDaProposta(null, '2026-11-23')).toBe('2026-12-03')
  })

  it('forma de pagamento pelo texto da proposta', () => {
    expect(formaDaProposta('PIX')).toBe('pix')
    expect(formaDaProposta('cartão de crédito')).toBe('cartao')
    expect(formaDaProposta('depósito em conta')).toBe('transferencia')
    expect(formaDaProposta(null)).toBe('boleto')
  })
})
