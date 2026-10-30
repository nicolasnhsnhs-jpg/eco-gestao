/*
 * Limpeza de coifa: perguntas e códigos da ficha. As regras para concluir ficam
 * no banco (privado.pendencias_os) e usam os mesmos nomes de campo.
 */

export const MATERIAIS = { galvanizado: 'Galvanizado', inox: 'Inox', aluminio: 'Alumínio' } as const
export const SUJIDADE = { B: 'Baixo', M: 'Médio', A: 'Alto' } as const
export const CONDICOES_AMBIENTE = {
  LE: 'Limpeza eficiente',
  LR: 'Limpeza regular',
  LI: 'Limpeza ineficiente',
} as const
export const ESCOAMENTO = {
  eficiente: 'Eficiente',
  regular: 'Regular',
  ineficiente: 'Ineficiente',
} as const
export const QUANTIDADES_PRODUTO = [1000, 2000, 3000, 4000, 5000] as const
export const FOTOS_DEPOIS = {
  frontal: 'Frontal',
  lateral: 'Lateral',
  interna: 'Interna',
  tubulacao: 'Tubulação',
} as const

/** Perguntas sim/não da liberação para trabalho, como na ficha de papel. */
export const PERGUNTAS_LIBERACAO = [
  {
    campo: 'area_isolada',
    texto: 'Área de trabalho da limpeza foi isolada?',
    detalhe: 'Se não, motivo',
  },
  {
    campo: 'producao_livre',
    texto: 'Área de produção livre de utensílios?',
    detalhe: 'Se não, motivo',
  },
  {
    campo: 'pintada',
    texto: 'Coifa/tubulação pintada?',
    detalhe: 'Situação da pintura antes da limpeza',
  },
  {
    campo: 'risco_pintura',
    texto: 'Risco de danificar a pintura com a limpeza?',
    detalhe: 'Comentários',
  },
  {
    campo: 'equipamentos_desligados',
    texto: 'Desligados e isolados os equipamentos energizados?',
    detalhe: 'Quais',
  },
  { campo: 'motor_desligado', texto: 'Desligado o motor de exaustão?', detalhe: 'Se não, motivo' },
  { campo: 'gas_fechado', texto: 'Fechado o registro de gás GLP?', detalhe: 'Quantos / motivo' },
] as const

/** Conferência final com o cliente. */
export const PERGUNTAS_CONFERENCIA = [
  { campo: 'limpeza_eficiente', texto: 'Limpeza eficiente da área de trabalho?' },
  { campo: 'equipamentos_religados', texto: 'Religados os equipamentos energizados?' },
  { campo: 'ambiente_liberado', texto: 'Ambiente liberado para o retorno das atividades?' },
] as const

export const PRODUTO_PADRAO =
  'Hidróxido de sódio · Maxxy Grill (detergente desincrustante alcalino) MS 3.1966.0029 · solução de 20 a 50 ml/L'

export const INFORMACOES_TECNICAS = [
  'O técnico deverá seguir o POP do Manual de Boas Práticas Operacionais Eco Ambiental.',
  'Precauções: durante a manipulação e a higienização, usar EPIs (macacão com mangas compridas, botas, luvas de borracha e óculos de proteção).',
  'Informações para uso médico: de acordo com as orientações da FISPQ do produto.',
  'Centro de Informações Toxicológicas (CIT/24 horas): 0800 721 3000.',
]

/** Quantas etapas a coifa ocupa na tela do operador (para numerar as seguintes). */
export const ETAPAS_COIFA = 5

export const AVISO_DESLOCAMENTO = 'Deslocamento sem êxito será cobrado taxa adicional.'

export type RespostaSimNao = { sim?: boolean; texto?: string }

/** Campos "planos" da execução da coifa (guardados em os_execucao.checklist). */
export type ChecklistCoifa = {
  liberacao?: Partial<Record<(typeof PERGUNTAS_LIBERACAO)[number]['campo'], RespostaSimNao>> & {
    condicoes?: keyof typeof CONDICOES_AMBIENTE
    escoamento?: keyof typeof ESCOAMENTO
    escoamento_obs?: string
  }
  telas_retiradas?: { sim?: boolean; quantidade?: number }
  fotos_depois?: Partial<Record<keyof typeof FOTOS_DEPOIS, boolean>>
  produto_ml?: number
  conferencia?: Partial<Record<(typeof PERGUNTAS_CONFERENCIA)[number]['campo'], RespostaSimNao>>
}

/** Escopo da coifa (guardado no escopo da OS e do modelo). */
export type EscopoCoifa = { produto?: string }
