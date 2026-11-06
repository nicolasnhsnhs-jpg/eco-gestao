import { describe, expect, it } from 'vitest'

import { filtrarCodigos, formatarCodigoNfse } from './codigosNfse'

import {
  calcularPisCofins,
  notaDoContrato,
  proximaNota,
  retencoes,
  somaRetencoes,
  totalRetido,
  valorPorAliquota,
  vencimentoDoContrato,
} from './notas'

describe('proximaNota', () => {
  it('avança o mês, o vencimento e a data na descrição', () => {
    expect(
      proximaNota({
        competencia: '2026-11-01',
        vencimento: '2026-12-10',
        descricao:
          'CONTROLE DE PRAGAS - MÊS REFERÊNCIA NOVEMBRO/2026 - BOLETO COM VENCIMENTO EM 10/12/2026',
      }),
    ).toEqual({
      competencia: '2026-12-01',
      vencimento: '2027-01-10',
      descricao:
        'CONTROLE DE PRAGAS - MÊS REFERÊNCIA DEZEMBRO/2026 - BOLETO COM VENCIMENTO EM 10/01/2027',
    })
  })

  it('usa o vencimento da mensalidade quando informado', () => {
    const r = proximaNota(
      {
        competencia: '2026-11-01',
        vencimento: '2026-11-30',
        descricao: 'BOLETO COM VENCIMENTO EM 30/11/2026',
      },
      '2026-12-31',
    )
    expect(r.vencimento).toBe('2026-12-31')
    expect(r.descricao).toBe('BOLETO COM VENCIMENTO EM 31/12/2026')
  })

  it('não mexe em outras datas nem sem vencimento', () => {
    const r = proximaNota({
      competencia: '2026-12-01',
      vencimento: null,
      descricao: 'IMPLANTADO EM 23/09/2026 - PAGAMENTO VIA PIX',
    })
    expect(r).toEqual({
      competencia: '2027-01-01',
      vencimento: null,
      descricao: 'IMPLANTADO EM 23/09/2026 - PAGAMENTO VIA PIX',
    })
  })
})

describe('totalRetido', () => {
  const base = {
    iss_retido: false,
    aliquota_iss: null,
    valor_servico: 1000,
    pis_cofins_retidos: false,
    tp_ret_piscofins: null,
    valor_pis: 6.5,
    valor_cofins: 30,
    valor_csll: 10,
    valor_irrf: null,
    valor_inss: null,
  }

  it('sem retenção, nada sai do valor', () => {
    expect(totalRetido(base)).toBe(0)
  })

  it('soma PIS, COFINS, CSLL, IRRF, INSS e o ISS retido', () => {
    expect(
      totalRetido({
        ...base,
        pis_cofins_retidos: true,
        valor_irrf: 15,
        valor_inss: 110,
        iss_retido: true,
        aliquota_iss: 5,
      }),
    ).toBe(221.5)
  })

  it('só entra o que o tipo de retenção diz retido (7 = COFINS e CSLL)', () => {
    expect(totalRetido({ ...base, pis_cofins_retidos: true, tp_ret_piscofins: 7 })).toBe(40)
  })

  it('IRRF 1% e PIS/COFINS/CSLL retidos sobre 2.280,00', () => {
    expect(
      totalRetido({
        ...base,
        valor_servico: 2280,
        pis_cofins_retidos: true,
        tp_ret_piscofins: 3,
        valor_pis: 14.82,
        valor_cofins: 68.4,
        valor_csll: 22.8,
        valor_irrf: 22.8,
      }),
    ).toBe(128.82)
  })

  it('discrimina cada tributo retido, e a soma bate com o total', () => {
    const nota = {
      ...base,
      valor_servico: 2280,
      pis_cofins_retidos: true,
      tp_ret_piscofins: 3,
      valor_pis: 14.82,
      valor_cofins: 68.4,
      valor_csll: 22.8,
      valor_irrf: 22.8,
      iss_retido: true,
      aliquota_iss: 5,
    }
    const r = retencoes(nota)
    expect(r).toEqual({ iss: 114, pis: 14.82, cofins: 68.4, csll: 22.8, irrf: 22.8, inss: 0 })
    expect(somaRetencoes(r)).toBe(totalRetido(nota))
    expect(somaRetencoes({ ...r, iss: 0 })).toBe(totalRetido({ ...nota, iss_retido: false }))
  })

  it('o que o tipo não retém fica zerado (7 = COFINS e CSLL, PIS não)', () => {
    expect(retencoes({ ...base, pis_cofins_retidos: true, tp_ret_piscofins: 7 })).toEqual({
      iss: 0,
      pis: 0,
      cofins: 30,
      csll: 10,
      irrf: 0,
      inss: 0,
    })
  })
})

describe('valorPorAliquota', () => {
  it('base × alíquota nos centavos', () => {
    expect(valorPorAliquota(2280, 1)).toBe(22.8)
    expect(valorPorAliquota(2280, 0.65)).toBe(14.82)
    expect(valorPorAliquota(2280, null)).toBeNull()
  })
})

describe('calcularPisCofins', () => {
  const base = { valor: 460, aliquotaPis: 0.65, aliquotaCofins: 3, cst: '', aliquotaCsll: 1 }
  it('calcula PIS, COFINS e CSLL retidos', () => {
    expect(calcularPisCofins({ ...base, tipoRetencao: 3 })).toEqual({
      pis: 2.99,
      cofins: 13.8,
      csll: 4.6,
    })
  })
  it('sem retenção não há CSLL, mas PIS e COFINS continuam destacados', () => {
    expect(calcularPisCofins({ ...base, tipoRetencao: 0 })).toEqual({
      pis: 2.99,
      cofins: 13.8,
      csll: null,
    })
  })
  it('CST sem incidência não tem PIS nem COFINS', () => {
    expect(calcularPisCofins({ ...base, cst: '08', tipoRetencao: 0 })).toEqual({
      pis: null,
      cofins: null,
      csll: null,
    })
  })
  it('arredonda nos centavos como a Sefin (398 × 0,65% = 2,59)', () => {
    expect(calcularPisCofins({ ...base, valor: 398, tipoRetencao: 3 })).toEqual({
      pis: 2.59,
      cofins: 11.94,
      csll: 3.98,
    })
  })
})

describe('vencimentoDoContrato', () => {
  it('dia do mês seguinte', () => {
    expect(vencimentoDoContrato('2026-11', { dia_vencimento: 6, vence_mes_seguinte: true })).toBe(
      '2026-12-06',
    )
  })
  it('dia 31 em mês curto vira o último dia', () => {
    expect(
      vencimentoDoContrato('2027-02-01', { dia_vencimento: 31, vence_mes_seguinte: false }),
    ).toBe('2027-02-28')
  })
  it('cobrança por dia útil: sem cálculo aqui', () => {
    expect(
      vencimentoDoContrato('2026-11', { dia_vencimento: null, vence_mes_seguinte: false }),
    ).toBeNull()
  })
})

describe('notaDoContrato', () => {
  it('boleto: põe o vencimento no fim da descrição', () => {
    expect(
      notaDoContrato(
        { descricao: 'CONTROLE DE PRAGAS ', valor_mensal: 460, forma_pagamento: 'boleto' },
        '2026-12-06',
      ),
    ).toEqual({
      valor: 460,
      descricao: 'CONTROLE DE PRAGAS - BOLETO COM VENCIMENTO EM 06/12/2026',
      forma_pagamento: 'boleto',
    })
  })
  it('pix: só a descrição do contrato', () => {
    expect(
      notaDoContrato({ descricao: 'X', valor_mensal: 100, forma_pagamento: 'pix' }, '2026-12-06')
        .descricao,
    ).toBe('X')
  })
})

describe('códigos da NFS-e', () => {
  const lista = [
    { codigo: '071301', busca: '071301 07.13.01 dedetizacao, desinfeccao' },
    { codigo: '071101', busca: '071101 07.11.01 limpeza e conservacao' },
  ]
  it('formata como no Anexo B', () => {
    expect(formatarCodigoNfse('tributacao', '071301')).toBe('07.13.01')
    expect(formatarCodigoNfse('nbs', '118032100')).toBe('1.1803.21.00')
  })
  it('acha pelo começo do código, com ou sem pontos', () => {
    expect(filtrarCodigos(lista, '07.13').map((c) => c.codigo)).toEqual(['071301'])
    expect(filtrarCodigos(lista, '0711').map((c) => c.codigo)).toEqual(['071101'])
  })
  it('acha pelas palavras, sem acento', () => {
    expect(filtrarCodigos(lista, 'Dedetização').map((c) => c.codigo)).toEqual(['071301'])
    expect(filtrarCodigos(lista, '')).toHaveLength(2)
  })
})
