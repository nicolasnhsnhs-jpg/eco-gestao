import { describe, expect, it } from 'vitest'

import { calcularPisCofins, proximaNota, totalRetido } from './notas'

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
})

describe('calcularPisCofins', () => {
  const base = { valor: 460, aliquotaPis: 0.65, aliquotaCofins: 3, cst: '', aliquotaCsll: 1 }
  it('calcula PIS, COFINS e CSLL retidos', () => {
    expect(calcularPisCofins({ ...base, retidos: true })).toEqual({
      pis: 2.99,
      cofins: 13.8,
      csll: 4.6,
    })
  })
  it('sem retenção não há CSLL, mas PIS e COFINS continuam destacados', () => {
    expect(calcularPisCofins({ ...base, retidos: false })).toEqual({
      pis: 2.99,
      cofins: 13.8,
      csll: null,
    })
  })
  it('CST sem incidência não tem PIS nem COFINS', () => {
    expect(calcularPisCofins({ ...base, cst: '08', retidos: false })).toEqual({
      pis: null,
      cofins: null,
      csll: null,
    })
  })
  it('arredonda nos centavos como a Sefin (398 × 0,65% = 2,59)', () => {
    expect(calcularPisCofins({ ...base, valor: 398, retidos: true })).toEqual({
      pis: 2.59,
      cofins: 11.94,
      csll: 3.98,
    })
  })
})
