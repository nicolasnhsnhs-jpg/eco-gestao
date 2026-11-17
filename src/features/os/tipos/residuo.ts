/*
 * Resíduo sugado nas OS de sucção (fossa, caixa de gordura): o operador informa a
 * quantidade (m³) e qual dos códigos foi. Vale para os tipos de serviço marcados
 * com "registra_residuo". Mesma lista em privado.pendencias_os
 * (migration 20270111120000_os_residuo_succao.sql).
 */

export const RESIDUOS = [
  { codigo: '200125', nome: 'Gordura' },
  { codigo: '200304', nome: 'Fossa' },
  { codigo: '200301', nome: 'Mista' },
  { codigo: '190809', nome: 'Gorduras e óleos' },
] as const

export type CodigoResiduo = (typeof RESIDUOS)[number]['codigo']

/** Fica em checklist.residuo da execução. */
export type Residuo = { codigo?: CodigoResiduo | null; quantidade_m3?: number | null }

export function residuoDoChecklist(checklist: unknown): Residuo {
  const r = (checklist as { residuo?: Residuo } | null)?.residuo
  return r && typeof r === 'object' ? r : {}
}

export function quantidadeValida(r: Residuo) {
  return typeof r.quantidade_m3 === 'number' && r.quantidade_m3 > 0
}

export function codigoValido(r: Residuo) {
  return RESIDUOS.some((x) => x.codigo === r.codigo)
}

/** "200304 - Fossa" (ou null quando não escolheu). */
export function nomeResiduo(codigo: string | null | undefined) {
  const r = RESIDUOS.find((x) => x.codigo === codigo)
  return r ? `${r.codigo} - ${r.nome}` : null
}

/** 4.5 → "4,5 m³". */
export function formatarM3(valor: number) {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m³`
}
