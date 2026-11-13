import { formatarData } from '@/lib/datas'

import type { OsCompleta } from '../api'
import type { PontoOs } from '../pragasApi'
import {
  FOTOS_APARELHO,
  formatarBtu,
  LIMPEZAS,
  PRODUTO_PADRAO_AR,
  SIM_NAO_NA,
  type ChecklistAr,
  type EscopoAr,
  type SimNaoNa,
} from '../tipos/arCondicionado'
import { etiqueta } from '../tipos/bebedouro'
import type { EscritorPdf } from './pragasPdf'

const simNao = (v: boolean | null) => (v == null ? '—' : v ? 'sim' : 'não')
const limpeza = (v: string | null) => (v ? SIM_NAO_NA[v as SimNaoNa].toLowerCase() : '—')

/** Seções da limpeza de ar-condicionado no PDF da OS, na ordem da ficha de papel. */
export function escreverArCondicionado(w: EscritorPdf, os: OsCompleta, pontos: PontoOs[]) {
  const c = (os.execucao?.checklist ?? {}) as ChecklistAr
  const lista = pontos.filter((p) => p.tipo === 'ar_condicionado')
  const data = os.execucao?.data ? formatarData(os.execucao.data) : '—'

  w.secao(`Limpeza e higienização de aparelhos de ar-condicionado (${lista.length})`)
  // Duas ou três linhas por aparelho (a OS pode ter 20 aparelhos).
  for (const a of lista) {
    w.campo(
      `Aparelho ${etiqueta(a.numero)}`,
      [a.area, formatarBtu(a.btu), a.marca, a.numero_serie && `série ${a.numero_serie}`]
        .filter(Boolean)
        .join(' · '),
    )
    w.item(
      [
        `Anterior ${a.ultima_limpeza ? formatarData(a.ultima_limpeza) : '—'} · limpeza ${data}`,
        ...LIMPEZAS.map((l) => `${l.curto}: ${limpeza(a[l.campo])}`),
        ...FOTOS_APARELHO.map((f) => `${f.curto}: ${simNao(a[f.campo])}`),
      ].join(' · '),
    )
    if (a.observacao?.trim()) w.item('Não conformidade:', a.observacao.trim())
  }

  w.secao('Produto utilizado')
  w.campo('Produto', ((os.escopo ?? {}) as EscopoAr).produto || PRODUTO_PADRAO_AR)
  w.campo('Quantidade utilizada', c.produto_ml != null ? `${c.produto_ml} ml` : '—')
}
