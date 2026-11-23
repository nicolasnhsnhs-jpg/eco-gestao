import type { Json } from '@/lib/database.types'

/** Uma MTR da sucção: o número e a quantidade retirada naquela MTR. */
export type Mtr = { numero: string; quantidade: string }

export const MTR_VAZIA: Mtr = { numero: '', quantidade: '' }

/**
 * As MTRs do certificado. Os antigos (antes de 23/11/2026) só têm um número e uma
 * quantidade, nas colunas mtr e volume: viram uma linha.
 */
export function lerMtrs(c: { mtrs?: Json | null; mtr?: string | null; volume?: string | null }) {
  const lista = Array.isArray(c.mtrs)
    ? c.mtrs
        .filter((m): m is Record<string, Json> => !!m && typeof m === 'object' && !Array.isArray(m))
        .map((m) => ({
          numero: typeof m.numero === 'string' ? m.numero : '',
          quantidade: typeof m.quantidade === 'string' ? m.quantidade : '',
        }))
    : []
  const preenchidas = limparMtrs(lista)
  if (preenchidas.length) return preenchidas
  const numero = c.mtr?.trim() ?? ''
  const quantidade = c.volume?.trim() ?? ''
  return numero || quantidade ? [{ numero, quantidade }] : []
}

/** Tira espaços e as linhas vazias. */
export function limparMtrs(lista: Mtr[]): Mtr[] {
  return lista
    .map((m) => ({ numero: m.numero.trim(), quantidade: m.quantidade.trim() }))
    .filter((m) => m.numero || m.quantidade)
}

/** Resumo para as colunas antigas (mtr e volume): "123, 456" e "2m³ + 3m³". */
export function resumoMtrs(lista: Mtr[]) {
  const l = limparMtrs(lista)
  const numeros = l.map((m) => m.numero).filter(Boolean)
  const quantidades = l.map((m) => m.quantidade).filter(Boolean)
  return {
    mtr: numeros.length ? numeros.join(', ') : null,
    volume: quantidades.length ? quantidades.join(' + ') : null,
  }
}

/** Linhas do PDF: "MTR nº 123 · Quantidade: 2,000m³", uma por MTR. */
export function linhasMtrs(lista: Mtr[]) {
  return limparMtrs(lista).map((m) =>
    [m.numero && `MTR nº ${m.numero}`, m.quantidade && `Quantidade: ${m.quantidade}`]
      .filter(Boolean)
      .join(' · '),
  )
}
