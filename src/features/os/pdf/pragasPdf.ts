import { rgb, type PDFFont, type PDFPage } from 'pdf-lib'

import { formatarData } from '@/lib/datas'
import { supabase } from '@/lib/supabase'

import type { OsCompleta } from '../api'
import { nomeDoProduto, type InsetoOs, type PontoOs, type ProdutoOs } from '../pragasApi'
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
  item: (texto: string, destaque?: string) => void
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

type Fatia = { rotulo: string; n: number; cor: ReturnType<typeof rgb> }

const VERDE_ESCURO = rgb(0.122, 0.302, 0.102)
const CINZA = rgb(0.4, 0.4, 0.4)
const LINHA = rgb(0.82, 0.86, 0.8)

/**
 * Pizza com a tabela ao lado (cor · item · quantidade · %), como na ficha de papel.
 * Fatias zeradas ficam fora da pizza, mas continuam na tabela.
 */
function desenharPizza(
  w: EscritorPdf,
  fonte: PDFFont,
  titulo: string,
  fatias: Fatia[],
  rodape?: string,
) {
  const total = fatias.reduce((soma, f) => soma + f.n, 0)
  if (total === 0) return

  const altLinha = 15
  const altTabela = 18 + (fatias.length + 1) * altLinha + (rodape ? 14 : 0)
  const raio = 42
  w.garantir(Math.max(raio * 2 + 18, altTabela + 10))
  const cx = 40 + raio + 10
  const cy = w.y - raio - 6
  let inicio = -Math.PI / 2
  for (const f of fatias.filter((f) => f.n > 0)) {
    const angulo = (f.n / total) * Math.PI * 2
    if (f.n === total) {
      w.pagina.drawCircle({ x: cx, y: cy, size: raio, color: f.cor })
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
        color: f.cor,
      })
    }
    inicio += angulo
  }

  // Tabela: item à esquerda, quantidade e % alinhadas à direita.
  const x = cx + raio + 24
  const xQtd = x + 250
  const xPct = x + 300
  const topo = w.y - 4
  const direita = (texto: string, xFim: number, y: number) =>
    w.pagina.drawText(texto, {
      x: xFim - fonte.widthOfTextAtSize(texto, 9),
      y,
      size: 9,
      font: fonte,
    })
  w.pagina.drawText(titulo, { x, y: topo - 10, size: 9.5, font: fonte, color: VERDE_ESCURO })
  let y = topo - 10 - altLinha
  w.pagina.drawText('Qtd.', {
    x: xQtd - fonte.widthOfTextAtSize('Qtd.', 8),
    y,
    size: 8,
    font: fonte,
    color: CINZA,
  })
  w.pagina.drawText('%', {
    x: xPct - fonte.widthOfTextAtSize('%', 8),
    y,
    size: 8,
    font: fonte,
    color: CINZA,
  })
  for (const f of fatias) {
    y -= altLinha
    w.pagina.drawRectangle({ x, y: y - 1, width: 9, height: 9, color: f.cor })
    w.pagina.drawText(f.rotulo, { x: x + 14, y, size: 9, font: fonte })
    direita(f.n.toLocaleString('pt-BR'), xQtd, y)
    direita(`${Math.round((f.n / total) * 100)}%`, xPct, y)
  }
  w.pagina.drawLine({
    start: { x, y: y - 4 },
    end: { x: xPct, y: y - 4 },
    thickness: 0.6,
    color: LINHA,
  })
  y -= altLinha + 2
  w.pagina.drawText('Total', { x: x + 14, y, size: 9, font: fonte, color: VERDE_ESCURO })
  direita(total.toLocaleString('pt-BR'), xQtd, y)
  direita('100%', xPct, y)
  if (rodape) {
    y -= 14
    w.pagina.drawText(rodape, { x, y, size: 8, font: fonte, color: CINZA })
  }
  w.y = Math.min(cy - raio - 12, y - 10)
}

/** Pizza do consumo da isca parafinada (MS / MC / CT…). */
function pizzaIscas(w: EscritorPdf, fonte: PDFFont, pontos: PontoOs[]) {
  const parafinadas = pontos.filter((p) => p.tipo_isca === 'IP')
  // Todas as situações das iscas parafinadas, para a pizza fechar 100%.
  const fatias = (Object.keys(SITUACOES_ISCA) as (keyof typeof SITUACOES_ISCA)[])
    .map((codigo) => ({
      rotulo: `${codigo} · ${SITUACOES_ISCA[codigo]}`,
      n: parafinadas.filter((p) => p.situacao === codigo).length,
      cor: CORES_PIZZA[codigo] ?? rgb(0.75, 0.75, 0.75),
    }))
    .filter((f) => f.n > 0)
  desenharPizza(
    w,
    fonte,
    'Consumo da isca parafinada',
    fatias,
    `${parafinadas.length} iscas parafinadas`,
  )
}

const CORES_INSETOS: Record<keyof typeof ESPECIES, ReturnType<typeof rgb>> = {
  M: rgb(0.243, 0.482, 0.122),
  MQ: rgb(0.45, 0.65, 0.85),
  MA: rgb(0.8, 0.55, 0.15),
  B: rgb(0.55, 0.35, 0.2),
}

/** Soma das capturas de todas as armadilhas, por espécie. */
export function totalCapturas(armadilhas: PontoOs[]) {
  const codigos = Object.keys(ESPECIES) as (keyof typeof ESPECIES)[]
  return codigos.map((codigo) => ({
    codigo,
    n: armadilhas.reduce(
      (soma, a) => soma + (Number(((a.capturas ?? {}) as Record<string, unknown>)[codigo]) || 0),
      0,
    ),
  }))
}

/** Pizza e tabela do geral de insetos capturados nas armadilhas luminosas. */
function pizzaInsetos(w: EscritorPdf, fonte: PDFFont, armadilhas: PontoOs[]) {
  const fatias = totalCapturas(armadilhas).map(({ codigo, n }) => ({
    rotulo: ESPECIES[codigo],
    n,
    cor: CORES_INSETOS[codigo],
  }))
  const total = fatias.reduce((soma, f) => soma + f.n, 0)
  if (total === 0) {
    w.campo('Capturas', `Nenhum inseto capturado nas ${armadilhas.length} armadilhas.`)
    return
  }
  const comCaptura = armadilhas.filter((a) =>
    Object.values((a.capturas ?? {}) as Record<string, number>).some((n) => n > 0),
  ).length
  desenharPizza(
    w,
    fonte,
    'Insetos capturados — geral das armadilhas',
    fatias,
    `${comCaptura} de ${armadilhas.length} armadilhas com captura`,
  )
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
  pizzaIscas(w, fonte, portaIscas)
  w.campo('Sem acesso', checklist.sem_acesso)
  w.campo('Quebrados', checklist.quebrados)
  w.campo('Comentários', checklist.comentarios_roedores)

  if (dados.produtos.length > 0) {
    w.secao('Produtos utilizados')
    for (const p of dados.produtos) {
      w.campo(
        nomeDoProduto(p),
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
    w.secao('Capturas nas armadilhas luminosas')
    pizzaInsetos(w, fonte, armadilhas)
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
