import type { Json } from '@/lib/database.types'

/*
 * Ocorrências do escritório na OS (migration 20270119120000_os_varias_ocorrencias.sql).
 * O técnico responde cada uma: sanado (encerra) ou reforço (volta na próxima visita
 * do mesmo serviço até ser sanada).
 */

export type RespostaOcorrencia = 'sanado' | 'reforco'

export type OcorrenciaDaOs = {
  id: string
  texto: string
  criado_em: string
  os_origem_id: string | null
  /** Foto anexada pelo escritório (caminho no Storage). */
  foto_caminho?: string | null
}

export const NOME_RESPOSTA: Record<RespostaOcorrencia, string> = {
  sanado: 'Sanado / resolvido',
  reforco: 'Necessita reforço na próxima visita',
}

/** As ocorrências que vêm junto da OS (os_ocorrencias → ocorrencias), das mais antigas às novas. */
export function ocorrenciasDaOs(os: {
  ocorrencias?: { ocorrencia: OcorrenciaDaOs | null }[] | null
}): OcorrenciaDaOs[] {
  return (os.ocorrencias ?? [])
    .flatMap((l) => (l.ocorrencia ? [l.ocorrencia] : []))
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
}

/** {"<id>": "sanado" | "reforco"} gravado na execução. */
export function respostasDe(valor: Json | null | undefined): Record<string, RespostaOcorrencia> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {}
  const saida: Record<string, RespostaOcorrencia> = {}
  for (const [id, r] of Object.entries(valor)) {
    if (r === 'sanado' || r === 'reforco') saida[id] = r
  }
  return saida
}

/** Alguma ocorrência da OS ainda sem resposta do técnico? */
export function faltaResponder(ids: readonly string[], valor: Json | null | undefined): boolean {
  const r = respostasDe(valor)
  return ids.some((id) => !r[id])
}
