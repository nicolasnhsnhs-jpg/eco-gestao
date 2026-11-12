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

export type ContagemPontos = {
  porta_iscas: number
  armadilhas: number
  coifas: number
  bebedouros: number
}

/** Conta os pontos ativos (quando já se tem a lista dos pontos, ex.: na rota). */
export function contarPontos(pontos: { tipo: string; ativo: boolean }[]): ContagemPontos {
  const ativos = pontos.filter((p) => p.ativo)
  const n = (f: (t: string) => boolean) => ativos.filter((p) => f(p.tipo)).length
  return {
    porta_iscas: n((t) => t === 'porta_isca'),
    armadilhas: n((t) => t === 'armadilha_luminosa'),
    coifas: n((t) => t === 'coifa'),
    bebedouros: n((t) => t === 'bebedouro' || t === 'bebedouro_garrafao'),
  }
}

/** "12 porta-iscas · 2 armadilhas" a partir dos pontos do modelo. */
export function contagemPontos(c: ContagemPontos) {
  const { porta_iscas: iscas, armadilhas, coifas, bebedouros } = c
  return [
    iscas && `${iscas} porta-iscas`,
    armadilhas && `${armadilhas} armadilhas`,
    coifas && `${coifas} coifas`,
    bebedouros && `${bebedouros} bebedouros`,
  ].filter(Boolean) as string[]
}
