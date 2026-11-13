/*
 * Limpeza e higienização de aparelhos de ar-condicionado (modelo PMOC).
 * As regras para concluir ficam no banco (privado.pendencias_os) e usam os mesmos
 * nomes de campo.
 */

/** Resposta das limpezas: sim, não ou não se aplica. */
export const SIM_NAO_NA = { sim: 'Sim', nao: 'Não', na: 'Não se aplica' } as const
export type SimNaoNa = keyof typeof SIM_NAO_NA

/** As três limpezas de cada aparelho, como na ficha (campo em os_pontos). */
export const LIMPEZAS = [
  { campo: 'limpeza_serpentina', texto: 'Limpeza química da serpentina', curto: 'Serpentina' },
  {
    campo: 'limpeza_gabinete',
    texto: 'Limpeza do gabinete, aletas e veneziana',
    curto: 'Gabinete/aletas',
  },
  { campo: 'limpeza_dreno', texto: 'Limpeza do dreno e bandeja', curto: 'Dreno/bandeja' },
] as const

/** As duas fotos de cada aparelho (sim/não). */
export const FOTOS_APARELHO = [
  { campo: 'foto_etiqueta', texto: 'Foto da etiqueta do equipamento', curto: 'Foto etiqueta' },
  { campo: 'fotos_limpeza', texto: 'Fotos antes e depois da limpeza', curto: 'Fotos antes/depois' },
] as const

export const PRODUTO_PADRAO_AR =
  'Cloreto de benzalcônio · Notificação ANVISA nº 25351.559099/2017-59 · Lote 439, fab. 08/2026, validade 18 meses'

export const AVISO_FOTOS_AR =
  'É obrigatório o envio das fotos do processo de limpeza (antes e depois) e da imagem nítida da etiqueta de identificação do ar-condicionado.'

/** Quantas etapas o ar-condicionado ocupa na tela do operador. */
export const ETAPAS_AR = 2

/** Campos "planos" da execução (guardados em os_execucao.checklist). */
export type ChecklistAr = { produto_ml?: number }

/** Escopo (guardado no escopo da OS e do modelo). */
export type EscopoAr = { produto?: string }

/** Aparelho sem alguma das limpezas ou das fotos respondidas. */
export function aparelhoIncompleto(p: {
  limpeza_serpentina?: string | null
  limpeza_gabinete?: string | null
  limpeza_dreno?: string | null
  foto_etiqueta?: boolean | null
  fotos_limpeza?: boolean | null
}) {
  return (
    p.limpeza_serpentina == null ||
    p.limpeza_gabinete == null ||
    p.limpeza_dreno == null ||
    p.foto_etiqueta == null ||
    p.fotos_limpeza == null
  )
}

/** "18.000 BTU" */
export const formatarBtu = (btu: number | null | undefined) =>
  btu ? `${btu.toLocaleString('pt-BR')} BTU` : ''
