/**
 * Os textos livres que o técnico escreveu na OS (para o escritório corrigir o
 * português depois de concluída). Só texto: códigos e números ficam de fora.
 */

type Onde =
  | { tipo: 'execucao'; campo: 'observacoes' | 'resultado' | 'motivo_nao_realizado' }
  | { tipo: 'checklist'; caminho: string[] }
  | { tipo: 'ponto'; id: string }

export type TextoDaOs = { chave: string; rotulo: string; valor: string; onde: Onde }

const EXECUCAO = {
  resultado: 'Resultado do serviço',
  observacoes: 'Observações',
  motivo_nao_realizado: 'Motivo de não ter realizado',
} as const

/** Campos de texto livre do checklist (os outros são códigos ou sim/não). */
const CHECKLIST: Record<string, string> = {
  comentarios_roedores: 'Comentários (roedores)',
  sem_acesso: 'Sem acesso',
  quebrados: 'Quebrados',
  medidas_descricao: 'Medidas preventivas',
  comentarios_aplicacao: 'Locais de aplicação',
  solicitacoes_cliente: 'Solicitações do cliente',
  envelope_responsavel: 'Envelope: responsável',
  envelope_documentos: 'Envelope: documentos',
}

const humanizar = (chave: string) => {
  const t = chave.replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const temTexto = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

export function textosDaOs(
  execucao:
    | {
        resultado?: string | null
        observacoes?: string | null
        motivo_nao_realizado?: string | null
        checklist?: unknown
      }
    | null
    | undefined,
  pontos: { id: string; numero: number; area: string; observacao?: string | null }[],
): TextoDaOs[] {
  const textos: TextoDaOs[] = []
  if (!execucao) return textos
  for (const campo of Object.keys(EXECUCAO) as (keyof typeof EXECUCAO)[]) {
    const valor = execucao[campo]
    if (temTexto(valor))
      textos.push({
        chave: campo,
        rotulo: EXECUCAO[campo],
        valor,
        onde: { tipo: 'execucao', campo },
      })
  }

  const checklist =
    execucao.checklist && typeof execucao.checklist === 'object'
      ? (execucao.checklist as Record<string, unknown>)
      : {}
  for (const [chave, valor] of Object.entries(checklist)) {
    if (chave in CHECKLIST && temTexto(valor)) {
      textos.push({
        chave: `checklist.${chave}`,
        rotulo: CHECKLIST[chave],
        valor,
        onde: { tipo: 'checklist', caminho: [chave] },
      })
    }
    // Perguntas sim/não com comentário: { sim: false, texto: "..." }.
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      const texto = (valor as Record<string, unknown>).texto
      if (temTexto(texto))
        textos.push({
          chave: `checklist.${chave}.texto`,
          rotulo: `${CHECKLIST[chave] ?? humanizar(chave)} (comentário)`,
          valor: texto,
          onde: { tipo: 'checklist', caminho: [chave, 'texto'] },
        })
    }
  }

  for (const p of [...pontos].sort((a, b) => a.numero - b.numero)) {
    if (temTexto(p.observacao))
      textos.push({
        chave: `ponto.${p.id}`,
        rotulo: `Obs. do ponto ${String(p.numero).padStart(2, '0')} · ${p.area}`,
        valor: p.observacao,
        onde: { tipo: 'ponto', id: p.id },
      })
  }
  return textos
}
