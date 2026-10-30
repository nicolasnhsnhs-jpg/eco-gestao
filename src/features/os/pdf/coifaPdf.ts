import type { OsCompleta } from '../api'
import type { PontoOs } from '../pragasApi'
import {
  AVISO_DESLOCAMENTO,
  CONDICOES_AMBIENTE,
  ESCOAMENTO,
  FOTOS_DEPOIS,
  INFORMACOES_TECNICAS,
  MATERIAIS,
  PERGUNTAS_CONFERENCIA,
  PERGUNTAS_LIBERACAO,
  PRODUTO_PADRAO,
  SUJIDADE,
  type ChecklistCoifa,
  type EscopoCoifa,
  type RespostaSimNao,
} from '../tipos/coifa'
import type { EscritorPdf } from './pragasPdf'

/** "Sim", "Não — motivo" ou "—". */
function resposta(r?: RespostaSimNao) {
  if (r?.sim == null) return '—'
  return [r.sim ? 'Sim' : 'Não', r.texto?.trim()].filter(Boolean).join(' — ')
}

/** Seções da limpeza de coifa no PDF da OS, na ordem da ficha de papel. */
export function escreverCoifa(w: EscritorPdf, os: OsCompleta, pontos: PontoOs[]) {
  const c = (os.execucao?.checklist ?? {}) as ChecklistCoifa
  const liberacao = c.liberacao ?? {}
  const coifas = pontos.filter((p) => p.tipo === 'coifa')

  w.secao('Liberação para trabalho')
  for (const p of PERGUNTAS_LIBERACAO) w.item(p.texto, resposta(liberacao[p.campo]))
  w.campo(
    'Ambiente',
    liberacao.condicoes
      ? `${liberacao.condicoes} · ${CONDICOES_AMBIENTE[liberacao.condicoes]}`
      : '',
  )
  w.campo(
    'Escoamento do piso',
    [liberacao.escoamento && ESCOAMENTO[liberacao.escoamento], liberacao.escoamento_obs]
      .filter(Boolean)
      .join(' — '),
  )
  w.campo('Atenção', AVISO_DESLOCAMENTO)

  w.secao('Limpeza e higienização de coifa industrial')
  for (const coifa of coifas) {
    w.campo(
      `${coifa.quantidade ?? 1}× ${coifa.area}`,
      [
        MATERIAIS[coifa.material as keyof typeof MATERIAIS],
        `sujidade ${coifa.sujidade ? SUJIDADE[coifa.sujidade as keyof typeof SUJIDADE] : '—'}`,
        `${coifa.quantidade_telas ?? 0} tela(s)`,
        `foto antes: ${coifa.foto_antes == null ? '—' : coifa.foto_antes ? 'sim' : 'não'}`,
      ].join(' · '),
    )
  }
  w.campo(
    'Telas retiradas',
    c.telas_retiradas?.sim == null
      ? ''
      : c.telas_retiradas.sim
        ? `Sim, ${c.telas_retiradas.quantidade ?? '?'} para higienização na empresa`
        : 'Não',
  )
  w.campo(
    'Fotos depois',
    Object.entries(FOTOS_DEPOIS)
      .filter(([campo]) => c.fotos_depois?.[campo as keyof typeof FOTOS_DEPOIS])
      .map(([, nome]) => nome)
      .join(', '),
  )

  w.secao('Produto utilizado')
  w.campo('Produto', ((os.escopo ?? {}) as EscopoCoifa).produto ?? PRODUTO_PADRAO)
  w.campo('Quantidade', c.produto_ml != null ? `${c.produto_ml.toLocaleString('pt-BR')} ml` : '')

  w.secao('Conferência com o cliente')
  for (const p of PERGUNTAS_CONFERENCIA) w.item(p.texto, resposta(c.conferencia?.[p.campo]))

  w.secao('Informações técnicas')
  for (const linha of INFORMACOES_TECNICAS) w.item(`• ${linha}`)
}
