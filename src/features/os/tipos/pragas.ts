/*
 * Controle de pragas: códigos da ficha e regras de cálculo.
 * Os mesmos códigos são conferidos pelo banco (os_pontos); aqui ficam os nomes
 * para a tela e o PDF, e as contas que ajudam o operador.
 */

export const FORMAS_ISCAGEM = {
  PII: 'Porta-isca interno',
  PIE: 'Porta-isca externo',
  IE: 'Isca exposta',
} as const

export const TIPOS_ISCA = {
  IP: 'Isca parafinada',
  IG: 'Isca granulada',
  PO: 'Pó de contato',
  CO: 'Cola (placa adesiva)',
  S: 'Semente',
} as const

/** Situação das iscas (o padrão é MS: o operador só anota as exceções). */
export const SITUACOES_ISCA = {
  MS: 'Mantido sem consumo',
  MC: 'Mantido com consumo',
  CT: 'Consumido e trocado',
  IN: 'Isca nova',
  DT: 'Degradado e trocado',
  SA: 'Sem acesso',
  NE: 'Não encontrado',
} as const

/** Situação das placas adesivas (padrão M). */
export const SITUACOES_PLACA = {
  M: 'Mantido',
  SC: 'Substituído c/ captura',
  I: 'Inexistente',
  T: 'Trocado',
  SA: 'Sem acesso',
  NE: 'Não encontrado',
} as const

export const SITUACOES_ARMADILHA = {
  F: 'Funcionando',
  D: 'Danificada',
  DL: 'Desligada',
  LT: 'Lâmpada trocada',
} as const

export const REFIL = { M: 'Mantido', T: 'Trocado', I: 'Inexistente' } as const
export const HIGIENE = { S: 'Satisfatória', R: 'Regular', I: 'Insuficiente' } as const
export const ESPECIES = { M: 'Mosca', MQ: 'Mosquito', MA: 'Mariposa', B: 'Besouro' } as const
export const PRAGAS_ALVO = ['Ratazana', 'Rato de telhado', 'Camundongo'] as const
export const NIVEIS = { B: 'Baixo', M: 'Médio', A: 'Alto' } as const

export const PRAGAS_INSETOS = {
  B: 'Baratas',
  F: 'Formigas',
  M: 'Moscas',
  MQ: 'Mosquito',
  A: 'Aranhas',
  T: 'Traças',
  L: 'Lesma',
} as const

export const PROCEDIMENTOS = {
  AT: 'Atomização',
  TN: 'Termonebulização',
  IG: 'Iscagem com gel',
  I: 'Iscagem',
  PO: 'Polvilhamento',
  PL: 'Pulverização',
} as const

export const CONDICOES = {
  LE: 'Limpeza eficiente',
  LR: 'Limpeza regular',
  LI: 'Limpeza ineficiente',
} as const

export const FORMAS_PRODUTO = {
  bloco: 'Bloco parafinado',
  semente: 'Semente de girassol',
  granulada: 'Isca granulada',
  po: 'Pó de contato',
  placa: 'Placa adesiva',
  outro: 'Outro',
} as const

export type Nivel = keyof typeof NIVEIS

/** Situação padrão de um porta-isca: placa de cola começa M; as iscas, MS. */
export const situacaoPadrao = (tipoIsca: string | null) => (tipoIsca === 'CO' ? 'M' : 'MS')

/**
 * Lê uma lista de números com faixas: "12, 15, 40-45" → [12, 15, 40, …, 45].
 * Devolve também o que não deu para entender, para avisar o operador.
 */
export function lerFaixas(texto: string): { numeros: number[]; invalidos: string[] } {
  const numeros = new Set<number>()
  const invalidos: string[] = []
  for (const pedaco of texto.split(/[,;\s]+/).filter(Boolean)) {
    const faixa = /^(\d{1,4})(?:-|a|até)(\d{1,4})$/i.exec(pedaco)
    if (faixa) {
      const [de, ate] = [Number(faixa[1]), Number(faixa[2])].sort((a, b) => a - b)
      if (ate - de > 500) {
        invalidos.push(pedaco)
        continue
      }
      for (let n = de; n <= ate; n++) numeros.add(n)
    } else if (/^\d{1,4}$/.test(pedaco)) {
      numeros.add(Number(pedaco))
    } else {
      invalidos.push(pedaco)
    }
  }
  return { numeros: [...numeros].sort((a, b) => a - b), invalidos }
}

/** O inverso: [12, 15, 40, 41, 42] → "12, 15, 40-42". */
export function escreverFaixas(numeros: number[]): string {
  const ordenados = [...new Set(numeros)].sort((a, b) => a - b)
  const partes: string[] = []
  for (let i = 0; i < ordenados.length; i++) {
    const inicio = ordenados[i]
    while (i + 1 < ordenados.length && ordenados[i + 1] === ordenados[i] + 1) i++
    const fim = ordenados[i]
    partes.push(
      fim - inicio >= 2 ? `${inicio}-${fim}` : fim === inicio ? `${inicio}` : `${inicio}, ${fim}`,
    )
  }
  return partes.join(', ')
}

const COM_CONSUMO = new Set(['MC', 'CT', 'DT'])
const NAO_VISITADO = new Set(['SA', 'NE'])

/**
 * Nível de infestação de roedores sugerido pela ficha: % das iscas visitadas que
 * tiveram consumo (MC, CT, DT). Sem acesso e não encontrado não contam.
 * Até 10% baixo, até 30% médio, acima de 30% alto.
 */
export function sugerirNivelRoedores(situacoes: (string | null)[]): {
  nivel: Nivel | null
  percentual: number
} {
  const visitados = situacoes.filter(
    (s): s is string => !!s && !NAO_VISITADO.has(s) && s in SITUACOES_ISCA,
  )
  if (visitados.length === 0) return { nivel: null, percentual: 0 }
  const percentual = (visitados.filter((s) => COM_CONSUMO.has(s)).length / visitados.length) * 100
  return { nivel: percentual <= 10 ? 'B' : percentual <= 30 ? 'M' : 'A', percentual }
}

/** Insetos e armadilhas: pela contagem. 1 a 50 baixo, 51 a 99 médio, 100 ou mais alto. */
export function nivelPorContagem(total: number): Nivel | null {
  if (total <= 0) return null
  return total <= 50 ? 'B' : total < 100 ? 'M' : 'A'
}

/** Campos "planos" da execução de pragas (guardados em os_execucao.checklist). */
export type ChecklistPragas = {
  pragas_alvo?: string[]
  nivel_infestacao?: Nivel
  sem_acesso?: string
  quebrados?: string
  comentarios_roedores?: string
  monitoramento_insetos?: boolean
  medidas_preventivas?: boolean
  medidas_descricao?: string
  comentarios_aplicacao?: string
  solicitacoes_cliente?: string
}

/** Escopo do controle de pragas (guardado em escopo da OS e do modelo). */
export type EscopoPragas = {
  subtipo?: 'roedores' | 'insetos_roedores'
  pragas_alvo?: string[]
  areas_insetos?: string
  armadilhas_contrato?: number
}

/** Quantas etapas o controle de pragas ocupa (para numerar as etapas seguintes). */
export function quantasEtapasPragas(
  os: { escopo: unknown },
  pontos: { tipo: string }[] | undefined,
) {
  const temArmadilhas = !!pontos?.some((p) => p.tipo === 'armadilha_luminosa')
  const temInsetos = (os.escopo as EscopoPragas | null)?.subtipo === 'insetos_roedores'
  return 3 + (temArmadilhas ? 1 : 0) + (temInsetos ? 1 : 0)
}
