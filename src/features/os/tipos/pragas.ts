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
  MEC: 'Mecânica',
  TR: 'Ratoeira T-rex',
  CO: 'Cola (placa adesiva)',
  S: 'Semente',
} as const

/** Situação das iscas (o padrão é MS: o operador só anota as exceções). */
export const SITUACOES_ISCA = {
  MS: 'Mantido sem consumo',
  MC: 'Mantido com consumo',
  CT: 'Consumido e trocado',
  IN: 'Isca nova',
  CAP: 'Capturado',
  Q: 'Quebrado',
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
  Q: 'Quebrado',
  SA: 'Sem acesso',
  NE: 'Não encontrado',
} as const

export const SITUACOES_ARMADILHA = {
  F: 'Funcionando',
  D: 'Danificada',
  DL: 'Desligada',
  LT: 'Lâmpada trocada',
} as const

/**
 * Armadilha que o técnico não encontrou no local (retirada, obra…): no lugar dos
 * campos, só a observação (obrigatória). Fica fora das opções de situação.
 */
export const FORA_DO_LOCAL = 'NL'
export const NOMES_SITUACAO_ARMADILHA = {
  ...SITUACOES_ARMADILHA,
  NL: 'Não está no local',
} as const

/** Modelos de armadilha luminosa (P branca, M, G inox, AL-15, AL-30, Slip-115). */
export const MODELOS_ARMADILHA = {
  P: 'Branca (P)',
  M: 'Modelo M',
  G: 'Inox (G)',
  'AL-15': 'AL-15',
  'AL-30': 'AL-30',
  'SLIP-115': 'Slip-115',
} as const
export const nomeModeloArmadilha = (modelo: string | null | undefined) =>
  (modelo && MODELOS_ARMADILHA[modelo as keyof typeof MODELOS_ARMADILHA]) ?? modelo ?? ''

export const REFIL = { M: 'Mantido', T: 'Trocado', I: 'Inexistente' } as const
export const HIGIENE = { S: 'Satisfatória', R: 'Regular', I: 'Insuficiente' } as const
export const ESPECIES = { M: 'Mosca', MQ: 'Mosquito', MA: 'Mariposa', B: 'Besouro' } as const
export const PRAGAS_ALVO = ['Ratazana', 'Rato de telhado', 'Camundongo'] as const

/** Armadilha de feromônio: situação da armadilha (guardada em os_pontos.refil). */
export const SITUACOES_FEROMONIO = REFIL

/** Planilha de gerenciamento de ocorrências com pragas (vivos e mortos por tipo). */
export const OCORRENCIAS = {
  besouros: 'Besouros',
  mariposas: 'Mariposas',
  lacraias: 'Lacraias/centopeias',
  aranhas: 'Aranhas',
  baratas: 'Baratas',
  ratos: 'Ratos',
  formigas: 'Formigas',
  mosquitos: 'Mosquitos',
  moscas: 'Moscas',
  abelhas: 'Abelhas',
  inseto_graos: 'Inseto de grãos',
  outros: 'Outros',
} as const

export type Ocorrencia = { vivos?: number; mortos?: number; comentario?: string }

export const DILUENTES = { pronto: 'Pronto uso', agua: 'H²O', oleo: 'Óleo' } as const
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
  polvilhamento: 'Pó (polvilhamento)',
  placa: 'Placa adesiva',
  liquido: 'Líquido (pulverização)',
  atomizacao: 'Líquido (atomização)',
  nebulizacao: 'Líquido (nebulização)',
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

type PontoNumerado = { tipo: string; numero: number; forma_iscagem?: string | null }

const ORDEM_FORMA: Record<string, number> = { PIE: 0, IE: 1, PII: 2 }

/**
 * Cliente que numera os porta-iscas externos e os internos cada um a partir do 01
 * (Neovia: externos 01-66, internos 01-40)? Os números se repetem entre as formas
 * de iscagem, mas não dentro de cada uma.
 */
export function numeracaoPorForma(pontos: PontoNumerado[]): boolean {
  const porNumero = new Set<string>()
  const porForma = new Set<string>()
  let repete = false
  for (const p of pontos) {
    if (p.tipo !== 'porta_isca') continue
    const n = `${p.numero}`
    const f = `${p.forma_iscagem ?? ''}-${p.numero}`
    if (porForma.has(f)) return false
    if (porNumero.has(n)) repete = true
    porNumero.add(n)
    porForma.add(f)
  }
  return repete
}

/**
 * Ordem dos pontos (tipo e número). Quando externos e internos têm cada um a sua
 * numeração, vêm primeiro todos os externos e depois todos os internos, como na
 * ordem de serviço em papel, em vez de "01 externo, 01 interno, 02 externo…".
 */
export function ordenarPontos<T extends PontoNumerado>(lista: T[]): T[] {
  const porForma = numeracaoPorForma(lista)
  const forma = (p: T) =>
    porForma && p.tipo === 'porta_isca' ? (ORDEM_FORMA[p.forma_iscagem ?? ''] ?? 3) : 0
  return [...lista].sort(
    (a, b) => a.tipo.localeCompare(b.tipo) || forma(a) - forma(b) || a.numero - b.numero,
  )
}

// Captura na mecânica também é sinal de roedor.
const COM_CONSUMO = new Set(['MC', 'CT', 'DT', 'CAP'])
const NAO_VISITADO = new Set(['SA', 'NE'])

/**
 * Nível de infestação de roedores sugerido pela ficha: % das iscas visitadas que
 * tiveram consumo ou captura (MC, CT, DT, CAP). Sem acesso e não encontrado não contam.
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
  /** Visto do técnico em cada local com planilha de ocorrência de pragas. */
  planilha_vistos?: Record<string, boolean>
  /** Planilha de ocorrências: vivos, mortos e comentário por tipo de praga. */
  ocorrencias?: Partial<Record<keyof typeof OCORRENCIAS, Ocorrencia>>
  envelope_entregue?: boolean
  envelope_documentos?: string
  envelope_responsavel?: string
}

/** Escopo do controle de pragas (guardado em escopo da OS e do modelo). */
export type EscopoPragas = {
  subtipo?: 'roedores' | 'insetos_roedores'
  pragas_alvo?: string[]
  areas_insetos?: string
  armadilhas_contrato?: number
  /** Locais com planilha de ocorrência de pragas (o técnico dá o visto). */
  locais_planilha?: string[]
  /** Pragas combatidas no controle de insetos (texto da ficha). */
  pragas_insetos?: string
  /** Mostra a planilha de ocorrências (vivos/mortos por tipo de praga). */
  planilha_ocorrencias?: boolean
  /** Pergunta se foi entregue envelope (documentos) ao cliente. */
  envelope?: boolean
  /** Texto do objetivo do monitoramento com feromônio (aparece para o técnico e no PDF). */
  objetivo_feromonio?: string
}

/** Quantas etapas o controle de pragas ocupa (para numerar as etapas seguintes). */
export function quantasEtapasPragas(
  os: { escopo: unknown },
  pontos: { tipo: string }[] | undefined,
) {
  const temArmadilhas = !!pontos?.some((p) => p.tipo === 'armadilha_luminosa')
  const temMonitoramento = !!pontos?.some(
    (p) => p.tipo === 'feromonio' || p.tipo === 'armadilha_moscas',
  )
  const temInsetos = (os.escopo as EscopoPragas | null)?.subtipo === 'insetos_roedores'
  return 3 + (temArmadilhas ? 1 : 0) + (temMonitoramento ? 1 : 0) + (temInsetos ? 1 : 0)
}
