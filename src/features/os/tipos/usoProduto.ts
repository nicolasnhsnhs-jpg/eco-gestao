/*
 * Para que serve cada produto do catálogo (coluna produtos_certificado.uso).
 * Separa a lista que o técnico vê na OS: no controle de roedores só os de
 * roedores, no de insetos só os de insetos; "ambos" aparece nas duas.
 */

export const USOS_PRODUTO = {
  ambos: 'Roedores e insetos',
  roedores: 'Só roedores',
  insetos: 'Só insetos',
  outros: 'Outro serviço',
} as const

export type UsoProduto = keyof typeof USOS_PRODUTO

/** O que a lista da OS está mostrando. */
export type FiltroUso = 'roedores' | 'insetos' | 'pragas'

export const FILTROS_USO: Record<FiltroUso, string> = {
  roedores: 'Roedores',
  insetos: 'Insetos',
  pragas: 'Todos',
}

/** Valor da coluna (ou ausente, em lista antiga guardada no celular) → uso. */
export const lerUso = (uso: string | null | undefined): UsoProduto =>
  uso && uso in USOS_PRODUTO ? (uso as UsoProduto) : 'ambos'

/** O produto entra na lista da OS? "Outro serviço" nunca entra nas OS de pragas. */
export function produtoServePara(uso: string | null | undefined, filtro: FiltroUso): boolean {
  const u = lerUso(uso)
  if (u === 'outros') return false
  if (filtro === 'pragas' || u === 'ambos') return true
  return u === filtro
}

/** Os produtos da lista que servem para o filtro. */
export const produtosPara = <T extends { uso?: string | null }>(
  lista: readonly T[] | undefined,
  filtro: FiltroUso,
): T[] => (lista ?? []).filter((p) => produtoServePara(p.uso, filtro))
