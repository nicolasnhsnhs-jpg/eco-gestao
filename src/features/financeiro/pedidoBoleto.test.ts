import { describe, expect, it } from 'vitest'

import {
  boletoPago,
  montarPedidoBoleto,
  textoSicredi,
  type ConfigBoleto,
  type DadosBoleto,
} from '../../../supabase/functions/_shared/pedidoBoleto'

const cfg: ConfigBoleto = {
  codigoBeneficiario: '12345',
  tipoCobranca: 'HIBRIDO',
  especie: 'DUPLICATA_SERVICO_INDICACAO',
  multa: 2,
  jurosMes: 1,
}

const dados: DadosBoleto = {
  referencia: 'NF4372',
  valor: 1500,
  vencimento: '2026-12-05',
  pagador: {
    documento: '12.345.678/0001-90',
    nome: 'Condomínio Residencial São João das Águas Claras e Adjacências',
    logradouro: 'Avenida Presidente Getúlio Vargas',
    numero: '1234',
    cidade: 'São Leopoldo',
    uf: 'rs',
    cep: '93010-000',
    email: 'financeiro@condominio.com.br',
  },
  informativos: ['Referente a NF 4372 - competencia 11/2026'],
}

describe('montarPedidoBoleto', () => {
  it('monta o pedido no formato do Sicredi', () => {
    const p = montarPedidoBoleto(cfg, dados)
    expect(p).toMatchObject({
      tipoCobranca: 'HIBRIDO',
      codigoBeneficiario: '12345',
      especieDocumento: 'DUPLICATA_SERVICO_INDICACAO',
      seuNumero: 'NF4372',
      dataVencimento: '2026-12-05',
      valor: 1500,
      multa: 2,
      tipoJuros: 'VALOR',
      // 1% ao mês de R$ 1.500 = R$ 15/mês = R$ 0,50 por dia.
      juros: 0.5,
      informativos: ['Referente a NF 4372 - competencia 11/2026'],
    })
    expect(p.pagador).toEqual({
      tipoPessoa: 'PESSOA_JURIDICA',
      documento: '12345678000190',
      nome: 'Condominio Residencial Sao Joao das Agua',
      endereco: 'Avenida Presidente Getulio Vargas, 1234',
      cidade: 'Sao Leopoldo',
      uf: 'RS',
      cep: '93010000',
      email: 'financeiro@condominio.com.br',
    })
  })

  it('respeita os tamanhos do Sicredi', () => {
    const p = montarPedidoBoleto(cfg, dados) as { pagador: Record<string, string> }
    expect(p.pagador.nome.length).toBeLessThanOrEqual(40)
    expect(p.pagador.cidade.length).toBeLessThanOrEqual(25)
  })

  it('pessoa física, sem multa nem juros e sem endereço', () => {
    const p = montarPedidoBoleto(
      { ...cfg, multa: 0, jurosMes: 0 },
      {
        ...dados,
        pagador: {
          ...dados.pagador,
          documento: '123.456.789-09',
          logradouro: null,
          numero: null,
          cidade: null,
          uf: null,
          cep: null,
          email: null,
        },
      },
    )
    expect(p.pagador).toEqual({
      tipoPessoa: 'PESSOA_FISICA',
      documento: '12345678909',
      nome: 'Condominio Residencial Sao Joao das Agua',
    })
    expect(p).not.toHaveProperty('multa')
    expect(p).not.toHaveProperty('juros')
  })

  it('juros abaixo de 1 centavo por dia não vão (o Sicredi recusa)', () => {
    const p = montarPedidoBoleto(cfg, { ...dados, valor: 10 })
    expect(p).not.toHaveProperty('juros')
  })

  it('recusa sem CPF/CNPJ ou com valor zero', () => {
    expect(() =>
      montarPedidoBoleto(cfg, { ...dados, pagador: { ...dados.pagador, documento: '' } }),
    ).toThrow(/CPF\/CNPJ/)
    expect(() => montarPedidoBoleto(cfg, { ...dados, valor: 0 })).toThrow(/maior que zero/)
  })
})

describe('textoSicredi e situação', () => {
  it('tira acentos e símbolos', () => {
    expect(textoSicredi('Ação & Cia — Ltda.', 40)).toBe('Acao Cia Ltda.')
  })

  it('reconhece boleto pago', () => {
    expect(boletoPago('LIQUIDADO PIX')).toBe(true)
    expect(boletoPago('LIQUIDADO')).toBe(true)
    expect(boletoPago('EM CARTEIRA')).toBe(false)
    expect(boletoPago(null)).toBe(false)
  })
})
