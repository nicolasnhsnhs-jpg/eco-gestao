/*
 * Monitoramento de águas: coleta para análise físico-química e microbiológica.
 * As regras para concluir ficam no banco (privado.pendencias_os) e usam os mesmos
 * nomes de campo.
 */

export const PARAMETROS_PADRAO =
  'Cor aparente, turbidez, pH, gosto e odor, Escherichia coli, coliformes totais e cloro residual livre.'

/** Procedimento de coleta da ficha de papel, na ordem. */
export const PROCEDIMENTO_COLETA = [
  'Lavar a mangueira ou o bico da torneira com a própria água; se o bico puder ser retirado, remova-o antes da limpeza.',
  'Lavar bem as mãos e usar a máscara e as luvas do kit de coleta.',
  'Deixar a água escoar por aproximadamente 5 minutos.',
  'Coletar diretamente no frasco próprio para este fim.',
  'Encher até a marca de nível do frasco (100 ml), sem encher completamente, e fechar imediatamente.',
  'Se o frasco tiver pastilha, agitar com cuidado até ela dissolver por completo.',
  'Refrigerar imediatamente as amostras de 4 a 8 °C, sem congelar.',
  'Identificar o frasco com o nome do ponto e o horário.',
] as const

export const AVISO_PONTOS =
  'Para garantir o resultado da análise, a coleta deve ser feita diretamente do reservatório. Não nos responsabilizamos por análises de pontos aleatórios.'

export const PERGUNTA_REFRIGERADAS = {
  texto: 'Amostras refrigeradas (4 a 8 °C) e frascos identificados?',
  detalhe: 'Se não, motivo',
} as const

/** Quantas etapas a água ocupa na tela do operador (para numerar as seguintes). */
export const ETAPAS_AGUA = 3

export type RespostaSimNao = { sim?: boolean; texto?: string }

/** Campos "planos" da execução (guardados em os_execucao.checklist). */
export type ChecklistAgua = {
  /** O técnico confirma que seguiu o procedimento de coleta. */
  procedimento?: boolean
  refrigeradas?: RespostaSimNao
}

/** Escopo da análise (guardado no escopo da OS e do modelo). */
export type EscopoAgua = { parametros?: string; frascos?: string }

/** "01 ponto", "03 pontos". */
export const quantosPontos = (n: number) =>
  `${String(n).padStart(2, '0')} ${n === 1 ? 'ponto' : 'pontos'}`
