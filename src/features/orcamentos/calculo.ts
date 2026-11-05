/**
 * Calculadora de orçamentos.
 *
 * Cada serviço tem os seus itens de custo (preenchidos pelo Admin na aba "Custos") e o que
 * o vendedor informa (área, volume, quantidade...). A conta é sempre a mesma:
 *
 *   custo = deslocamento (ida e volta) + mão de obra (no local + na estrada)
 *         + itens do serviço + custo administrativo + extras (pedágio, estacionamento)
 *
 *   preço = custo ÷ (1 − (impostos + comissão + margem))
 *
 * Ou seja, a margem é o lucro sobre o preço de venda: com 30% de margem, 30% do valor
 * cobrado sobra como lucro depois de pagar custos, impostos e comissão.
 */

export type Veiculo = 'carro' | 'caminhao'

export const NOME_VEICULO: Record<Veiculo, string> = { carro: 'Carro', caminhao: 'Caminhão' }

/** O que o vendedor informa na calculadora. */
export type Entrada = { id: string; rotulo: string; unidade: string; padrao?: number }

/**
 * Um custo que o Admin preenche. Com `por`, é multiplicado por aquela entrada
 * (ex.: R$ por m² × área); sem `por`, é cobrado uma vez por serviço.
 */
export type ItemCusto = { id: string; rotulo: string; unidade: string; por?: string }

export type ServicoOrcamento = {
  id: string
  nome: string
  veiculo: Veiculo
  entradas: Entrada[]
  custos: ItemCusto[]
}

/** Custos que valem para todos os serviços (chave "geral.<id>"). */
export const CUSTOS_GERAIS = [
  { id: 'km_carro', rotulo: 'Custo por km rodado — carro', unidade: 'R$/km' },
  { id: 'km_caminhao', rotulo: 'Custo por km rodado — caminhão', unidade: 'R$/km' },
  { id: 'hora_tecnico', rotulo: 'Custo da hora de um técnico', unidade: 'R$/h' },
  { id: 'velocidade', rotulo: 'Velocidade média na estrada', unidade: 'km/h' },
  { id: 'administrativo', rotulo: 'Custo administrativo por serviço', unidade: 'R$' },
  { id: 'impostos', rotulo: 'Impostos sobre a nota', unidade: '%' },
  { id: 'comissao', rotulo: 'Comissão do vendedor', unidade: '%' },
] as const

export const DICA_GERAL: Record<string, string> = {
  km_carro: 'Combustível, pneus e manutenção, dividido pelos km rodados.',
  km_caminhao: 'Combustível, pneus e manutenção, dividido pelos km rodados.',
  hora_tecnico: 'Salário + encargos + benefícios, dividido pelas horas trabalhadas no mês.',
  velocidade: 'Usada para cobrar o tempo de estrada da equipe. Em branco, não cobra.',
  administrativo: 'Escritório, sistema, telefone etc. rateado por serviço.',
}

export const MARGENS = [
  { id: 'margem_minima', rotulo: 'Margem mínima' },
  { id: 'margem_ideal', rotulo: 'Margem ideal' },
  { id: 'margem_maxima', rotulo: 'Margem máxima' },
] as const

const EPI = { id: 'material_visita', rotulo: 'Material e EPI por visita', unidade: 'R$' }

export const SERVICOS: readonly ServicoOrcamento[] = [
  {
    id: 'desinsetizacao',
    nome: 'Desinsetização',
    veiculo: 'carro',
    entradas: [{ id: 'area', rotulo: 'Área tratada', unidade: 'm²' }],
    custos: [{ id: 'produto_m2', rotulo: 'Produto por m²', unidade: 'R$/m²', por: 'area' }, EPI],
  },
  {
    id: 'desratizacao',
    nome: 'Desratização',
    veiculo: 'carro',
    entradas: [
      { id: 'pontos', rotulo: 'Pontos de isca', unidade: 'un' },
      { id: 'porta_iscas', rotulo: 'Porta-iscas novos a instalar', unidade: 'un', padrao: 0 },
    ],
    custos: [
      { id: 'isca_ponto', rotulo: 'Isca por ponto', unidade: 'R$/ponto', por: 'pontos' },
      { id: 'porta_isca', rotulo: 'Porta-isca novo', unidade: 'R$/un', por: 'porta_iscas' },
      EPI,
    ],
  },
  {
    id: 'caixa_dagua',
    nome: "Limpeza de caixa d'água",
    veiculo: 'carro',
    entradas: [
      { id: 'caixas', rotulo: "Caixas d'água", unidade: 'un', padrao: 1 },
      { id: 'volume', rotulo: 'Volume total', unidade: 'mil litros' },
    ],
    custos: [
      {
        id: 'produto_mil_l',
        rotulo: 'Produtos por mil litros',
        unidade: 'R$/mil L',
        por: 'volume',
      },
      { id: 'material_caixa', rotulo: 'Material por caixa', unidade: 'R$/caixa', por: 'caixas' },
      EPI,
    ],
  },
  {
    id: 'succao',
    nome: 'Sucção de fossa e caixa de gordura',
    veiculo: 'caminhao',
    entradas: [{ id: 'volume', rotulo: 'Volume a retirar', unidade: 'm³' }],
    custos: [
      { id: 'descarte_m3', rotulo: 'Descarte (ETE) por m³', unidade: 'R$/m³', por: 'volume' },
      { id: 'documentos', rotulo: 'MTR / documentos por serviço', unidade: 'R$' },
      EPI,
    ],
  },
  {
    id: 'desentupimento',
    nome: 'Desentupimento',
    veiculo: 'carro',
    entradas: [],
    custos: [
      { id: 'equipamento_h', rotulo: 'Equipamento por hora', unidade: 'R$/h', por: 'horas' },
      EPI,
    ],
  },
  {
    id: 'hidrojateamento',
    nome: 'Hidrojateamento',
    veiculo: 'caminhao',
    entradas: [],
    custos: [
      { id: 'equipamento_h', rotulo: 'Equipamento e água por hora', unidade: 'R$/h', por: 'horas' },
      EPI,
    ],
  },
  {
    id: 'coifa',
    nome: 'Limpeza de coifa',
    veiculo: 'carro',
    entradas: [
      { id: 'coifas', rotulo: 'Coifas', unidade: 'un', padrao: 1 },
      { id: 'dutos', rotulo: 'Dutos', unidade: 'm' },
    ],
    custos: [
      { id: 'produto_coifa', rotulo: 'Produto por coifa', unidade: 'R$/coifa', por: 'coifas' },
      { id: 'produto_duto', rotulo: 'Produto por metro de duto', unidade: 'R$/m', por: 'dutos' },
      EPI,
    ],
  },
  {
    id: 'placas',
    nome: 'Limpeza de placas solares',
    veiculo: 'carro',
    entradas: [{ id: 'placas', rotulo: 'Placas', unidade: 'un' }],
    custos: [
      {
        id: 'produto_placa',
        rotulo: 'Produto e água por placa',
        unidade: 'R$/placa',
        por: 'placas',
      },
      { id: 'altura', rotulo: 'Equipamento de altura por serviço', unidade: 'R$' },
      EPI,
    ],
  },
]

/** Valores da aba "Custos": chave "servico.item" → número (null = ainda não definido). */
export type Custos = Record<string, number | null | undefined>

export type DadosOrcamento = {
  /** Distância só de ida, em km (a conta dobra para ida e volta). */
  distancia: number
  tecnicos: number
  /** Horas de trabalho no local. */
  horas: number
  /** Pedágio, estacionamento etc., em R$. */
  extras: number
  veiculo: Veiculo
  /** Entradas do serviço (área, volume...). */
  valores: Record<string, number>
}

export type LinhaCusto = { rotulo: string; detalhe: string; valor: number }

export type Preco = { margem: number; preco: number; lucro: number }

export type ResultadoOrcamento = {
  kmTotal: number
  linhas: LinhaCusto[]
  custoTotal: number
  /** Impostos + comissão, em %. */
  descontos: number
  /** null quando a margem não foi definida (ou não fecha a conta). */
  minimo: Preco | null
  ideal: Preco | null
  maximo: Preco | null
  /** Custos e margens que ainda estão em branco. */
  faltando: string[]
}

const centavos = (v: number) => Math.round(v * 100) / 100
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const reais = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ')

export const chave = (servico: string, item: string) => `${servico}.${item}`

export function calcularOrcamento(
  servico: ServicoOrcamento,
  custos: Custos,
  dados: DadosOrcamento,
): ResultadoOrcamento {
  const faltando: string[] = []
  const custo = (servicoId: string, id: string, rotulo: string) => {
    const v = custos[chave(servicoId, id)]
    if (v == null) faltando.push(rotulo)
    return v ?? 0
  }
  const geral = (id: (typeof CUSTOS_GERAIS)[number]['id']) =>
    custo('geral', id, CUSTOS_GERAIS.find((c) => c.id === id)!.rotulo)

  const linhas: LinhaCusto[] = []
  const kmTotal = dados.distancia * 2

  // Deslocamento
  const custoKm = geral(dados.veiculo === 'caminhao' ? 'km_caminhao' : 'km_carro')
  linhas.push({
    rotulo: `Deslocamento (${NOME_VEICULO[dados.veiculo].toLowerCase()})`,
    detalhe: `${num(kmTotal)} km × ${reais(custoKm)}`,
    valor: kmTotal * custoKm,
  })

  // Mão de obra: no local + tempo de estrada
  const hora = geral('hora_tecnico')
  const velocidade = custos[chave('geral', 'velocidade')]
  const horasEstrada = velocidade ? kmTotal / velocidade : 0
  const horasTotais = dados.horas + horasEstrada
  linhas.push({
    rotulo: 'Mão de obra',
    detalhe:
      `${num(dados.tecnicos)} técnico(s) × ${num(horasTotais)} h` +
      (horasEstrada ? ` (${num(horasEstrada)} h de estrada)` : '') +
      ` × ${reais(hora)}`,
    valor: dados.tecnicos * horasTotais * hora,
  })

  // Itens do serviço
  const quantidade = (id: string) => (id === 'horas' ? dados.horas : (dados.valores[id] ?? 0))
  for (const item of servico.custos) {
    const v = custo(servico.id, item.id, `${item.rotulo} (${servico.nome})`)
    const entrada = servico.entradas.find((e) => e.id === item.por)
    const qtd = item.por ? quantidade(item.por) : 1
    linhas.push({
      rotulo: item.rotulo,
      detalhe: item.por
        ? `${num(qtd)} ${entrada?.unidade ?? 'h'} × ${reais(v)}`
        : `${reais(v)} por serviço`,
      valor: qtd * v,
    })
  }

  const administrativo = geral('administrativo')
  linhas.push({ rotulo: 'Administrativo', detalhe: 'por serviço', valor: administrativo })
  if (dados.extras)
    linhas.push({ rotulo: 'Pedágio / estacionamento', detalhe: '', valor: dados.extras })

  const custoTotal = centavos(linhas.reduce((s, l) => s + l.valor, 0))
  const descontos = geral('impostos') + geral('comissao')

  const preco = (id: (typeof MARGENS)[number]['id']): Preco | null => {
    const margem = custos[chave(servico.id, id)]
    if (margem == null) {
      faltando.push(`${MARGENS.find((m) => m.id === id)!.rotulo} (${servico.nome})`)
      return null
    }
    const sobra = 1 - (descontos + margem) / 100
    if (sobra <= 0) return null
    const valor = centavos(custoTotal / sobra)
    return { margem, preco: valor, lucro: centavos((valor * margem) / 100) }
  }

  return {
    kmTotal,
    linhas: linhas.map((l) => ({ ...l, valor: centavos(l.valor) })),
    custoTotal,
    descontos,
    minimo: preco('margem_minima'),
    ideal: preco('margem_ideal'),
    maximo: preco('margem_maxima'),
    faltando,
  }
}

/** "1.234,5" ou "1234.5" → 1234.5; vazio ou inválido → null. */
export function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '')
  if (!t) return null
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  if (!/^\d+(\.\d+)?$/.test(normal)) return null
  return Number(normal)
}

/** 1234.5 → "1234,5" (para preencher o campo). */
export function numeroParaCampo(v: number | null | undefined): string {
  return v == null ? '' : String(v).replace('.', ',')
}
