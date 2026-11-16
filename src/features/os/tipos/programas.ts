/*
 * Produtos programados: aplicações que o escritório já deixa prontas na O.S de
 * contrato (ex.: "Profilaxia e higiene" da Neovia), com o produto, o princípio
 * ativo e as dosagens possíveis (QNT e calda). Na visita o técnico só marca (X)
 * a dosagem usada, o nível de infestação e as condições das áreas.
 *
 * Fica no escopo da OS e do modelo (escopo.programas); o que o técnico marca fica
 * em os_execucao.checklist.programas.
 */

import type { Nivel } from './pragas'

export type DoseProgramada = { qnt: string; calda?: string; alvo?: string }

export type ProdutoProgramado = {
  id: string
  nome_comercial: string
  principio_ativo: string
  /** "H²O", "Óleo", "Pronto uso"… */
  diluente?: string
  /** "(Atom.) / (Pulv.)", "Pulverizado"… */
  procedimento?: string
  /** "baratas, pulgas e moscas" */
  alvos?: string
  doses: DoseProgramada[]
}

export type ProgramaAplicacao = {
  id: string
  titulo: string
  areas?: string
  produtos: ProdutoProgramado[]
}

export type MarcacaoPrograma = {
  nivel?: Nivel
  condicoes?: string
  /** Dosagens marcadas: "produtoId:índice". */
  doses?: string[]
}

export type EscopoProgramas = { programas?: ProgramaAplicacao[] }
export type ChecklistProgramas = { programas?: Record<string, MarcacaoPrograma> }

export const chaveDose = (produtoId: string, indice: number) => `${produtoId}:${indice}`

/** "100ml = 10lts (baratas)" → { qnt: "100ml", calda: "10lts", alvo: "baratas" } */
export function lerDose(linha: string): DoseProgramada | null {
  const texto = linha.trim()
  if (!texto) return null
  const alvo = /\(([^)]*)\)\s*$/.exec(texto)
  const semAlvo = alvo ? texto.slice(0, alvo.index).trim() : texto
  const [qnt, calda] = semAlvo.split('=').map((p) => p.trim())
  if (!qnt) return null
  return {
    qnt,
    ...(calda ? { calda } : {}),
    ...(alvo?.[1].trim() ? { alvo: alvo[1].trim() } : {}),
  }
}

/** O inverso de lerDose, uma por linha. */
export const escreverDoses = (doses: DoseProgramada[]) =>
  doses
    .map((d) =>
      [d.qnt, d.calda && `= ${d.calda}`, d.alvo && `(${d.alvo})`].filter(Boolean).join(' '),
    )
    .join('\n')

/** "DDVP (Diclorvós): 150ml em 15lts H²O · (Atom.) / (Pulv.)" — o que foi marcado. */
export function dosesMarcadas(programa: ProgramaAplicacao, marcacao: MarcacaoPrograma | undefined) {
  const marcadas = new Set(marcacao?.doses ?? [])
  return programa.produtos.flatMap((p) =>
    p.doses
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => marcadas.has(chaveDose(p.id, i)))
      .map(({ d }) => ({
        produto: p,
        dose: d,
        texto: [
          `${p.nome_comercial} (${p.principio_ativo}): ${d.qnt}`,
          d.calda && `em ${d.calda}`,
          p.diluente,
          d.alvo && `— ${d.alvo}`,
          p.procedimento && `· ${p.procedimento}`,
        ]
          .filter(Boolean)
          .join(' '),
      })),
  )
}
