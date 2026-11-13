import { describe, expect, it } from 'vitest'

import {
  textoPagamento,
  ehCartao,
  ehPix,
  MODELOS,
  recursosDoModelo,
  separarFrequencia,
  tituloComFrequencia,
  valorFrequencia,
} from '../modelos'
import { montarDadosPdf, valorAnualDosItens, type ItemBase, type PropostaBase } from './dadosPdf'

const item = (x: Partial<ItemBase>): ItemBase => ({
  modelo: null,
  titulo: null,
  escopo: null,
  metodologia: null,
  recursos: null,
  descricao: 'Serviço',
  quantidade: 1,
  valor_unitario: 0,
  periodicidade_meses: null,
  frequencia: null,
  cobranca: 'unica',
  ...x,
})

const base = (x: Partial<PropostaBase> = {}): PropostaBase => ({
  numero: '2026-0010',
  data_envio: '2026-11-09',
  validade: '2026-11-24',
  contato_nome: 'Sr. William',
  contato_telefone: null,
  contato_email: null,
  introducao: null,
  acrescimo_fora_horario: 480,
  custos_detalhados: true,
  prazo_pagamento_dias: 28,
  condicao_pagamento: 'boleto bancário',
  cartao_parcelas: null,
  cartao_juros: null,
  observacoes: null,
  itens: [],
  ...x,
})

const cliente = {
  nome: 'CONSERVAS ODERICH S/A',
  nome_fantasia: 'Oderich',
  cpf_cnpj: '97191902000780',
  tipo_pessoa: 'PJ',
  email: 'compras@oderich.com.br',
  telefone: '5121230900',
  enderecos: [
    {
      id: 'e1',
      logradouro: 'Rod. BR 116, Km 287',
      numero: '4150',
      complemento: null,
      bairro: 'Itaí',
      cidade: 'Eldorado do Sul',
      uf: 'RS',
      cep: '92990000',
      razao_social: null,
      cnpj: null,
      principal: true,
    },
  ],
}

const vendedor = { nome: 'Nicolas Hernandes', telefone: '(51) 99234-1221', email: null }

describe('montarDadosPdf', () => {
  it('monta uma proposta de um serviço só (coifa)', () => {
    const m = MODELOS.coifa
    const d = montarDadosPdf(
      base({
        itens: [
          item({
            modelo: 'coifa',
            titulo: m.titulo,
            escopo: m.escopo,
            metodologia: m.metodologia,
            recursos: recursosDoModelo(m),
            descricao: 'Limpeza das coifas',
            valor_unitario: 2680,
            periodicidade_meses: 6,
          }),
        ],
      }),
      cliente,
      null,
      vendedor,
    )
    expect(d.rascunho).toBe(false)
    expect(d.cliente.linhas).toContain('CNPJ: 97.191.902/0007-80')
    expect(d.cliente.linhas).toContain('A/C: Sr. William')
    expect(d.cliente.linhas).toContain('E-mail: compras@oderich.com.br')
    expect(d.itens[0].titulo).toBe('Serviço de limpeza de coifa / Semestral')
    expect(d.introducao).toContain('**Oderich**')
    expect(d.introducao).toContain('de limpeza de coifa')
    const custos = d.custos.map((c) => c.texto).join('\n')
    expect(custos).toContain('R$ 2.680,00 (dois mil, seiscentos e oitenta reais)')
    expect(custos).toContain('**28 dias** boleto bancário')
    expect(custos).toContain('acréscimo de **R$ 480,00**')
    expect(custos).toContain('Proposta válida até **24/11/2026**')
  })

  it('junta vários serviços sem repetir recursos e soma o total', () => {
    const pragas = MODELOS.pragas
    const agua = MODELOS.reservatorio
    const d = montarDadosPdf(
      base({
        itens: [
          item({
            modelo: 'pragas',
            titulo: pragas.titulo,
            metodologia: pragas.metodologia,
            recursos: recursosDoModelo(pragas),
            descricao: 'Desinsetização, desratização',
            valor_unitario: 950,
          }),
          item({
            modelo: 'reservatorio',
            titulo: agua.titulo,
            recursos: recursosDoModelo(agua) + '\nMão de obra especializada;',
            descricao: "Limpeza de caixas d'água: 4 unidades de 5.000 litros",
            valor_unitario: 990,
          }),
        ],
      }),
      cliente,
      'e1',
      vendedor,
    )
    expect(d.itens.map((i) => i.titulo)).toEqual([
      'Serviço de controle de pragas urbanas / Avulso',
      'Serviço de controle de potabilidade da água / Avulso',
    ])
    // A linha curta some: a longa ("Mão de obra especializada com técnicos…") já diz isso.
    expect(d.recursos.filter((l) => l.startsWith('Mão de obra especializada'))).toHaveLength(1)
    expect(d.recursos.filter((l) => l.startsWith('Execução do serviço'))).toHaveLength(1)
    expect(
      d.recursos.filter((l) => l.startsWith('Responsável técnica')).length,
    ).toBeLessThanOrEqual(1)
    const custos = d.custos.map((c) => c.texto)
    expect(custos.filter((c) => c.includes('R$ 950,00'))).toHaveLength(1)
    expect(custos.join('\n')).toContain('R$ 1.940,00 (mil, novecentos e quarenta reais)')
  })

  it('mostra só o total quando pedido, com valor mensal', () => {
    const d = montarDadosPdf(
      base({
        numero: null,
        custos_detalhados: false,
        acrescimo_fora_horario: null,
        itens: [
          item({ descricao: 'Desratização', valor_unitario: 1058, cobranca: 'mensal' }),
          item({ descricao: 'Desinsetização', valor_unitario: 1494, cobranca: 'mensal' }),
        ],
      }),
      cliente,
      null,
      vendedor,
    )
    expect(d.rascunho).toBe(true)
    const custos = d.custos.map((c) => c.texto).join('\n')
    expect(custos).not.toContain('R$ 1.058,00')
    expect(custos).toContain('R$ 2.552,00')
    expect(custos).toContain('mensais')
    expect(custos).not.toContain('acréscimo')
  })

  it('mostra as taxas adicionais e soma no total', () => {
    const d = montarDadosPdf(
      base({
        itens: [
          item({
            descricao: 'Limpeza de coifa',
            valor_unitario: 500,
            taxas_adicionais: [{ descricao: 'Adicional para trabalho ao domingo', valor: 150 }],
          }),
        ],
      }),
      cliente,
      null,
      vendedor,
    )
    const custos = d.custos.map((c) => c.texto).join('\n')
    expect(custos).toContain('Limpeza de coifa - **R$ 500,00**')
    expect(custos).toContain('Adicional para trabalho ao domingo - **R$ 150,00**')
    expect(custos).toContain('R$ 650,00 (seiscentos e cinquenta reais)')
  })

  it('só o total, já com as taxas, quando não detalha', () => {
    const d = montarDadosPdf(
      base({
        custos_detalhados: false,
        itens: [
          item({
            descricao: 'Limpeza de coifa',
            valor_unitario: 500,
            taxas_adicionais: [{ descricao: 'Adicional noturno', valor: 100 }],
          }),
        ],
      }),
      cliente,
      null,
      vendedor,
    )
    const custos = d.custos.map((c) => c.texto).join('\n')
    expect(custos).not.toContain('Adicional noturno')
    expect(custos).toContain('R$ 600,00')
  })

  it('não repete a frequência no título', () => {
    expect(tituloComFrequencia('Limpeza de coifa / semestral', 6)).toBe(
      'Limpeza de coifa / semestral',
    )
    expect(tituloComFrequencia('Desratização', 1)).toBe('Desratização / Mensal')
  })

  it('aceita frequência semanal e quinzenal', () => {
    const d = montarDadosPdf(
      base({
        itens: [
          item({ modelo: 'pragas', titulo: 'Controle de pragas', frequencia: 'quinzenal' }),
          item({ modelo: 'ralos', titulo: 'Limpeza de ralos', frequencia: 'semanal' }),
        ],
      }),
      cliente,
      null,
      vendedor,
    )
    expect(d.itens.map((i) => i.titulo)).toEqual([
      'Controle de pragas / Quinzenal',
      'Limpeza de ralos / Semanal',
    ])
    expect(separarFrequencia('quinzenal')).toEqual({
      periodicidade_meses: null,
      frequencia: 'quinzenal',
    })
    expect(separarFrequencia('6')).toEqual({ periodicidade_meses: 6, frequencia: null })
    expect(separarFrequencia('')).toEqual({ periodicidade_meses: null, frequencia: null })
    expect(valorFrequencia(null, 'semanal')).toBe('semanal')
    expect(valorFrequencia(3, null)).toBe('3')
  })

  it('proposta de contrato: valor anual, o que contempla e as parcelas', () => {
    const itens = [
      item({ descricao: 'Limpeza de reservatórios', valor_unitario: 600, periodicidade_meses: 6 }),
      item({ descricao: 'Controle de pragas', valor_unitario: 200, cobranca: 'mensal' }),
    ]
    // 600 × 2 (semestral) + 200 × 12 (por mês)
    expect(valorAnualDosItens(itens)).toBe(3600)

    const d = montarDadosPdf(
      base({ tipo: 'contrato', contrato_valor_anual: 6000, contrato_parcelas: 12, itens }),
      cliente,
      null,
      vendedor,
    )
    const textos = d.custos.map((c) => c.texto)
    expect(textos[0]).toContain('Valor anual do contrato: **R$ 6.000,00')
    expect(textos).toContain('Limpeza de reservatórios - semestral - **R$ 600,00**')
    expect(textos.some((t) => t.includes('**12 parcelas mensais de R$ 500,00'))).toBe(true)
    expect(textos.some((t) => t.includes('28 dias'))).toBe(false)

    const semValor = montarDadosPdf(
      base({ tipo: 'contrato', contrato_parcelas: 10, custos_detalhados: false, itens }),
      cliente,
      null,
      vendedor,
    )
    const t2 = semValor.custos.map((c) => c.texto)
    expect(t2[0]).toContain('R$ 3.600,00')
    expect(t2).toContain('Controle de pragas')
    expect(t2.some((t) => t.includes('10 parcelas mensais de R$ 360,00'))).toBe(true)
  })

  it('contrato completo: memorial com o texto de cada serviço, seções fixas e investimento', () => {
    const d = montarDadosPdf(
      base({
        tipo: 'contrato',
        contrato_modelo: 'completo',
        contrato_parcelas: 12,
        introducao: null,
        itens: [
          item({
            modelo: 'pragas',
            titulo: 'Controle integrado de pragas urbanas',
            descricao: 'Controle de pragas urbanas',
            escopo: 'Galpões 1, 2 e 3, almoxarifado e vestiários.',
            frequencia: 'quinzenal',
            cobranca: 'mensal',
            valor_unitario: 1890,
          }),
          item({
            modelo: 'reservatorio',
            titulo: 'Limpeza de reservatórios',
            descricao: "Limpeza e desinfecção de caixas d'água",
            escopo: '02 reservatórios de 20m³.',
            periodicidade_meses: 6,
            cobranca: 'mensal',
            valor_unitario: 290,
          }),
        ],
      }),
      cliente,
      null,
      vendedor,
    )
    expect(d.rotuloNumero).toBe('MEMORIAL DESCRITIVO Nº')
    expect(d.tituloCustos).toBe('Investimento')
    expect(d.introducao).toContain('Conforme combinado com V.S.ª')
    expect(d.itens.map((i) => i.titulo)).toEqual([
      'Controle integrado de pragas urbanas / Quinzenal',
      'Limpeza de reservatórios / Semestral',
      'Atendimento',
      'Corpo técnico',
      'Serviços especializados',
    ])
    const pragas = d.itens[0].escopo
    expect(pragas).toContain('**Roedores / atendimento QUINZENAL**')
    expect(pragas).toContain('Galpões 1, 2 e 3')
    expect(pragas).toContain('nas áreas da Oderich')
    expect(pragas).not.toMatch(/\{\w+\}/)
    expect(d.itens[1].escopo.startsWith('02 reservatórios de 20m³.')).toBe(true)
    expect(d.itens[2].escopo).toContain('visitas operacionais QUINZENAL')
    expect(d.metodologia).toEqual([])
    expect(d.recursos).toEqual([])

    const textos = d.custos.map((c) => c.texto)
    expect(textos[0]).toContain('**12 (doze) meses**')
    expect(textos).toContain(
      '**Valor mensal dos serviços de controle de pragas urbanas / quinzenal:**',
    )
    expect(textos.some((t) => /^R\$ 1\.890,00 \(.+\), mensais\.$/.test(t))).toBe(true)
    expect(textos).toContain('**Totalizando o valor mensal de R$ 2.180,00.**')
    expect(textos.some((t) => t.includes('taxa adicional no valor de R$ 480,00 por chamado'))).toBe(
      true,
    )
  })
})

describe('forma de pagamento no cartão', () => {
  it('parcelas e juros vão junto do cartão', () => {
    expect(textoPagamento(null, 'cartão de crédito', { parcelas: 3, juros: false })).toBe(
      'cartão de crédito em **3x sem juros**',
    )
    expect(textoPagamento(null, 'Cartão de crédito', { parcelas: 6, juros: true })).toBe(
      'Cartão de crédito em **6x com juros**',
    )
    expect(textoPagamento(null, 'cartão de crédito', { parcelas: 1, juros: null })).toBe(
      'cartão de crédito **à vista**',
    )
  })
  it('sem prazo no PIX; boleto não leva parcelas', () => {
    expect(textoPagamento(null, 'PIX')).toBe('PIX')
    expect(textoPagamento(28, 'boleto bancário', { parcelas: 3, juros: false })).toBe(
      '**28 dias** boleto bancário',
    )
  })
  it('o PDF da proposta avulsa mostra o cartão', () => {
    const d = montarDadosPdf(
      base({
        prazo_pagamento_dias: null,
        condicao_pagamento: 'cartão de crédito',
        cartao_parcelas: 4,
        cartao_juros: false,
        itens: [item({ descricao: 'Desinsetização', valor_unitario: 400 })],
      }),
      cliente,
      null,
      vendedor,
    )
    expect(JSON.stringify(d)).toContain(
      'Forma de pagamento: cartão de crédito em **4x sem juros**.',
    )
  })
})

describe('ehPix / ehCartao', () => {
  it('reconhece a forma escrita', () => {
    expect(ehPix('PIX')).toBe(true)
    expect(ehPix('pix ou boleto')).toBe(true)
    expect(ehPix('boleto bancário')).toBe(false)
    expect(ehCartao('Cartão de crédito')).toBe(true)
  })
})
