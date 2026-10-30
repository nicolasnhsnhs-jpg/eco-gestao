import { rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import { formatarData } from '@/lib/datas'
import { supabase } from '@/lib/supabase'

import type { OsCompleta } from '../api'
import type { InsetoOs, PontoOs, ProdutoOs } from '../pragasApi'
import {
  escreverFaixas,
  ESPECIES,
  FORMAS_PRODUTO,
  NIVEIS,
  PRAGAS_INSETOS,
  PROCEDIMENTOS,
  SITUACOES_ISCA,
  sugerirNivelRoedores,
  type ChecklistPragas,
  type EscopoPragas,
} from '../tipos/pragas'

/*
 * Seções do controle de pragas no PDF da OS. Os porta-iscas saem resumidos por
 * área e código ("MS: 1-18; DT: 7, 9"), não numa tabela de 200 linhas.
 */

export type DadosPragas = { pontos: PontoOs[]; produtos: ProdutoOs[]; insetos: InsetoOs[] }

export async function buscarDadosPragas(osId: string): Promise<DadosPragas> {
  const [pontos, produtos, insetos] = await Promise.all([
    supabase.from('os_pontos').select('*').eq('os_id', osId).order('numero'),
    supabase.from('os_produtos').select('*').eq('os_id', osId).order('criado_em'),
    supabase.from('os_insetos').select('*').eq('os_id', osId).order('criado_em'),
  ])
  for (const r of [pontos, produtos, insetos]) if (r.error) throw r.error
  return { pontos: pontos.data ?? [], produtos: produtos.data ?? [], insetos: insetos.data ?? [] }
}

/** O que o PDF precisa do escritor de páginas (ver gerarPdfOs.ts). */
export type EscritorPdf = {
  pagina: PDFPage
  y: number
  secao: (titulo: string) => void
  campo: (rotulo: string, valor: string | null | undefined) => void
  garantir: (altura: number) => void
}

/** "Expedição (PIE · IP): MS 1-3, 5 · DT 4" — uma linha por área e tipo de isca. */
export function resumoPorArea(pontos: PontoOs[]) {
  const areas = new Map<string, Map<string, number[]>>()
  for (const p of pontos) {
    const chave = `${p.area} (${p.forma_iscagem} · ${p.tipo_isca})`
    const codigos = areas.get(chave) ?? new Map<string, number[]>()
    codigos.set(p.situacao ?? '—', [...(codigos.get(p.situacao ?? '—') ?? []), p.numero])
    areas.set(chave, codigos)
  }
  return [...areas].map(([area, codigos]) => ({
    area,
    texto: [...codigos]
      .map(([codigo, numeros]) => `${codigo} ${escreverFaixas(numeros)}`)
      .join(' · '),
  }))
}

const CORES_PIZZA: Record<string, ReturnType<typeof rgb>> = {
  MS: rgb(0.643, 0.839, 0.369),
  MC: rgb(0.243, 0.482, 0.122),
  CT: rgb(0.122, 0.302, 0.102),
  DT: rgb(0.8, 0.55, 0.15),
  IN: rgb(0.45, 0.65, 0.85),
  SA: rgb(0.6, 0.6, 0.6),
  NE: rgb(0.8, 0.3, 0.3),
}

/** Pizza do consumo da isca parafinada (MS / MC / CT), como na ficha de papel. */
function desenharPizza(w: EscritorPdf, fonte: PDFFont, pontos: PontoOs[]) {
  const parafinadas = pontos.filter((p) => p.tipo_isca === 'IP')
  const total = parafinadas.length
  if (total === 0) return
  // Todas as situações das iscas parafinadas, para a pizza fechar 100%.
  const fatias = (Object.keys(SITUACOES_ISCA) as (keyof typeof SITUACOES_ISCA)[])
    .map((codigo) => ({ codigo, n: parafinadas.filter((p) => p.situacao === codigo).length }))
    .filter((f) => f.n > 0)
  if (fatias.length === 0) return

  w.garantir(110)
  const raio = 42
  const cx = 40 + raio + 10
  const cy = w.y - raio - 6
  let inicio = -Math.PI / 2
  for (const f of fatias) {
    const angulo = (f.n / total) * Math.PI * 2
    if (f.n === total) {
      w.pagina.drawCircle({ x: cx, y: cy, size: raio, color: CORES_PIZZA[f.codigo] })
    } else {
      const fim = inicio + angulo
      const x1 = raio * Math.cos(inicio)
      const y1 = raio * Math.sin(inicio)
      const x2 = raio * Math.cos(fim)
      const y2 = raio * Math.sin(fim)
      const grande = angulo > Math.PI ? 1 : 0
      w.pagina.drawSvgPath(`M 0 0 L ${x1} ${y1} A ${raio} ${raio} 0 ${grande} 1 ${x2} ${y2} Z`, {
        x: cx,
        y: cy,
        color: CORES_PIZZA[f.codigo],
      })
    }
    inicio += angulo
  }
  w.pagina.drawText('Consumo da isca parafinada', {
    x: cx + raio + 24,
    y: cy + 30,
    size: 9.5,
    font: fonte,
    color: rgb(0.122, 0.302, 0.102),
  })
  for (const [i, f] of fatias.entries()) {
    const y = cy + 12 - i * 16
    w.pagina.drawRectangle({
      x: cx + raio + 24,
      y: y - 1,
      width: 9,
      height: 9,
      color: CORES_PIZZA[f.codigo],
    })
    w.pagina.drawText(
      `${f.codigo} · ${SITUACOES_ISCA[f.codigo]}: ${Math.round((f.n / total) * 100)}% (${f.n} de ${total})`,
      { x: cx + raio + 38, y, size: 9, font: fonte },
    )
  }
  w.y -= raio * 2 + 18
}

export function escreverPragas(w: EscritorPdf, fonte: PDFFont, os: OsCompleta, dados: DadosPragas) {
  const escopo = (os.escopo ?? {}) as EscopoPragas
  const checklist = (os.execucao?.checklist ?? {}) as ChecklistPragas
  const portaIscas = dados.pontos.filter((p) => p.tipo === 'porta_isca')
  const armadilhas = dados.pontos.filter((p) => p.tipo === 'armadilha_luminosa')

  w.secao('Controle de roedores')
  w.campo('Pragas alvo', (checklist.pragas_alvo ?? escopo.pragas_alvo ?? []).join(', '))
  const sugestao = sugerirNivelRoedores(portaIscas.map((p) => p.situacao))
  w.campo(
    'Nível de infestação',
    checklist.nivel_infestacao
      ? `${NIVEIS[checklist.nivel_infestacao]} (${sugestao.percentual.toFixed(0)}% das iscas visitadas com consumo)`
      : '',
  )
  w.campo('Porta-iscas', `${portaIscas.length} no total`)
  for (const linha of resumoPorArea(portaIscas)) w.campo(linha.area, linha.texto)
  desenharPizza(w, fonte, portaIscas)
  w.campo('Sem acesso', checklist.sem_acesso)
  w.campo('Quebrados', checklist.quebrados)
  w.campo('Comentários', checklist.comentarios_roedores)

  if (dados.produtos.length > 0) {
    w.secao('Produtos utilizados')
    for (const p of dados.produtos) {
      w.campo(
        p.principio_ativo,
        [
          FORMAS_PRODUTO[p.forma as keyof typeof FORMAS_PRODUTO],
          p.unidades != null && `${p.unidades.toLocaleString('pt-BR')} un`,
          p.gramas != null && `${p.gramas.toLocaleString('pt-BR')} g`,
        ]
          .filter(Boolean)
          .join(' · '),
      )
    }
  }

  if (armadilhas.length > 0) {
    const contrato = escopo.armadilhas_contrato ?? armadilhas.length
    w.secao(
      `Armadilhas luminosas (${contrato} ${contrato === 1 ? 'unidade' : 'unidades'} no contrato)`,
    )
    for (const a of armadilhas) {
      const capturas = Object.entries((a.capturas ?? {}) as Record<string, number>)
        .filter(([, n]) => n > 0)
        .map(([codigo, n]) => `${ESPECIES[codigo as keyof typeof ESPECIES] ?? codigo} ${n}`)
        .join(', ')
      w.campo(
        `${String(a.numero).padStart(2, '0')} · ${a.area}`,
        [
          `modelo ${a.modelo_armadilha}`,
          `última troca de lâmpada ${a.ultima_troca_lampada ? formatarData(a.ultima_troca_lampada) : '—'}`,
          `refil ${a.refil ?? '—'}`,
          `situação ${a.situacao_armadilha ?? '—'}`,
          `lâmpadas trocadas ${a.lampadas_trocadas == null ? '—' : a.lampadas_trocadas ? 'sim' : 'não'}`,
          `higiene ${a.higiene ?? '—'}`,
          `capturas: ${capturas || 'nenhuma'}`,
        ].join(' · '),
      )
    }
    w.campo('Observação', 'Troca de lâmpada com custo à parte.')
  }

  if (escopo.subtipo === 'insetos_roedores') {
    w.secao('Controle de insetos')
    w.campo('Áreas do cliente', escopo.areas_insetos)
    w.campo(
      'Monitoramento',
      checklist.monitoramento_insetos ? 'Realizado nas áreas descritas' : 'Não realizado',
    )
    for (const i of dados.insetos) {
      w.campo(
        i.area,
        [
          PRAGAS_INSETOS[i.praga as keyof typeof PRAGAS_INSETOS],
          i.nivel && `nível ${NIVEIS[i.nivel as keyof typeof NIVEIS]}`,
          i.condicoes,
          i.principio_ativo,
          i.quantidade,
          i.procedimento && PROCEDIMENTOS[i.procedimento as keyof typeof PROCEDIMENTOS],
        ]
          .filter(Boolean)
          .join(' · '),
      )
    }
  }

  w.secao('Observações gerais')
  w.campo(
    'Medidas preventivas',
    checklist.medidas_preventivas == null
      ? ''
      : checklist.medidas_preventivas
        ? `Sim: ${checklist.medidas_descricao ?? ''}`
        : 'Não',
  )
  w.campo('Locais de aplicação', checklist.comentarios_aplicacao)
  w.campo('Solicitações do cliente', checklist.solicitacoes_cliente)
}
