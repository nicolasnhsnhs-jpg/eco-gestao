import { formatarData } from '@/lib/datas'

import type { OsCompleta } from '../api'
import type { PontoOs } from '../pragasApi'
import {
  PARAMETROS_PADRAO,
  PERGUNTA_REFRIGERADAS,
  quantosPontos,
  type ChecklistAgua,
  type EscopoAgua,
} from '../tipos/agua'
import type { EscritorPdf } from './pragasPdf'

/** Seções da coleta de água no PDF da OS, na ordem da ficha de papel. */
export function escreverAgua(w: EscritorPdf, os: OsCompleta, pontos: PontoOs[]) {
  const c = (os.execucao?.checklist ?? {}) as ChecklistAgua
  const escopo = (os.escopo ?? {}) as EscopoAgua
  const lista = pontos.filter((p) => p.tipo === 'ponto_coleta')

  w.secao('Monitoramento de águas · coleta para análise')
  w.campo('Procedimento de coleta', c.procedimento ? 'Seguido' : '—')
  w.campo('Quantidade de pontos', quantosPontos(lista.length))
  w.campo('Parâmetros', escopo.parametros || PARAMETROS_PADRAO)
  if (escopo.frascos) w.campo('Frascos', escopo.frascos)

  w.secao('Pontos de coleta')
  for (const p of lista) {
    w.campo(
      `${String(p.numero).padStart(2, '0')} · ${p.area}`,
      [
        p.coletado == null
          ? 'coleta —'
          : p.coletado
            ? `coletado às ${p.hora_coleta?.slice(0, 5) ?? '—'}`
            : 'não coletado',
        p.ultima_limpeza && `anterior ${formatarData(p.ultima_limpeza)}`,
        p.observacao?.trim(),
      ]
        .filter(Boolean)
        .join(' · '),
    )
  }

  w.secao('Amostras')
  const r = c.refrigeradas
  w.item(
    PERGUNTA_REFRIGERADAS.texto,
    r?.sim == null ? '—' : [r.sim ? 'Sim' : 'Não', r.texto?.trim()].filter(Boolean).join(' — '),
  )
}
