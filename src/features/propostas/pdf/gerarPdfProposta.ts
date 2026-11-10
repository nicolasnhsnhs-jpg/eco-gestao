import fontkit from '@pdf-lib/fontkit'
import {
  degrees,
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from 'pdf-lib'

import { textoSeguro } from '@/features/os/pdf/gerarPdfOs'
import { UNIDADE } from '@/lib/unidade'

import type { DadosPdfProposta } from './dadosPdf'

/*
 * PDF da proposta comercial, no navegador com pdf-lib (como a OS e o certificado).
 * Segue o modelo das propostas em Word: A4 em pé, logo e serviços no alto, cliente
 * ("À …"), apresentação, seções numeradas com faixa verde-clara, assinatura do
 * vendedor e o rodapé da empresa em todas as páginas.
 */

const A4 = { largura: 595.28, altura: 841.89 }
const M = 46
const LARGURA = A4.largura - M * 2
/** Onde o conteúdo termina (acima do rodapé). */
const BASE = 76

const hex = (h: string) =>
  rgb(
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  )

const COR = {
  noite: hex('#0F2A0D'),
  escuro: hex('#1F4D1A'),
  verde: hex('#3E7B1F'),
  lima: hex('#A4D65E'),
  limaClaro: hex('#E6F4D2'),
  texto: hex('#1A2617'),
  suave: hex('#5B6657'),
  borda: hex('#D9E2D2'),
  link: hex('#1F5FAD'),
}

const T = 9.2
const ENTRELINHA = T * 1.42

type Fontes = { normal: PDFFont; medio: PDFFont; negrito: PDFFont; extra: PDFFont }
type Parte = { texto: string; negrito: boolean }

/** "Texto com **negrito**" → partes. */
export function partesRicas(t: string): Parte[] {
  const partes: Parte[] = []
  textoSeguro(t)
    .split('**')
    .forEach((pedaco, i) => {
      if (pedaco) partes.push({ texto: pedaco, negrito: i % 2 === 1 })
    })
  return partes
}

async function carregar(caminho: string) {
  return new Uint8Array(await (await fetch(caminho)).arrayBuffer())
}

// Fontes e logo ficam guardados: a prévia gera o PDF de novo a cada mudança.
let recursos: Promise<Uint8Array[]> | null = null
function recursosPdf() {
  const pasta = '/certificados/fontes/PlusJakartaSans_'
  recursos ??= Promise.all([
    carregar(`${pasta}400Regular.ttf`),
    carregar(`${pasta}600SemiBold.ttf`),
    carregar(`${pasta}700Bold.ttf`),
    carregar(`${pasta}800ExtraBold.ttf`),
    carregar('/certificados/logo.png'),
  ]).catch((e) => {
    recursos = null
    throw e
  })
  return recursos
}

export async function gerarPdfProposta(d: DadosPdfProposta): Promise<Blob> {
  const conf = UNIDADE.proposta
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(`Proposta ${d.numero ?? ''} - ${d.cliente.nome}`.trim())
  pdf.setAuthor(conf.empresa)
  const [normal, medio, negrito, extra, logoBytes] = await recursosPdf()
  const f: Fontes = {
    normal: await pdf.embedFont(normal, { subset: true }),
    medio: await pdf.embedFont(medio, { subset: true }),
    negrito: await pdf.embedFont(negrito, { subset: true }),
    extra: await pdf.embedFont(extra, { subset: true }),
  }
  const logo = await pdf.embedPng(logoBytes)

  // ---------------------------------------------------------------------------
  // Páginas e cursor
  // ---------------------------------------------------------------------------
  let p: PDFPage = pdf.addPage([A4.largura, A4.altura])
  let y = cabecalhoPrimeira(p, f, logo, d)

  function novaPagina() {
    p = pdf.addPage([A4.largura, A4.altura])
    y = cabecalhoContinuacao(p, f, logo, d)
  }
  /** Garante espaço para o que vem (senão passa para a próxima página). */
  function garantir(altura: number) {
    if (y - altura < BASE) novaPagina()
  }

  const fonteDe = (q: Parte) => (q.negrito ? f.negrito : f.normal)

  /**
   * Escreve um parágrafo com trechos em negrito, quebrando as linhas (e as páginas).
   * Justifica todas as linhas menos a última, quando pedido.
   */
  function rico(
    partes: Parte[],
    opcoes: {
      x?: number
      largura?: number
      tamanho?: number
      justificar?: boolean
      alinhar?: 'esquerda' | 'centro'
      cor?: RGB
      antesDaLinha?: (yLinha: number, primeira: boolean) => void
    } = {},
  ) {
    const x0 = opcoes.x ?? M
    const largura = opcoes.largura ?? LARGURA
    const t = opcoes.tamanho ?? T
    const entre = t * 1.42
    type Palavra = Parte[]
    const palavras: Palavra[] = []
    let colar = false
    for (const parte of partes) {
      for (const pedaco of parte.texto.split(/(\s+)/)) {
        if (pedaco === '') continue
        if (/^\s+$/.test(pedaco)) {
          colar = false
          continue
        }
        const novo = { texto: pedaco, negrito: parte.negrito }
        if (colar && palavras.length) palavras[palavras.length - 1].push(novo)
        else palavras.push([novo])
        colar = true
      }
    }
    if (!palavras.length) return
    const larguraDe = (w: Palavra) =>
      w.reduce((s, q) => s + fonteDe(q).widthOfTextAtSize(q.texto, t), 0)
    const espaco = f.normal.widthOfTextAtSize(' ', t)

    let linha: Palavra[] = []
    let ocupado = 0
    let primeira = true
    const escrever = (ultima: boolean) => {
      garantir(entre)
      const soma = linha.reduce((s, w) => s + larguraDe(w), 0)
      const vaos = linha.length - 1
      const folga = opcoes.justificar && !ultima && vaos > 0 ? (largura - soma) / vaos : espaco
      const larguraLinha = soma + vaos * folga
      let x = opcoes.alinhar === 'centro' ? x0 + (largura - larguraLinha) / 2 : x0
      opcoes.antesDaLinha?.(y - t, primeira)
      for (const w of linha) {
        for (const q of w) {
          p.drawText(q.texto, {
            x,
            y: y - t,
            size: t,
            font: fonteDe(q),
            color: opcoes.cor ?? (q.negrito ? COR.noite : COR.texto),
          })
          x += fonteDe(q).widthOfTextAtSize(q.texto, t)
        }
        x += folga
      }
      y -= entre
      linha = []
      ocupado = 0
      primeira = false
    }
    for (const w of palavras) {
      const extraW = (linha.length ? espaco : 0) + larguraDe(w)
      if (linha.length && ocupado + extraW > largura) escrever(false)
      ocupado += (linha.length ? espaco : 0) + larguraDe(w)
      linha.push(w)
    }
    if (linha.length) escrever(true)
  }

  /** Linha com marcador (✓ verde), com recuo. */
  function marcador(textoLinha: string, opcoes: { justificar?: boolean } = {}) {
    rico(partesRicas(textoLinha), {
      x: M + 16,
      largura: LARGURA - 16,
      justificar: opcoes.justificar,
      antesDaLinha: (yl, primeira) => {
        if (primeira) desenharVisto(p, M + 4, yl + 1)
      },
    })
  }

  /** Bloco de texto: linhas com "- " viram marcador; linha vazia vira um respiro. */
  function blocoTexto(textoBloco: string, justificar = true) {
    for (const bruta of textoBloco.split('\n')) {
      const l = bruta.trim()
      if (!l) {
        y -= 4
        continue
      }
      if (/^[-•✓➢>]\s*/.test(l) && l.length > 1)
        marcador(l.replace(/^[-•✓➢>]\s*/, ''), { justificar })
      else rico(partesRicas(l), { justificar })
    }
  }

  let numeroSecao = 0
  function secao(titulo: string) {
    y -= 4
    garantir(17 + ENTRELINHA * 2)
    numeroSecao += 1
    p.drawRectangle({ x: M, y: y - 16, width: LARGURA, height: 16, color: COR.limaClaro })
    p.drawLine({
      start: { x: M, y: y - 16 },
      end: { x: M + LARGURA, y: y - 16 },
      thickness: 0.9,
      color: COR.verde,
    })
    const rotulo = `${numeroSecao}. ${titulo.toUpperCase()}`
    let tam = 9.5
    while (tam > 7 && f.negrito.widthOfTextAtSize(textoSeguro(rotulo), tam) > LARGURA - 12)
      tam -= 0.25
    p.drawText(textoSeguro(rotulo), {
      x: M + 5,
      y: y - 11.6,
      size: tam,
      font: f.negrito,
      color: COR.noite,
    })
    y -= 16 + 5
  }

  // ---------------------------------------------------------------------------
  // Apresentação
  // ---------------------------------------------------------------------------
  y -= 4
  rico(partesRicas(d.introducao), { justificar: true })
  y -= 2

  // Uma seção por serviço
  for (const item of d.itens) {
    secao(item.titulo)
    if (item.escopo.trim()) blocoTexto(item.escopo)
  }

  // Metodologia
  if (d.metodologia.length) {
    secao('Metodologia')
    for (const l of d.metodologia) rico(partesRicas(l), { justificar: true })
  }

  // Recursos
  if (d.recursos.length) {
    secao('Recursos')
    for (const l of d.recursos) marcador(l, { justificar: true })
  }

  // Custos
  secao('Custos')
  for (const l of d.custos) {
    if (l.tipo === 'espaco') {
      y -= 4
      continue
    }
    if (l.tipo === 'marcador') marcador(l.texto)
    else rico(partesRicas(l.texto), { justificar: l.tipo === 'paragrafo' })
  }

  // Assinatura (fica junta)
  y -= 10
  garantir(ENTRELINHA * 4 + 4)
  const assinatura = [
    { texto: 'Atenciosamente,', negrito: false },
    { texto: d.vendedor.nome, negrito: true },
    {
      texto: d.vendedor.telefone ? `Comercial · ${d.vendedor.telefone}` : 'Comercial',
      negrito: false,
    },
    ...(d.vendedor.email ? [{ texto: d.vendedor.email, negrito: false }] : []),
  ]
  for (const a of assinatura) {
    rico([a], { alinhar: 'centro', cor: a.negrito ? COR.noite : COR.texto })
  }

  // ---------------------------------------------------------------------------
  // Rodapé e marca d'água em todas as páginas
  // ---------------------------------------------------------------------------
  const paginas = pdf.getPages()
  paginas.forEach((pg, i) => {
    rodape(pg, f, i + 1, paginas.length)
    if (d.rascunho) {
      pg.drawText('RASCUNHO', {
        x: 130,
        y: 260,
        size: 92,
        font: f.extra,
        color: COR.verde,
        opacity: 0.07,
        rotate: degrees(35),
      })
    }
  })

  const bytes = await pdf.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

// -----------------------------------------------------------------------------
// Cabeçalhos e rodapé
// -----------------------------------------------------------------------------

function escrever(
  p: PDFPage,
  t: string,
  x: number,
  y: number,
  tamanho: number,
  fonte: PDFFont,
  cor: RGB,
  alinhar: 'esquerda' | 'direita' | 'centro' = 'esquerda',
) {
  const s = textoSeguro(t)
  const w = fonte.widthOfTextAtSize(s, tamanho)
  const x0 = alinhar === 'direita' ? x - w : alinhar === 'centro' ? x - w / 2 : x
  p.drawText(s, { x: x0, y, size: tamanho, font: fonte, color: cor })
}

/** Corta o texto com "..." para caber na largura. */
function caber(t: string, fonte: PDFFont, tamanho: number, largura: number) {
  let s = textoSeguro(t)
  if (fonte.widthOfTextAtSize(s, tamanho) <= largura) return s
  while (s.length > 1 && fonte.widthOfTextAtSize(`${s}...`, tamanho) > largura) s = s.slice(0, -1)
  return `${s}...`
}

function cabecalhoPrimeira(p: PDFPage, f: Fontes, logo: PDFImage, d: DadosPdfProposta) {
  const conf = UNIDADE.proposta
  const topo = A4.altura - 36
  // Faixa lima fininha no alto
  p.drawRectangle({ x: 0, y: A4.altura - 6, width: A4.largura, height: 6, color: COR.lima })

  const alturaLogo = 52
  const larguraLogo = (logo.width / logo.height) * alturaLogo
  p.drawImage(logo, { x: M, y: topo - alturaLogo, width: larguraLogo, height: alturaLogo })

  // Serviços da empresa, à direita
  let ys = topo - 9
  for (const s of conf.servicos) {
    escrever(p, s, A4.largura - M, ys, 8.6, f.medio, COR.escuro, 'direita')
    ys -= 10.8
  }

  let y = Math.min(topo - alturaLogo, ys) - 12
  // Local e data · número
  escrever(
    p,
    `${conf.cidade}, ${dataPorExtenso(d.data)}.`,
    A4.largura - M,
    y,
    T,
    f.normal,
    COR.texto,
    'direita',
  )
  escrever(
    p,
    d.numero ? `PROPOSTA Nº ${d.numero}` : 'PROPOSTA (NÚMERO AO SALVAR)',
    M,
    y,
    7.5,
    f.negrito,
    COR.verde,
  )
  y -= 16

  // Cliente
  escrever(p, 'À', M, y, T, f.negrito, COR.noite)
  y -= ENTRELINHA
  for (const l of quebrar(d.cliente.nome.toUpperCase(), f.negrito, 10.5, LARGURA)) {
    escrever(p, l, M, y, 10.5, f.negrito, COR.noite)
    y -= 10.5 * 1.4
  }
  for (const l of d.cliente.linhas) {
    const [rotulo, valor] = l.includes(': ')
      ? [l.slice(0, l.indexOf(': ') + 2), l.slice(l.indexOf(': ') + 2)]
      : ['', l]
    let x = M
    if (rotulo) {
      escrever(p, rotulo, x, y, T, f.medio, COR.suave)
      x += f.medio.widthOfTextAtSize(textoSeguro(rotulo), T)
    }
    const ehEmail = rotulo.startsWith('E-mail')
    escrever(
      p,
      caber(valor, f.normal, T, M + LARGURA - x),
      x,
      y,
      T,
      f.normal,
      ehEmail ? COR.link : COR.texto,
    )
    y -= ENTRELINHA
  }
  return y - 2
}

function cabecalhoContinuacao(p: PDFPage, f: Fontes, logo: PDFImage, d: DadosPdfProposta) {
  p.drawRectangle({ x: 0, y: A4.altura - 6, width: A4.largura, height: 6, color: COR.lima })
  const topo = A4.altura - 30
  const alturaLogo = 32
  const larguraLogo = (logo.width / logo.height) * alturaLogo
  p.drawImage(logo, { x: M, y: topo - alturaLogo, width: larguraLogo, height: alturaLogo })
  escrever(
    p,
    d.numero ? `Proposta nº ${d.numero}` : 'Proposta',
    A4.largura - M,
    topo - 12,
    8.5,
    f.negrito,
    COR.escuro,
    'direita',
  )
  escrever(
    p,
    caber(d.cliente.nome, f.normal, 8, 260),
    A4.largura - M,
    topo - 24,
    8,
    f.normal,
    COR.suave,
    'direita',
  )
  p.drawLine({
    start: { x: M, y: topo - alturaLogo - 8 },
    end: { x: A4.largura - M, y: topo - alturaLogo - 8 },
    thickness: 0.6,
    color: COR.borda,
  })
  return topo - alturaLogo - 20
}

function rodape(p: PDFPage, f: Fontes, pagina: number, total: number) {
  const conf = UNIDADE.proposta
  let y = 26 + (conf.rodape.length - 1) * 9
  p.drawLine({
    start: { x: M, y: y + 22 },
    end: { x: A4.largura - M, y: y + 22 },
    thickness: 0.7,
    color: COR.verde,
  })
  escrever(p, conf.empresa, A4.largura / 2, y + 10, 8.5, f.negrito, COR.noite, 'centro')
  for (const l of conf.rodape) {
    escrever(p, caber(l, f.normal, 7, LARGURA), A4.largura / 2, y, 7, f.normal, COR.suave, 'centro')
    y -= 9
  }
  if (total > 1)
    escrever(
      p,
      `${pagina}/${total}`,
      A4.largura - M,
      y + 9 + (conf.rodape.length - 1) * 9 + 10,
      7,
      f.normal,
      COR.suave,
      'direita',
    )
}

/** Visto (✓) verde desenhado, porque a fonte não tem o caractere. */
function desenharVisto(p: PDFPage, x: number, y: number) {
  p.drawSvgPath('M 0 3.6 L 2.6 6.4 L 7.4 0', {
    x,
    y: y + 7,
    borderColor: COR.verde,
    borderWidth: 1.3,
  })
}

function quebrar(t: string, fonte: PDFFont, tamanho: number, largura: number) {
  const linhas: string[] = []
  let atual = ''
  for (const palavra of textoSeguro(t).split(/\s+/)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) atual = tentativa
    else {
      if (atual) linhas.push(atual)
      atual = palavra
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** "2026-11-09" → "09 de novembro de 2026" */
export function dataPorExtenso(iso: string) {
  const [a, m, dia] = iso.split('-')
  return `${dia} de ${MESES[Number(m) - 1] ?? ''} de ${a}`
}
