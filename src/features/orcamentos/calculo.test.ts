import { describe, expect, it } from 'vitest'

import { calcularOrcamento, lerNumero, SERVICOS, type Custos, type DadosOrcamento } from './calculo'

const desinsetizacao = SERVICOS.find((s) => s.id === 'desinsetizacao')!

const custos: Custos = {
  'geral.km_carro': 1.5,
  'geral.km_caminhao': 4,
  'geral.hora_tecnico': 30,
  'geral.velocidade': 60,
  'geral.administrativo': 20,
  'geral.impostos': 10,
  'geral.comissao': 10,
  'desinsetizacao.produto_m2': 0.5,
  'desinsetizacao.material_visita': 10,
  'desinsetizacao.margem_minima': 20,
  'desinsetizacao.margem_ideal': 30,
  'desinsetizacao.margem_maxima': 40,
}

const dados: DadosOrcamento = {
  distancia: 30,
  tecnicos: 2,
  horas: 2,
  extras: 0,
  veiculo: 'carro',
  valores: { area: 200 },
}

describe('calcularOrcamento', () => {
  it('dobra a distância e cobra km, mão de obra (com estrada) e itens do serviço', () => {
    const r = calcularOrcamento(desinsetizacao, custos, dados)
    expect(r.kmTotal).toBe(60)
    // 60 km × 1,50 = 90 | 2 téc × (2 h + 1 h de estrada) × 30 = 180 | 200 m² × 0,50 = 100 | 10 | 20
    expect(r.linhas.map((l) => l.valor)).toEqual([90, 180, 100, 10, 20])
    expect(r.custoTotal).toBe(400)
    expect(r.faltando).toEqual([])
  })

  it('dá os três preços: a margem é lucro sobre o preço, depois de impostos e comissão', () => {
    const r = calcularOrcamento(desinsetizacao, custos, dados)
    // 400 ÷ (1 − 0,20 − 0,20) = 666,67
    expect(r.minimo?.preco).toBe(666.67)
    expect(r.ideal?.preco).toBe(800)
    expect(r.ideal?.lucro).toBe(240)
    expect(r.maximo?.preco).toBe(1000)
  })

  it('usa o custo do caminhão quando o serviço vai de caminhão', () => {
    const r = calcularOrcamento(desinsetizacao, custos, { ...dados, veiculo: 'caminhao' })
    expect(r.linhas[0].valor).toBe(240)
  })

  it('custos em branco contam como zero e aparecem na lista do que falta', () => {
    const r = calcularOrcamento(desinsetizacao, {}, dados)
    expect(r.custoTotal).toBe(0)
    expect(r.minimo).toBeNull()
    expect(r.faltando).toContain('Custo da hora de um técnico')
    expect(r.faltando).toContain('Produto por m² (Desinsetização)')
    expect(r.faltando).toContain('Margem ideal (Desinsetização)')
  })

  it('não dá preço quando impostos + comissão + margem chegam a 100%', () => {
    const r = calcularOrcamento(
      desinsetizacao,
      { ...custos, 'desinsetizacao.margem_maxima': 80 },
      dados,
    )
    expect(r.maximo).toBeNull()
  })
})

describe('lerNumero', () => {
  it('aceita vírgula ou ponto e recusa texto', () => {
    expect(lerNumero('1.234,5')).toBe(1234.5)
    expect(lerNumero('0.75')).toBe(0.75)
    expect(lerNumero('12')).toBe(12)
    expect(lerNumero('')).toBeNull()
    expect(lerNumero('abc')).toBeNull()
  })
})
