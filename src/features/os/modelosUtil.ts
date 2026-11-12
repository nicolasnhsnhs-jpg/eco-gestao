import type { CategoriaOs, ModeloResumo } from './api'

export const nomeCliente = (c: { nome: string; nome_fantasia: string | null } | null) =>
  c?.nome_fantasia || c?.nome || '—'

export const nomeUnidade = (e: ModeloResumo['endereco']) =>
  e ? e.apelido || `${e.logradouro}, ${e.numero ?? 's/n'} · ${e.cidade}/${e.uf}` : null

export const linkAgendar = (m: {
  categoria?: CategoriaOs
  cliente_id?: string
  endereco_id?: string | null
  tipo_servico_id?: string
}) =>
  `/os/nova?${new URLSearchParams({
    categoria: m.categoria ?? '',
    cliente: m.cliente_id ?? '',
    unidade: m.endereco_id ?? '',
    tipo: m.tipo_servico_id ?? '',
  })}`

const soDigitos = (t: string) => t.replace(/\D/g, '')

/** Busca por nome fantasia, razão social, CNPJ, unidade ou serviço. */
export function filtrarModelos<T extends ModeloResumo>(lista: T[], busca: string) {
  const termo = busca.trim().toLowerCase()
  const digitos = soDigitos(busca)
  if (!termo) return lista
  return lista.filter(
    (m) =>
      [m.cliente?.nome, m.cliente?.nome_fantasia, m.endereco?.apelido, m.tipo?.nome]
        .filter(Boolean)
        .some((t) => t!.toLowerCase().includes(termo)) ||
      (digitos.length >= 4 && (m.cliente?.cpf_cnpj ?? '').includes(digitos)),
  )
}

/** "12 porta-iscas · 2 armadilhas" a partir dos pontos do modelo. */
export function contagemPontos(pontos: { tipo: string; ativo: boolean }[]) {
  const ativos = pontos.filter((p) => p.ativo)
  const n = (f: (t: string) => boolean) => ativos.filter((p) => f(p.tipo)).length
  const iscas = n((t) => t === 'porta_isca')
  const armadilhas = n((t) => t === 'armadilha_luminosa')
  const coifas = n((t) => t === 'coifa')
  const bebedouros = n((t) => t === 'bebedouro' || t === 'bebedouro_garrafao')
  return [
    iscas && `${iscas} porta-iscas`,
    armadilhas && `${armadilhas} armadilhas`,
    coifas && `${coifas} coifas`,
    bebedouros && `${bebedouros} bebedouros`,
  ].filter(Boolean) as string[]
}
