import { formatarData } from '@/lib/datas'

import type { OsCompleta } from '../api'
import type { PontoOs } from '../pragasApi'
import {
  etiqueta,
  PERGUNTAS_CONFERENCIA_BEBEDOURO,
  TIPOS_BEBEDOURO,
  TRABALHO,
  type ChecklistBebedouro,
  type RespostaSimNao,
  type TipoBebedouro,
} from '../tipos/bebedouro'
import type { EscritorPdf } from './pragasPdf'

/** "Sim", "Não — motivo" ou "—". */
function resposta(r?: RespostaSimNao) {
  if (r?.sim == null) return '—'
  return [r.sim ? 'Sim' : 'Não', r.texto?.trim()].filter(Boolean).join(' — ')
}

const simNao = (v: boolean | null) => (v == null ? '—' : v ? 'sim' : 'não')

/** Seções da limpeza de bebedouros no PDF da OS, na ordem da ficha de papel. */
export function escreverBebedouro(w: EscritorPdf, os: OsCompleta, pontos: PontoOs[]) {
  const c = (os.execucao?.checklist ?? {}) as ChecklistBebedouro

  w.secao('Limpeza e sanitização de bebedouros')
  w.campo('Trabalho', c.trabalho ? TRABALHO[c.trabalho] : '')

  for (const tipo of Object.keys(TIPOS_BEBEDOURO) as TipoBebedouro[]) {
    const lista = pontos.filter((p) => p.tipo === tipo)
    if (lista.length === 0) continue
    w.secao(TIPOS_BEBEDOURO[tipo].titulo)
    for (const b of lista) {
      w.campo(
        `${etiqueta(b.numero)} · ${b.area}`,
        [
          b.codigo_filtro && `filtro ${b.codigo_filtro}`,
          `anterior ${b.ultima_limpeza ? formatarData(b.ultima_limpeza) : '—'}`,
          b.limpo == null ? 'limpeza —' : b.limpo ? 'Ok!' : 'não limpo',
          `troca de filtro: ${simNao(b.filtro_trocado)}`,
          b.observacao?.trim(),
        ]
          .filter(Boolean)
          .join(' · '),
      )
    }
  }

  w.secao('Conferência com o cliente')
  for (const p of PERGUNTAS_CONFERENCIA_BEBEDOURO)
    w.item(p.texto, resposta(c.conferencia?.[p.campo]))
}
