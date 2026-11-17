import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib'

import { textoSeguro } from '@/features/os/pdf/gerarPdfOs'
import { dataPorExtenso, recursosPdf } from '@/features/propostas/pdf/gerarPdfProposta'
import { UNIDADE } from '@/lib/unidade'

import { lerTextoVisita, type RelatorioMensal } from './montarRelatorio'

/*
 * PDF do relatório técnico mensal (modelo da Naturovos), com o mesmo visual da
 * proposta: logo e serviços no alto, seções numeradas com faixa verde-clara e o
 * rodapé da empresa em todas as páginas. A assinatura escaneada da responsável
 * técnica é a mesma do certificado.
 */

const A4 = { largura: 595.28, altura: 841.89 }
const M = 46
const LARGURA = A4.largura - M * 2
const BASE = 76
const T = 9
const ENTRE = T * 1.42

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
}

/** Cores das barras: instalados, capturados, consumidas, degradadas. */
const CORES_BARRAS = [hex('#3E7B1F'), hex('#C0392B'), hex('#E0A526'), hex('#7A8C99')]

type Fontes = { normal: PDFFont; medio: PDFFont; negrito: PDFFont }
type Parte = { texto: string; negrito: boolean }

export async function gerarPdfRelatorio(
  r: RelatorioMensal,
  assinatura: Uint8Array | null,
): Promise<Blob> {
  const conf = UNIDADE.proposta
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(`${r.titulo} - ${r.cliente}`)
  pdf.setAuthor(conf.empresa)
  const [normal, medio, negrito, , logoBytes] = await recursosPdf()
  const f: Fontes = {
    normal: await pdf.embedFont(normal, { subset: true }),
    medio: await pdf.embedFont(medio, { subset: true }),
    negrito: await pdf.embedFont(negrito, { subset: true }),
  }
  const logo = await pdf.embedPng(logoBytes)

  let p: PDFPage = pdf.addPage([A4.largura, A4.altura])
  let y = cabecalho(p, f, logo, true, r)

  function novaPagina() {
    p = pdf.addPage([A4.largura, A4.altura])
    y = cabecalho(p, f, logo, false, r)
  }
  function garantir(altura: number) {
    if (y - altura < BASE) novaPagina()
  }

  /** Parágrafo com trechos em negrito, quebrando linhas e páginas. */
  function rico(
    partes: Parte[],
    opcoes: {
      x?: number
      largura?: number
      tamanho?: number
      justificar?: boolean
      centro?: boolean
      marcador?: boolean
    } = {},
  ) {
    const x0 = opcoes.x ?? M
    const largura = opcoes.largura ?? LARGURA
    const t = opcoes.tamanho ?? T
    const entre = t * 1.42
    const fonte = (q: Parte) => (q.negrito ? f.negrito : f.normal)
    const palavras: Parte[][] = []
    let colar = false
    for (const parte of partes) {
      for (const pedaco of textoSeguro(parte.texto).split(/(\s+)/)) {
        if (!pedaco) continue
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
    const larguraDe = (w: Parte[]) =>
      w.reduce((s, q) => s + fonte(q).widthOfTextAtSize(q.texto, t), 0)
    const espaco = f.normal.widthOfTextAtSize(' ', t)
    let linha: Parte[][] = []
    let ocupado = 0
    let primeira = true
    const escreverLinha = (ultima: boolean) => {
      garantir(entre)
      const soma = linha.reduce((s, w) => s + larguraDe(w), 0)
      const vaos = linha.length - 1
      const folga = opcoes.justificar && !ultima && vaos > 0 ? (largura - soma) / vaos : espaco
      let x = opcoes.centro ? x0 + (largura - (soma + vaos * folga)) / 2 : x0
      if (opcoes.marcador && primeira)
        p.drawCircle({ x: x0 - 7, y: y - t + 2.6, size: 1.6, color: COR.verde })
      for (const w of linha) {
        for (const q of w) {
          p.drawText(q.texto, {
            x,
            y: y - t,
            size: t,
            font: fonte(q),
            color: q.negrito ? COR.noite : COR.texto,
          })
          x += fonte(q).widthOfTextAtSize(q.texto, t)
        }
        x += folga
      }
      y -= entre
      linha = []
      ocupado = 0
      primeira = false
    }
    for (const w of palavras) {
      const extra = (linha.length ? espaco : 0) + larguraDe(w)
      if (linha.length && ocupado + extra > largura) escreverLinha(false)
      ocupado += (linha.length ? espaco : 0) + larguraDe(w)
      linha.push(w)
    }
    if (linha.length) escreverLinha(true)
  }

  let numeroSecao = 0
  function secao(titulo: string, alturaMinima = ENTRE * 3) {
    y -= 8
    garantir(22 + alturaMinima)
    numeroSecao += 1
    p.drawRectangle({ x: M, y: y - 16, width: LARGURA, height: 16, color: COR.limaClaro })
    p.drawLine({
      start: { x: M, y: y - 16 },
      end: { x: M + LARGURA, y: y - 16 },
      thickness: 0.9,
      color: COR.verde,
    })
    p.drawText(textoSeguro(`${numeroSecao}. ${titulo.toUpperCase()}`), {
      x: M + 5,
      y: y - 11.6,
      size: 9.5,
      font: f.negrito,
      color: COR.noite,
    })
    y -= 16 + 6
  }

  const paragrafos = (texto: string) => {
    for (const l of texto
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)) {
      rico([{ texto: l, negrito: false }], { justificar: true })
      y -= 2
    }
  }

  // ---- Data, título e cliente ----
  escrever(
    p,
    `${UNIDADE.proposta.cidade}, ${dataPorExtenso(r.dataEmissao)}.`,
    A4.largura - M,
    y,
    T,
    f.normal,
    COR.texto,
    'direita',
  )
  y -= 24
  rico([{ texto: r.titulo, negrito: true }], { tamanho: 11.5, centro: true })
  y -= 8
  rico([{ texto: r.cliente, negrito: true }], { tamanho: 10, centro: true })
  if (r.endereco.trim())
    rico([{ texto: r.endereco, negrito: false }], { tamanho: 8.8, centro: true })

  // ---- 1. Objetivo ----
  secao('Objetivo')
  paragrafos(r.objetivo)

  // ---- 2. Condições de controle do sistema: uma entrada por visita ----
  secao('Condições de controle do sistema')
  paragrafos(r.condicoes)
  for (const v of r.visitas) {
    y -= 8
    // Data e equipe não ficam sozinhas no pé da página.
    garantir(ENTRE * 4)
    rico([
      { texto: 'Data: ', negrito: true },
      { texto: v.data, negrito: false },
      { texto: '  |  O.S.: ', negrito: true },
      { texto: v.numero, negrito: false },
    ])
    if (v.equipe.trim())
      rico([
        { texto: 'Equipe em Campo: ', negrito: true },
        { texto: v.equipe, negrito: false },
      ])
    for (const l of lerTextoVisita(v.texto)) {
      const partes: Parte[] = [
        ...(l.titulo ? [{ texto: `${l.titulo} `, negrito: l.tipo === 'paragrafo' }] : []),
        { texto: l.texto, negrito: false },
      ]
      if (l.tipo === 'item')
        rico(partes, { x: M + 22, largura: LARGURA - 22, justificar: true, marcador: true })
      else {
        // Um título ("Controle de Insetos:") não fica sozinho no pé da página.
        garantir(ENTRE * 2)
        rico(partes, { justificar: true })
      }
    }
  }

  // ---- 3. Resultado dos dispositivos de monitoramento ----
  const g = r.grafico
  const temRoedores = g.instalados + g.capturados + g.consumidas + g.degradadas > 0
  const temInsetos = r.capturasInsetos.some((c) => c.n > 0)
  if (temRoedores || temInsetos) {
    secao('Resultado da avaliação dos dispositivos de monitoramento', 190)
    if (temRoedores) {
      y = graficoBarras(
        p,
        f,
        y,
        'Frequência de Roedores e Iscas Substituídas — Pontos de Iscagem',
        [
          { rotulo: 'Instalados', n: g.instalados },
          { rotulo: 'Capturados', n: g.capturados },
          { rotulo: 'Iscas Consumidas', n: g.consumidas },
          { rotulo: 'Iscas Degradadas e Substituídas', n: g.degradadas },
        ],
      )
    }
    if (temInsetos) {
      garantir(180)
      y = graficoBarras(p, f, y, 'Insetos Capturados nas Armadilhas Luminosas', r.capturasInsetos)
    }
  }

  // ---- 4. Produtos ----
  const produtos = r.produtos
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (produtos.length) {
    secao('Relação de produtos e registro na Anvisa')
    for (const l of produtos)
      rico([{ texto: l, negrito: false }], { x: M + 22, largura: LARGURA - 22, marcador: true })
  }

  // ---- 5 e 6 ----
  secao('Parecer conclusivo')
  paragrafos(r.parecer)
  // As considerações finais e a assinatura ficam juntas (a assinatura nunca vai
  // sozinha para uma página nova).
  const linhasAssinatura = UNIDADE.relatorio.assinatura
  const imagem = assinatura ? await pdf.embedPng(assinatura).catch(() => null) : null
  const alturaImagem = imagem ? 46 : 0
  const alturaAssinatura = 18 + alturaImagem + 12 + linhasAssinatura.length * ENTRE
  const linhasConsideracoes = r.consideracoes
    .split('\n')
    .filter((l) => l.trim())
    .reduce(
      (soma, l) =>
        soma + Math.ceil(f.normal.widthOfTextAtSize(textoSeguro(l), T) / (LARGURA * 0.97)),
      0,
    )
  secao('Considerações finais', linhasConsideracoes * ENTRE + alturaAssinatura)
  paragrafos(r.consideracoes)

  // ---- Assinatura da responsável técnica ----
  y -= 18
  garantir(alturaAssinatura - 18)
  if (imagem) {
    const largura = Math.min(160, (imagem.width / imagem.height) * alturaImagem)
    const altura = (imagem.height / imagem.width) * largura
    p.drawImage(imagem, {
      x: (A4.largura - largura) / 2,
      y: y - altura,
      width: largura,
      height: altura,
    })
    y -= altura + 2
  }
  p.drawLine({
    start: { x: A4.largura / 2 - 95, y },
    end: { x: A4.largura / 2 + 95, y },
    thickness: 0.6,
    color: COR.suave,
  })
  y -= 4
  linhasAssinatura.forEach((l, i) =>
    rico([{ texto: l, negrito: i === 0 }], { centro: true, tamanho: 8.8 }),
  )

  // ---- Rodapé em todas as páginas ----
  const paginas = pdf.getPages()
  paginas.forEach((pg, i) => rodape(pg, f, i + 1, paginas.length))

  const bytes = await pdf.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

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

function caber(t: string, fonte: PDFFont, tamanho: number, largura: number) {
  let s = textoSeguro(t)
  if (fonte.widthOfTextAtSize(s, tamanho) <= largura) return s
  while (s.length > 1 && fonte.widthOfTextAtSize(`${s}...`, tamanho) > largura) s = s.slice(0, -1)
  return `${s}...`
}

/** Primeira página: logo e serviços grandes. Nas outras, menor, com o cliente. */
function cabecalho(p: PDFPage, f: Fontes, logo: PDFImage, primeira: boolean, r: RelatorioMensal) {
  p.drawRectangle({ x: 0, y: A4.altura - 6, width: A4.largura, height: 6, color: COR.lima })
  if (primeira) {
    const topo = A4.altura - 36
    const alturaLogo = 52
    const larguraLogo = (logo.width / logo.height) * alturaLogo
    p.drawImage(logo, { x: M, y: topo - alturaLogo, width: larguraLogo, height: alturaLogo })
    let ys = topo - 9
    for (const s of UNIDADE.proposta.servicos) {
      escrever(p, s, A4.largura - M, ys, 8.6, f.medio, COR.escuro, 'direita')
      ys -= 10.8
    }
    return Math.min(topo - alturaLogo, ys) - 14
  }
  const topo = A4.altura - 30
  const alturaLogo = 32
  const larguraLogo = (logo.width / logo.height) * alturaLogo
  p.drawImage(logo, { x: M, y: topo - alturaLogo, width: larguraLogo, height: alturaLogo })
  escrever(
    p,
    'Relatório técnico mensal',
    A4.largura - M,
    topo - 12,
    8.5,
    f.negrito,
    COR.escuro,
    'direita',
  )
  escrever(
    p,
    caber(r.cliente, f.normal, 8, 300),
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
  const topoTexto = y
  for (const l of conf.rodape) {
    escrever(p, caber(l, f.normal, 7, LARGURA), A4.largura / 2, y, 7, f.normal, COR.suave, 'centro')
    y -= 9
  }
  if (total > 1)
    escrever(
      p,
      `${pagina}/${total}`,
      A4.largura - M,
      topoTexto + 10,
      7,
      f.normal,
      COR.suave,
      'direita',
    )
}

/** Gráfico de colunas com o número em cima e o rótulo embaixo. Devolve o novo y. */
function graficoBarras(
  p: PDFPage,
  f: Fontes,
  y: number,
  titulo: string,
  barras: { rotulo: string; n: number }[],
) {
  escrever(p, titulo, A4.largura / 2, y - 10, 9, f.negrito, COR.noite, 'centro')
  const alturaArea = 110
  const base = y - 28 - alturaArea
  const maximo = Math.max(1, ...barras.map((b) => b.n))
  // Escala "redonda" para as linhas de grade (0, 30, 60…).
  const passo = Math.max(1, Math.ceil(maximo / 3 / 5) * 5)
  const topoEscala = passo * Math.ceil(maximo / passo)
  for (let v = 0; v <= topoEscala; v += passo) {
    const yl = base + (v / topoEscala) * alturaArea
    p.drawLine({
      start: { x: M + 24, y: yl },
      end: { x: M + LARGURA, y: yl },
      thickness: 0.4,
      color: COR.borda,
    })
    escrever(p, String(v), M + 18, yl - 3, 7, f.normal, COR.suave, 'direita')
  }
  const larguraCol = (LARGURA - 30) / barras.length
  const larguraBarra = Math.min(54, larguraCol * 0.5)
  barras.forEach((b, i) => {
    const cx = M + 30 + larguraCol * i + larguraCol / 2
    const h = (b.n / topoEscala) * alturaArea
    const cor = CORES_BARRAS[i % CORES_BARRAS.length]
    if (h > 0)
      p.drawRectangle({
        x: cx - larguraBarra / 2,
        y: base,
        width: larguraBarra,
        height: h,
        color: cor,
      })
    escrever(p, b.n.toLocaleString('pt-BR'), cx, base + h + 4, 9, f.negrito, COR.noite, 'centro')
    // Rótulo em até duas linhas embaixo da coluna.
    const palavras = textoSeguro(b.rotulo).split(' ')
    const linhas: string[] = []
    let atual = ''
    for (const w of palavras) {
      const t = atual ? `${atual} ${w}` : w
      if (f.medio.widthOfTextAtSize(t, 7.5) > larguraCol - 6 && atual) {
        linhas.push(atual)
        atual = w
      } else atual = t
    }
    if (atual) linhas.push(atual)
    linhas
      .slice(0, 3)
      .forEach((l, k) => escrever(p, l, cx, base - 11 - k * 9, 7.5, f.medio, COR.texto, 'centro'))
  })
  return base - 42
}
