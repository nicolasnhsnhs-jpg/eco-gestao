import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, type PDFPage } from 'pdf-lib'

import { quebrarLinhas } from '@/features/os/pdf/gerarPdfOs'
import { formatarData } from '@/lib/datas'
import { UNIDADE } from '@/lib/unidade'

import { carregar, cartao, COR, rotulo, texto, type Fontes } from './aprPdf'
import type { Comunicacao } from './comunicacaoApi'
import { itensDaSecao, lerConteudo, preencher } from './comunicacaoModelos'

/*
 * PDF da comunicação de serviço, no navegador, no visual do certificado e da APR,
 * em pé (A4 retrato):
 *
 *   logo · "comunicação de serviço" e a data
 *   faixa verde: título · subtítulo
 *   cliente, data e horário, local, contato
 *   texto de abertura · técnicos autorizados (nome, RG, CPF) e veículo
 *   seções (lista, numerada, texto ou quadro de destaque) · fechamento · SAC
 *   rodapé da empresa e "página x de y"
 */

const A4 = { largura: 595.28, altura: 841.89 }
const M = 44
const LARGURA = A4.largura - M * 2
const MOLDURA = 16
/** Abaixo disto é o rodapé. */
const BASE = 74
const T = 9.6
const LH = 12.8

export async function gerarPdfComunicacao(c: Comunicacao): Promise<Blob> {
  const conteudo = lerConteudo(c.conteudo)
  const dados = { cliente: c.cliente_nome, data: c.data }
  const p_ = (t: string) => preencher(t, dados)

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(`Comunicação de serviço - ${c.cliente_nome}`)
  pdf.setAuthor(UNIDADE.nome)
  const pasta = '/certificados/fontes/PlusJakartaSans_'
  const [normal, medio, negrito, extra, logoBytes] = await Promise.all([
    carregar(`${pasta}400Regular.ttf`),
    carregar(`${pasta}600SemiBold.ttf`),
    carregar(`${pasta}700Bold.ttf`),
    carregar(`${pasta}800ExtraBold.ttf`),
    carregar('/certificados/logo.png'),
  ])
  const f: Fontes = {
    normal: await pdf.embedFont(normal, { subset: true }),
    medio: await pdf.embedFont(medio, { subset: true }),
    negrito: await pdf.embedFont(negrito, { subset: true }),
    extra: await pdf.embedFont(extra, { subset: true }),
  }
  const logo = await pdf.embedPng(logoBytes)

  const paginas: PDFPage[] = []
  let p!: PDFPage
  let y = 0

  function novaPagina() {
    p = pdf.addPage([A4.largura, A4.altura])
    paginas.push(p)
    cartao(p, MOLDURA, MOLDURA, A4.largura - MOLDURA * 2, A4.altura - MOLDURA * 2, 16, {
      borda: COR.borda,
      espessura: 1,
    })
    cartao(p, A4.largura / 2 - 50, A4.altura - MOLDURA - 1.5, 100, 3, 1.5, { cor: COR.lima })
    y = A4.altura - 40
    if (paginas.length > 1) {
      const h = 24
      p.drawImage(logo, { x: M, y: y - h, width: (logo.width / logo.height) * h, height: h })
      texto(p, c.cliente_nome, A4.largura - M, y - 14, 8, f.medio, COR.suave, 'direita')
      y -= h + 16
    }
  }

  /** Garante espaço; senão, vira a página. */
  function espaco(altura: number) {
    if (y - altura < BASE) novaPagina()
  }

  /** Parágrafos (uma linha do campo = um parágrafo). */
  function paragrafos(t: string, opcoes: { fonte?: keyof Fontes; recuo?: number } = {}) {
    const fonte = f[opcoes.fonte ?? 'normal']
    const x = M + (opcoes.recuo ?? 0)
    for (const par of p_(t).split('\n')) {
      if (!par.trim()) {
        y -= LH / 2
        continue
      }
      for (const l of quebrarLinhas(par.trim(), fonte, T, LARGURA - (opcoes.recuo ?? 0))) {
        espaco(LH)
        texto(p, l, x, y - T, T, fonte, COR.texto)
        y -= LH
      }
      y -= 3
    }
  }

  function tituloSecao(t: string, cor = COR.verde) {
    espaco(LH * 3)
    cartao(p, M, y - 9, 12, 3, 1.5, { cor })
    const ls = quebrarLinhas(t.toUpperCase(), f.negrito, 8.5, LARGURA - 20)
    ls.forEach((l, i) => texto(p, l, M + 18, y - 10 - i * 12, 8.5, f.negrito, cor, 'esquerda', 0.6))
    y -= 12 * ls.length + 8
  }

  novaPagina()

  // ---- Cabeçalho ----
  const alturaLogo = 46
  p.drawImage(logo, {
    x: M,
    y: y - alturaLogo,
    width: (logo.width / logo.height) * alturaLogo,
    height: alturaLogo,
  })
  texto(p, 'COMUNICAÇÃO DE SERVIÇO', A4.largura - M, y - 14, 7, f.negrito, COR.suave, 'direita', 1)
  texto(p, formatarData(c.data), A4.largura - M, y - 31, 14, f.extra, COR.noite, 'direita')
  if (conteudo.horario)
    texto(p, conteudo.horario, A4.largura - M, y - 44, 9, f.medio, COR.suave, 'direita')
  y -= alturaLogo + 14

  // ---- Faixa verde: título e subtítulo ----
  const principal = conteudo.subtitulo || c.titulo
  const linhasPrincipal = quebrarLinhas(principal.toUpperCase(), f.extra, 17, LARGURA - 40)
  const temRotulo = !!conteudo.subtitulo
  const alturaFaixa = (temRotulo ? 34 : 18) + linhasPrincipal.length * 21 + 8
  cartao(p, M, y - alturaFaixa, LARGURA, alturaFaixa, 12, { cor: COR.escuro })
  let yt = y - 22
  if (temRotulo) {
    rotulo(p, f, c.titulo, M + 20, yt, COR.lima)
    yt -= 22
  } else yt -= 4
  for (const l of linhasPrincipal) {
    texto(p, l, M + 20, yt, 17, f.extra, COR.branco)
    yt -= 21
  }
  y -= alturaFaixa + 12

  // ---- Dados: cliente, data, local, contato ----
  const dataTexto = [formatarData(c.data), conteudo.horario].filter(Boolean).join(' ')
  const linhasDados: [string, string][] = [
    ['Cliente', c.cliente_nome],
    ['Data', dataTexto],
    ...(conteudo.local ? ([['Local', conteudo.local]] as [string, string][]) : []),
    ...(conteudo.contato ? ([['Contato', conteudo.contato]] as [string, string][]) : []),
  ]
  const medidos = linhasDados.map(([r, v]) => ({
    r,
    ls: quebrarLinhas(v, f.medio, T, LARGURA - 110),
  }))
  const alturaDados = medidos.reduce((s, d) => s + d.ls.length * LH + 4, 0) + 20
  cartao(p, M, y - alturaDados, LARGURA, alturaDados, 10, { cor: COR.fundoSuave, borda: COR.borda })
  let yd = y - 12
  for (const d of medidos) {
    texto(p, d.r.toUpperCase(), M + 14, yd - T + 1, 7.5, f.negrito, COR.suave, 'esquerda', 0.8)
    d.ls.forEach((l, i) => texto(p, l, M + 96, yd - T - i * LH, T, f.medio, COR.texto))
    yd -= d.ls.length * LH + 4
  }
  y -= alturaDados + 12

  // ---- Abertura ----
  if (conteudo.abertura) {
    paragrafos(conteudo.abertura)
    y -= 8
  }

  // ---- Técnicos autorizados e veículo ----
  if (conteudo.tecnicos.length || conteudo.veiculo) {
    tituloSecao(conteudo.tecnicos.length ? 'Técnicos autorizados' : 'Veículo')
    if (conteudo.tecnicos.length) {
      const temRg = conteudo.tecnicos.some((t) => t.rg)
      const cols = temRg ? [0.5, 0.25, 0.25] : [0.6, 0, 0.4]
      const xs = [M, M + cols[0] * LARGURA, M + (cols[0] + cols[1]) * LARGURA]
      const h = 22
      espaco(h * 2)
      cartao(p, M, y - h, LARGURA, h, 8, { cor: COR.verde })
      const cab = ['Nome', temRg ? 'RG' : '', 'CPF']
      cab.forEach(
        (t, i) =>
          t &&
          texto(p, t.toUpperCase(), xs[i] + 10, y - 14, 7, f.negrito, COR.branco, 'esquerda', 0.8),
      )
      y -= h
      conteudo.tecnicos.forEach((t, n) => {
        espaco(h)
        if (n % 2 === 1)
          p.drawRectangle({ x: M, y: y - h, width: LARGURA, height: h, color: COR.fundoSuave })
        texto(p, t.nome, xs[0] + 10, y - 14.5, T, f.medio, COR.texto)
        if (temRg && t.rg) texto(p, t.rg, xs[1] + 10, y - 14.5, T, f.normal, COR.texto)
        if (t.cpf) texto(p, t.cpf, xs[2] + 10, y - 14.5, T, f.normal, COR.texto)
        y -= h
        p.drawLine({
          start: { x: M, y },
          end: { x: M + LARGURA, y },
          thickness: 0.5,
          color: COR.borda,
        })
      })
      y -= 10
    }
    if (conteudo.veiculo) {
      espaco(LH * 2)
      texto(p, 'VEÍCULO', M, y - T + 1, 7.5, f.negrito, COR.suave, 'esquerda', 0.8)
      texto(p, conteudo.veiculo, M + 60, y - T, T, f.medio, COR.texto)
      y -= LH + 8
    }
    y -= 6
  }

  // ---- Seções ----
  for (const s of conteudo.secoes) {
    if (s.estilo === 'destaque') {
      const ls = quebrarLinhas(p_(s.texto), f.medio, T, LARGURA - 32)
      const titulo = s.titulo
        ? quebrarLinhas(s.titulo.toUpperCase(), f.negrito, 8.5, LARGURA - 32)
        : []
      const altura = titulo.length * 12 + (titulo.length ? 6 : 0) + ls.length * LH + 22
      espaco(altura + 10)
      cartao(p, M, y - altura, LARGURA, altura, 10, { cor: COR.alertaClaro, borda: COR.alerta })
      let yy = y - 16
      for (const l of titulo) {
        texto(p, l, M + 16, yy - 2, 8.5, f.negrito, COR.alerta, 'esquerda', 0.6)
        yy -= 12
      }
      if (titulo.length) yy -= 6
      for (const l of ls) {
        texto(p, l, M + 16, yy - T + 4, T, f.medio, COR.texto)
        yy -= LH
      }
      y -= altura + 10
      continue
    }
    if (s.titulo) tituloSecao(p_(s.titulo))
    if (s.estilo === 'paragrafo') {
      paragrafos(s.texto)
    } else {
      itensDaSecao(p_(s.texto)).forEach((item, i) => {
        const marca = s.estilo === 'numerada' ? `${i + 1}.` : ''
        const ls = quebrarLinhas(item, f.normal, T, LARGURA - 22)
        ls.forEach((l, j) => {
          espaco(LH)
          if (j === 0) {
            if (marca) texto(p, marca, M + 2, y - T, T, f.negrito, COR.verde)
            else cartao(p, M + 5, y - T + 2, 5, 5, 2.5, { cor: COR.lima })
          }
          texto(p, l, M + 20, y - T, T, f.normal, COR.texto)
          y -= LH
        })
        y -= 2
      })
    }
    y -= 7
  }

  // ---- Fechamento e SAC (juntos, sem quebrar de página) ----
  const linhasFim =
    p_(conteudo.fechamento)
      .split('\n')
      .reduce((n, par) => n + quebrarLinhas(par || ' ', f.normal, T, LARGURA).length, 0) +
    (conteudo.contatos ? 3 : 1)
  espaco(linhasFim * (LH + 1) + 16)
  if (conteudo.fechamento) {
    y -= 4
    paragrafos(conteudo.fechamento)
  }
  if (conteudo.fechamento || conteudo.contatos) {
    espaco(LH * 3)
    y -= 6
    texto(p, UNIDADE.nome, M, y - T, T, f.extra, COR.escuro)
    y -= LH
    if (conteudo.contatos)
      for (const l of quebrarLinhas(conteudo.contatos, f.medio, T, LARGURA)) {
        texto(p, l, M, y - T, T, f.medio, COR.suave)
        y -= LH
      }
  }

  // ---- Rodapé em todas as páginas ----
  const rodape = UNIDADE.certificado.rodape
  paginas.forEach((pg, i) => {
    pg.drawLine({
      start: { x: M, y: BASE - 12 },
      end: { x: A4.largura - M, y: BASE - 12 },
      thickness: 0.6,
      color: COR.borda,
    })
    let yr = BASE - 24
    texto(pg, rodape[0], A4.largura / 2, yr, 7, f.negrito, COR.escuro, 'centro')
    for (const l of rodape.slice(1, 3)) {
      yr -= 8.5
      for (const parte of quebrarLinhas(l, f.normal, 6.2, LARGURA)) {
        texto(pg, parte, A4.largura / 2, yr, 6.2, f.normal, COR.suave, 'centro')
        yr -= 8
      }
      yr += 8
    }
    if (paginas.length > 1)
      texto(
        pg,
        `Página ${i + 1} de ${paginas.length}`,
        A4.largura - M,
        A4.altura - 30,
        6.6,
        f.normal,
        COR.suave,
        'direita',
      )
  })

  const bytes = await pdf.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/** Nome do arquivo: "Comunicação - Cliente - 06-08-2026.pdf". */
export function nomeArquivoComunicacao(c: Pick<Comunicacao, 'cliente_nome' | 'data'>) {
  return `Comunicação - ${c.cliente_nome} - ${formatarData(c.data).replace(/\//g, '-')}`
    .replace(/[\\/:*?"<>|]+/g, '-')
    .slice(0, 120)
}

export async function baixarPdfComunicacao(c: Comunicacao) {
  const blob = await gerarPdfComunicacao(c)
  const link = URL.createObjectURL(blob)
  const el = document.createElement('a')
  el.href = link
  el.download = `${nomeArquivoComunicacao(c)}.pdf`
  document.body.appendChild(el)
  el.click()
  el.remove()
  setTimeout(() => URL.revokeObjectURL(link), 60_000)
}
