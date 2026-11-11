/*
 * Entrega de telas (limpeza de coifa industrial — entrega de telas): perguntas
 * da ficha. As regras para concluir ficam no banco (privado.pendencias_os) e usam
 * os mesmos nomes de campo. As coifas, com a quantidade de telas de cada uma,
 * são os pontos "coifa" do modelo (o mesmo cadastro da limpeza de coifa).
 */

export type RespostaSimNao = { sim?: boolean; texto?: string }

export const PERGUNTA_LIBERACAO_TELAS = {
  texto: 'Autorizada a instalação de telas?',
  detalhe: 'Se não, motivo',
} as const

export const PERGUNTA_INSTALADAS = {
  texto: 'Telas instaladas?',
  detalhe: 'Se não, motivo',
} as const

/** Quantas etapas a entrega de telas ocupa na tela do operador (para numerar as seguintes). */
export const ETAPAS_TELAS = 3

/** Campos "planos" da execução (guardados em os_execucao.checklist). */
export type ChecklistTelas = {
  autorizado?: RespostaSimNao
  instaladas?: RespostaSimNao
}

/** Total de telas a entregar (soma da coluna "Qtde de telas" da ficha). */
export function totalTelas(coifas: { quantidade_telas?: number | null }[]) {
  return coifas.reduce((soma, c) => soma + (c.quantidade_telas ?? 0), 0)
}
