import type { ProdutoCertificado } from './modelos'

/** Produto do catálogo como o certificado precisa (registro, lote, datas). */
export type ProdutoDoCatalogo = {
  id: string
  nome_comercial: string | null
  principio_ativo: string
  registro: string | null
  lote: string | null
  fabricacao: string | null
  validade: string | null
}

/** Um produto que o técnico citou na OS, de qualquer parte dela. */
export type ProdutoCitado = {
  /** Já vem ligado ao catálogo (Produtos utilizados). */
  produtoId?: string | null
  /** Texto do produto: "FENDONA (Alfa-Cipermetrina)", só o princípio ativo, ou o nome comercial. */
  nome_comercial?: string | null
  principio_ativo?: string | null
  /** Quantidade em número já separada (Produtos utilizados)… */
  g?: number | null
  ml?: number | null
  un?: number | null
  /** …ou em texto ("100 mL", "150ml", "2 L", "5 pts"). */
  quantidade?: string | null
}

const normalizar = (t: string | null | undefined) =>
  (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** "FENDONA (Alfa-Cipermetrina)" → { nome: "FENDONA", principio: "Alfa-Cipermetrina" } */
function separarNome(texto: string) {
  const m = texto.match(/^(.*?)\s*\((.+)\)\s*$/)
  return m ? { nome: m[1], principio: m[2] } : { nome: '', principio: texto }
}

/** Acha no catálogo o produto citado (pelo id, pelo nome comercial ou pelo princípio ativo). */
export function acharNoCatalogo(
  citado: ProdutoCitado,
  catalogo: ProdutoDoCatalogo[],
): ProdutoDoCatalogo | undefined {
  if (citado.produtoId) return catalogo.find((c) => c.id === citado.produtoId)
  const texto = citado.nome_comercial
    ? { nome: citado.nome_comercial, principio: citado.principio_ativo ?? '' }
    : separarNome(citado.principio_ativo ?? '')
  const nome = normalizar(texto.nome)
  const principio = normalizar(texto.principio)
  const mesmoPrincipio = (c: ProdutoDoCatalogo) => normalizar(c.principio_ativo) === principio
  if (nome) {
    const porNome = catalogo.filter((c) => normalizar(c.nome_comercial) === nome)
    return porNome.find(mesmoPrincipio) ?? porNome[0]
  }
  if (!principio) return undefined
  // Só o princípio ativo (ou só o nome comercial digitado nele).
  return (
    catalogo.find(mesmoPrincipio) ??
    catalogo.find((c) => normalizar(c.nome_comercial) === principio)
  )
}

/** "100 mL" / "150ml" / "2 L" / "30g" / "5 pts" → quantidade somável. */
export function lerQuantidade(texto: string | null | undefined) {
  const m = (texto ?? '').match(/([\d.,]+)\s*(ml|lts?|l|kg|g|un|pts?)?\b/i)
  if (!m) return {}
  const n = Number(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  if (!Number.isFinite(n)) return {}
  const u = (m[2] ?? '').toLowerCase()
  if (u === 'ml') return { ml: n }
  if (u.startsWith('l')) return { ml: n * 1000 }
  if (u === 'kg') return { g: n * 1000 }
  if (u === 'g') return { g: n }
  return { un: n }
}

const num = (n: number) => n.toLocaleString('pt-BR')

/** "300g" · "450 mL" · "2 un" (mais de uma, juntas com " + "). */
function textoQuantidade(g: number, ml: number, un: number) {
  return [
    g && `${num(g)}g`,
    ml && (ml >= 1000 ? `${num(ml / 1000)} L` : `${num(ml)} mL`),
    un && `${num(un)} un`,
  ]
    .filter(Boolean)
    .join(' + ')
}

/**
 * Todos os produtos citados na OS, um por produto, com a quantidade somada. Os do
 * catálogo trazem registro, lote e datas; o que não está no catálogo entra só com o
 * nome, para o escritório completar.
 */
export function juntarProdutos(
  citados: ProdutoCitado[],
  catalogo: ProdutoDoCatalogo[],
): ProdutoCertificado[] {
  const grupos = new Map<
    string,
    { base: Omit<ProdutoCertificado, 'quantidade'>; g: number; ml: number; un: number }
  >()
  for (const c of citados) {
    const item = acharNoCatalogo(c, catalogo)
    const solto = c.nome_comercial
      ? { nome: c.nome_comercial, principio: c.principio_ativo ?? '' }
      : separarNome(c.principio_ativo ?? '')
    if (!item && !normalizar(solto.principio) && !normalizar(solto.nome)) continue
    const chave = item
      ? `id:${item.id}`
      : `txt:${normalizar(solto.nome)}|${normalizar(solto.principio)}`
    const grupo = grupos.get(chave) ?? {
      base: item
        ? {
            nome_comercial: item.nome_comercial ?? '',
            principio_ativo: item.principio_ativo,
            registro: item.registro ?? '',
            lote: item.lote ?? '',
            fabricacao: item.fabricacao ?? '',
            validade: item.validade ?? '',
          }
        : {
            nome_comercial: solto.nome.trim(),
            principio_ativo: solto.principio.trim(),
            registro: '',
            lote: '',
            fabricacao: '',
            validade: '',
          },
      g: 0,
      ml: 0,
      un: 0,
    }
    const q =
      c.g != null || c.ml != null || c.un != null
        ? { g: c.g ?? 0, ml: c.ml ?? 0, un: c.un ?? 0 }
        : lerQuantidade(c.quantidade)
    grupo.g += q.g ?? 0
    grupo.ml += q.ml ?? 0
    grupo.un += q.un ?? 0
    grupos.set(chave, grupo)
  }
  return [...grupos.values()].map(({ base, g, ml, un }) => ({
    ...base,
    quantidade: textoQuantidade(g, ml, un),
  }))
}
