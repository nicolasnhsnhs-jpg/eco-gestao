import type { OsCompleta } from '../api'
import type { PontoOs } from '../pragasApi'
import {
  PERGUNTA_INSTALADAS,
  PERGUNTA_LIBERACAO_TELAS,
  totalTelas,
  type ChecklistTelas,
  type RespostaSimNao,
} from '../tipos/telas'
import type { EscritorPdf } from './pragasPdf'

/** "Sim", "Não — motivo" ou "—". */
function resposta(r?: RespostaSimNao) {
  if (r?.sim == null) return '—'
  return [r.sim ? 'Sim' : 'Não', r.texto?.trim()].filter(Boolean).join(' — ')
}

/** Seções da entrega de telas no PDF da OS, na ordem da ficha de papel. */
export function escreverTelas(w: EscritorPdf, os: OsCompleta, pontos: PontoOs[]) {
  const c = (os.execucao?.checklist ?? {}) as ChecklistTelas
  const coifas = pontos.filter((p) => p.tipo === 'coifa').sort((a, b) => a.numero - b.numero)

  w.secao('Liberação para instalação de telas')
  w.item(PERGUNTA_LIBERACAO_TELAS.texto, resposta(c.autorizado))

  w.secao('Entrega de telas')
  for (const coifa of coifas) {
    w.campo(
      `${String(coifa.quantidade ?? 1).padStart(2, '0')}× ${coifa.area}`,
      `${coifa.quantidade_telas ?? 0} tela(s)`,
    )
  }
  w.campo('Total', `${totalTelas(coifas)} tela(s)`)

  w.secao('Conferência com o cliente')
  w.item(PERGUNTA_INSTALADAS.texto, resposta(c.instaladas))
}
