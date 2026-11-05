// Contas dos campos de código da NFS-e (testadas em notas.test.ts).

export type ListaNfse = 'tributacao' | 'nbs'

export type Codigo = { codigo: string; descricao: string; busca: string }

export const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** 071301 → 07.13.01; 118032100 → 1.1803.21.00 */
export function formatarCodigoNfse(lista: ListaNfse, codigo: string): string {
  if (lista === 'tributacao' && /^\d{6}$/.test(codigo))
    return `${codigo.slice(0, 2)}.${codigo.slice(2, 4)}.${codigo.slice(4)}`
  if (lista === 'nbs' && /^\d{9}$/.test(codigo))
    return `${codigo[0]}.${codigo.slice(1, 5)}.${codigo.slice(5, 7)}.${codigo.slice(7)}`
  return codigo
}

/** Os códigos que batem com o que foi digitado: pelo código (com ou sem pontos) ou pelas palavras. */
export function filtrarCodigos<T extends { codigo: string; busca: string }>(
  codigos: T[],
  termo: string,
): T[] {
  const t = semAcento(termo.trim())
  if (!t) return codigos
  const digitos = t.replace(/[.\s-]/g, '')
  if (/^\d+$/.test(digitos)) return codigos.filter((c) => c.codigo.startsWith(digitos))
  const palavras = t.split(/\s+/)
  return codigos.filter((c) => palavras.every((p) => c.busca.includes(p)))
}
