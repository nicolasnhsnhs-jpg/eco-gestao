/*
 * Limpeza e sanitização de bebedouros: tipos de bebedouro e perguntas da ficha.
 * As regras para concluir ficam no banco (privado.pendencias_os) e usam os mesmos
 * nomes de campo.
 */

/** Os dois quadros da ficha; cada um tem a sua numeração de etiqueta. */
export const TIPOS_BEBEDOURO = {
  bebedouro: {
    titulo: 'Bebedouros industriais',
    nome: 'Bebedouro industrial',
    dicaFiltro: 'Ex.: 1019 ou Soft Flow WFS 042.',
  },
  bebedouro_garrafao: {
    titulo: 'Bebedouros garrafão',
    nome: 'Bebedouro garrafão',
    dicaFiltro: 'Se tiver filtro.',
  },
} as const
export type TipoBebedouro = keyof typeof TIPOS_BEBEDOURO
export const ehBebedouro = (tipo: string): tipo is TipoBebedouro => tipo in TIPOS_BEBEDOURO

export const TRABALHO = { preventivo: 'Preventivo', corretivo: 'Corretivo' } as const

/** Conferência com o cliente: a resposta "boa" de cada uma é diferente. */
export const PERGUNTAS_CONFERENCIA_BEBEDOURO = [
  {
    campo: 'todos_limpos',
    texto: 'Realizada a limpeza de todos os bebedouros previstos?',
    detalhe: 'Se não, motivo',
  },
  {
    campo: 'danificados',
    texto: 'Há bebedouros danificados?',
    detalhe: 'Se sim, descreva',
  },
] as const

/** Quantas etapas o bebedouro ocupa na tela do operador (para numerar as seguintes). */
export const ETAPAS_BEBEDOURO = 3

export type RespostaSimNao = { sim?: boolean; texto?: string }

/** Campos "planos" da execução (guardados em os_execucao.checklist). */
export type ChecklistBebedouro = {
  trabalho?: keyof typeof TRABALHO
  conferencia?: Partial<
    Record<(typeof PERGUNTAS_CONFERENCIA_BEBEDOURO)[number]['campo'], RespostaSimNao>
  >
}

/** "01", "02"… como nas etiquetas. */
export const etiqueta = (numero: number) => String(numero).padStart(2, '0')
