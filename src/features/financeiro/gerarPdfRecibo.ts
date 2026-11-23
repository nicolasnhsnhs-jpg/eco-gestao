import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, PDFName, degrees, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'

import { textoSeguro } from '@/features/os/pdf/gerarPdfOs'
import { dataPorExtenso, recursosPdf } from '@/features/propostas/pdf/gerarPdfProposta'
import { formatarReais } from '@/lib/dinheiro'
import { reaisPorExtenso } from '@/lib/extenso'
import { UNIDADE } from '@/lib/unidade'

/*
 * PDF do recibo (Financeiro > Recibos), com o visual da proposta: logo e serviços no
 * alto, o número e o valor em destaque, o texto "Recebemos de..." com o valor por
 * extenso, a cidade e a data, a linha de assinatura com a empresa e o rodapé.
 * Cabe sempre numa página só (a descrição longa é cortada no limite de linhas).
 */

export type DadosPdfRecibo = {
  numero: number
  data: string
  pagadorNome: string
  pagadorDocumento: string | null
  descricao: string
  valor: number
  formaPagamento: string | null
  observacoes: string | null
  cancelado?: boolean
  /** Deixa o lugar do carimbo da assinatura digital (o servidor desenha ao assinar). */
  assinaturaDigital?: boolean
}

/** Onde o PDF diz ao servidor o lugar do carimbo: [x, y, largura, altura]. Igual a _shared/assinarPdf.ts. */
const CHAVE_CARIMBO = 'EcoCarimboAssinatura'
const ALTURA_CARIMBO = 44

const A4 = { largura: 595.28, altura: 841.89 }
const M = 56
const LARGURA = A4.largura - M * 2

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
  perigo: hex('#C0392B'),
}

type Fontes = { normal: PDFFont; medio: PDFFont; negrito: PDFFont; extra: PDFFont }
type Parte = { texto: string; negrito: boolean }

export function numeroRecibo(n: number) {
  return String(n).padStart(4, '0')
}

export async function gerarPdfRecibo(d: DadosPdfRecibo): Promise<Blob> {
  const conf = UNIDADE.proposta
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(`Recibo ${numeroRecibo(d.numero)} - ${d.pagadorNome}`)
  pdf.setAuthor(conf.empresa)
  const [normal, medio, negrito, extra, logoBytes] = await recursosPdf()
  const f: Fontes = {
    normal: await pdf.embedFont(normal, { subset: true }),
    medio: await pdf.embedFont(medio, { subset: true }),
    negrito: await pdf.embedFont(negrito, { subset: true }),
    extra: await pdf.embedFont(extra, { subset: true }),
  }
  const logo = await pdf.embedPng(logoBytes)
  const p = pdf.addPage([A4.largura, A4.altura])

  // Cabeçalho: faixa lima, logo à esquerda e serviços à direita.
  p.drawRectangle({ x: 0, y: A4.altura - 6, width: A4.largura, height: 6, color: COR.lima })
  const topo = A4.altura - 36
  const alturaLogo = 52
  const larguraLogo = (logo.width / logo.height) * alturaLogo
  p.drawImage(logo, { x: M, y: topo - alturaLogo, width: larguraLogo, height: alturaLogo })
  let ys = topo - 9
  for (const s of conf.servicos) {
    escrever(p, s, A4.largura - M, ys, 8.6, f.medio, COR.escuro, 'direita')
    ys -= 10.8
  }
  let y = Math.min(topo - alturaLogo, ys) - 34

  // Título e valor em destaque.
  escrever(p, 'RECIBO', M, y - 20, 26, f.extra, COR.noite)
  escrever(p, `Nº ${numeroRecibo(d.numero)}`, M, y - 38, 11, f.medio, COR.suave)
  const valorTexto = formatarReais(d.valor)
  const larguraCaixa = Math.max(170, f.extra.widthOfTextAtSize(valorTexto, 20) + 36)
  p.drawRectangle({
    x: A4.largura - M - larguraCaixa,
    y: y - 46,
    width: larguraCaixa,
    height: 50,
    color: COR.limaClaro,
    borderColor: COR.verde,
    borderWidth: 1,
  })
  escrever(p, 'VALOR', A4.largura - M - larguraCaixa / 2, y - 12, 8, f.negrito, COR.verde, 'centro')
  escrever(
    p,
    valorTexto,
    A4.largura - M - larguraCaixa / 2,
    y - 36,
    20,
    f.extra,
    COR.noite,
    'centro',
  )
  y -= 76

  p.drawLine({
    start: { x: M, y },
    end: { x: A4.largura - M, y },
    thickness: 0.7,
    color: COR.borda,
  })
  y -= 30

  // Corpo: "Recebemos de ..., a importância de R$ X (por extenso), referente a ...".
  const doc = d.pagadorDocumento?.trim()
  const descricao = d.descricao.trim().replace(/\.+$/, '')
  const partes: Parte[] = [
    { texto: 'Recebemos de ', negrito: false },
    { texto: d.pagadorNome.trim(), negrito: true },
    ...(doc
      ? [
          { texto: `, ${rotuloDocumento(doc)} `, negrito: false },
          { texto: doc, negrito: true },
        ]
      : []),
    { texto: ', a importância de ', negrito: false },
    { texto: valorTexto, negrito: true },
    { texto: ` (${reaisPorExtenso(d.valor)}), referente a `, negrito: false },
    { texto: descricao, negrito: true },
    { texto: '.', negrito: false },
  ]
  y = paragrafo(p, f, partes, y, 12, 22)

  if (d.formaPagamento?.trim()) {
    y -= 8
    y = paragrafo(
      p,
      f,
      [
        { texto: 'Forma de pagamento: ', negrito: false },
        { texto: d.formaPagamento.trim(), negrito: true },
      ],
      y,
      11,
      4,
    )
  }
  if (d.observacoes?.trim()) {
    y -= 8
    y = paragrafo(p, f, [{ texto: d.observacoes.trim(), negrito: false }], y, 10, 6, COR.suave)
  }

  y -= 14
  y = paragrafo(
    p,
    f,
    [
      {
        texto:
          'Para maior clareza, firmamos o presente recibo, dando plena quitação do valor acima.',
        negrito: false,
      },
    ],
    y,
    11,
    4,
  )

  // Cidade e data, assinatura.
  y = Math.min(y - 34, 330)
  escrever(
    p,
    `${UNIDADE.cidade}/${UNIDADE.uf}, ${dataPorExtenso(d.data)}.`,
    A4.largura - M,
    y,
    11,
    f.normal,
    COR.texto,
    'direita',
  )
  y -= 90
  const meio = A4.largura / 2
  p.drawLine({
    start: { x: meio - 150, y },
    end: { x: meio + 150, y },
    thickness: 0.8,
    color: COR.texto,
  })
  escrever(p, conf.empresa, meio, y - 15, 10, f.negrito, COR.noite, 'centro')
  escrever(p, `CNPJ ${UNIDADE.cnpj}`, meio, y - 28, 9, f.normal, COR.suave, 'centro')
  // Assinatura digital: o carimbo (quem assinou, CNPJ, data e hora) fica embaixo do nome.
  if (d.assinaturaDigital && !d.cancelado) {
    pdf.catalog.set(
      PDFName.of(CHAVE_CARIMBO),
      pdf.context.obj([meio - 115, y - 42 - ALTURA_CARIMBO, 230, ALTURA_CARIMBO]),
    )
  }

  if (d.cancelado) {
    p.drawText('CANCELADO', {
      x: 120,
      y: 360,
      size: 80,
      font: f.extra,
      color: COR.perigo,
      opacity: 0.18,
      rotate: degrees(35),
    })
  }

  rodape(p, f)
  const bytes = await pdf.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

function rotuloDocumento(doc: string) {
  const n = doc.replace(/\D/g, '')
  return n.length === 14 ? 'inscrita no CNPJ sob nº' : n.length === 11 ? 'CPF nº' : 'documento nº'
}

/** Parágrafo justificado com trechos em negrito. Devolve o novo y. */
function paragrafo(
  p: PDFPage,
  f: Fontes,
  partes: Parte[],
  y: number,
  t: number,
  maxLinhas: number,
  cor: RGB = COR.texto,
) {
  const entre = t * 1.6
  const fonte = (q: Parte) => (q.negrito ? f.negrito : f.normal)
  // Palavras (uma palavra pode juntar trechos normais e em negrito, como "nome,").
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
  const larguraDe = (w: Parte[]) =>
    w.reduce((s, q) => s + fonte(q).widthOfTextAtSize(q.texto, t), 0)
  const espaco = f.normal.widthOfTextAtSize(' ', t)
  const linhas: Parte[][][] = []
  let linha: Parte[][] = []
  let ocupado = 0
  for (const w of palavras) {
    const lw = larguraDe(w)
    if (linha.length && ocupado + espaco + lw > LARGURA) {
      linhas.push(linha)
      linha = []
      ocupado = 0
    }
    ocupado += (linha.length ? espaco : 0) + lw
    linha.push(w)
  }
  if (linha.length) linhas.push(linha)
  const usar = linhas.slice(0, maxLinhas)
  usar.forEach((l, i) => {
    const ultima = i === usar.length - 1
    const soma = l.reduce((s, w) => s + larguraDe(w), 0)
    const vaos = l.length - 1
    const folga = !ultima && vaos > 0 ? (LARGURA - soma) / vaos : espaco
    let x = M
    for (const w of l) {
      for (const q of w) {
        p.drawText(q.texto, {
          x,
          y: y - t,
          size: t,
          font: fonte(q),
          color: q.negrito ? COR.noite : cor,
        })
        x += fonte(q).widthOfTextAtSize(q.texto, t)
      }
      x += folga
    }
    y -= entre
  })
  return y
}

function rodape(p: PDFPage, f: Fontes) {
  const conf = UNIDADE.proposta
  let y = 30 + (conf.rodape.length - 1) * 9
  p.drawLine({
    start: { x: M, y: y + 22 },
    end: { x: A4.largura - M, y: y + 22 },
    thickness: 0.7,
    color: COR.verde,
  })
  escrever(p, conf.empresa, A4.largura / 2, y + 10, 8.5, f.negrito, COR.noite, 'centro')
  for (const l of conf.rodape) {
    escrever(
      p,
      caber(l, f.normal, 7, A4.largura - 60),
      A4.largura / 2,
      y,
      7,
      f.normal,
      COR.suave,
      'centro',
    )
    y -= 9
  }
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
