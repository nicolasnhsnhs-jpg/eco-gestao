import fontkit from '@pdf-lib/fontkit'
import { degrees, PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'

import { quebrarLinhas, textoSeguro } from '@/features/os/pdf/gerarPdfOs'
import { formatarData } from '@/lib/datas'
import { UNIDADE } from '@/lib/unidade'

import { baixarAssinaturasApr, participantesEmOrdem, type Apr } from './api'
import {
  AVISO_RECUSA,
  EMERGENCIA,
  lerEpis,
  lerEtapas,
  MODELOS_APR,
  numeroApr,
  type ModeloApr,
} from './aprModelos'

/*
 * PDF da APR, no navegador com pdf-lib, no mesmo visual do certificado: A4 deitada,
 * fundo branco, Plus Jakarta Sans, verde-escuro e lima, cartões arredondados.
 *
 *   logo · nº da análise
 *   faixa verde: "ANÁLISE PRELIMINAR DE RISCO" · atividade · normas
 *   dados do serviço | dados da empresa
 *   tabela das etapas (continua nas páginas seguintes, com o cabeçalho repetido)
 *   EPIs obrigatórios · emergência · direito de recusa · observações
 *   ciência dos trabalhadores: nome, função, assinatura e quando assinou
 *   rodapé da empresa e "página x de y" em todas as páginas
 */

const A4 = { largura: 841.89, altura: 595.28 }
const M = 34
const LARGURA = A4.largura - M * 2
const MOLDURA = 16
/** Abaixo disto é o rodapé. */
const BASE = 70

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
  limaClaro: hex('#EEF7DF'),
  texto: hex('#13230F'),
  suave: hex('#586553'),
  borda: hex('#E2E8DC'),
  fundoSuave: hex('#F4F7EF'),
  branco: rgb(1, 1, 1),
  alerta: hex('#B45309'),
  alertaClaro: hex('#FEF3C7'),
  vermelho: hex('#C62828'),
}

type Fontes = { normal: PDFFont; medio: PDFFont; negrito: PDFFont; extra: PDFFont }

function texto(
  p: PDFPage,
  t: string,
  x: number,
  y: number,
  tamanho: number,
  fonte: PDFFont,
  cor: RGB = COR.texto,
  alinhar: 'esquerda' | 'centro' | 'direita' = 'esquerda',
  espacamento = 0,
) {
  const s = textoSeguro(t)
  const largura = fonte.widthOfTextAtSize(s, tamanho) + Math.max(0, s.length - 1) * espacamento
  const x0 = alinhar === 'centro' ? x - largura / 2 : alinhar === 'direita' ? x - largura : x
  if (!espacamento) {
    p.drawText(s, { x: x0, y, size: tamanho, font: fonte, color: cor })
    return
  }
  let xi = x0
  for (const letra of s) {
    p.drawText(letra, { x: xi, y, size: tamanho, font: fonte, color: cor })
    xi += fonte.widthOfTextAtSize(letra, tamanho) + espacamento
  }
}

function cartao(
  p: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  opcoes: { cor?: RGB; borda?: RGB; espessura?: number },
) {
  r = Math.min(r, w / 2, h / 2)
  const k = r * 0.5523
  const caminho = [
    `M ${r} 0`,
    `H ${w - r}`,
    `C ${w - r + k} 0 ${w} ${r - k} ${w} ${r}`,
    `V ${h - r}`,
    `C ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h}`,
    `H ${r}`,
    `C ${r - k} ${h} 0 ${h - r + k} 0 ${h - r}`,
    `V ${r}`,
    `C 0 ${r - k} ${r - k} 0 ${r} 0`,
    'Z',
  ].join(' ')
  p.drawSvgPath(caminho, {
    x,
    y: y + h,
    color: opcoes.cor,
    borderColor: opcoes.borda,
    borderWidth: opcoes.borda ? (opcoes.espessura ?? 0.8) : 0,
  })
}

const rotulo = (p: PDFPage, f: Fontes, t: string, x: number, y: number, cor: RGB) =>
  texto(p, t.toUpperCase(), x, y, 6.8, f.negrito, cor, 'esquerda', 1)

async function carregar(caminho: string) {
  return new Uint8Array(await (await fetch(caminho)).arrayBuffer())
}

/** Data e hora da assinatura: "26/11/2026 08:43". */
function quando(iso: string) {
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${d.toLocaleDateString('pt-BR')} ${hora}`
}

export async function gerarPdfApr(a: Apr): Promise<Blob> {
  const modelo = MODELOS_APR[a.modelo as ModeloApr] ?? MODELOS_APR.outro
  const etapas = lerEtapas(a.etapas)
  const epis = lerEpis(a.epis)
  const pessoas = participantesEmOrdem(a)
  const assinaturas = await baixarAssinaturasApr(
    pessoas.flatMap((p) => (p.assinatura_caminho ? [p.assinatura_caminho] : [])),
  )

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(`APR ${numeroApr(a)} - ${a.cliente_nome}`)
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

  /** Página nova: moldura e um cabeçalho pequeno (a 1ª tem o cabeçalho completo). */
  function novaPagina() {
    p = pdf.addPage([A4.largura, A4.altura])
    paginas.push(p)
    cartao(p, MOLDURA, MOLDURA, A4.largura - MOLDURA * 2, A4.altura - MOLDURA * 2, 16, {
      borda: COR.borda,
      espessura: 1,
    })
    cartao(p, A4.largura / 2 - 50, A4.altura - MOLDURA - 1.5, 100, 3, 1.5, { cor: COR.lima })
    y = A4.altura - 34
    if (paginas.length > 1) {
      const h = 24
      p.drawImage(logo, { x: M, y: y - h, width: (logo.width / logo.height) * h, height: h })
      texto(p, `APR Nº ${numeroApr(a)}`, A4.largura - M, y - 10, 9, f.extra, COR.noite, 'direita')
      texto(p, a.cliente_nome, A4.largura - M, y - 21, 7.5, f.normal, COR.suave, 'direita')
      y -= h + 12
    }
  }

  /** Garante espaço; senão, vira a página. Devolve true se virou. */
  function espaco(altura: number) {
    if (y - altura >= BASE) return false
    novaPagina()
    return true
  }

  novaPagina()

  // ---- Cabeçalho da 1ª página ----
  const alturaLogo = 44
  p.drawImage(logo, {
    x: M,
    y: y - alturaLogo,
    width: (logo.width / logo.height) * alturaLogo,
    height: alturaLogo,
  })
  texto(p, 'Nº DA ANÁLISE', A4.largura - M, y - 11, 7, f.negrito, COR.suave, 'direita', 1.1)
  texto(p, numeroApr(a), A4.largura - M, y - 27, 14, f.extra, COR.noite, 'direita')
  texto(
    p,
    `Data: ${formatarData(a.data)}`,
    A4.largura - M,
    y - 40,
    8,
    f.medio,
    COR.suave,
    'direita',
  )
  y -= alturaLogo + 10

  // Faixa verde
  const linhasTitulo = quebrarLinhas(a.titulo.toUpperCase(), f.extra, 15, LARGURA - 40)
  const alturaFaixa = 18 + 12 + linhasTitulo.length * 18 + 16
  cartao(p, M, y - alturaFaixa, LARGURA, alturaFaixa, 12, { cor: COR.escuro })
  rotulo(p, f, 'Análise Preliminar de Risco (APR)', M + 20, y - 20, COR.lima)
  texto(p, modelo.normas, A4.largura - M - 20, y - 20, 7.5, f.negrito, COR.lima, 'direita')
  let yt = y - 38
  for (const l of linhasTitulo) {
    texto(p, l, M + 20, yt, 15, f.extra, COR.branco)
    yt -= 18
  }
  y -= alturaFaixa + 12

  // Dados do serviço e da empresa
  const cfg = UNIDADE.apr
  const colunaW = (LARGURA - 12) / 2
  const dadosServico: [string, string][] = [
    ['Cliente', a.cliente_nome],
    ...(a.cliente_documento ? ([['CNPJ/CPF', a.cliente_documento]] as [string, string][]) : []),
    ...(a.local ? ([['Local do serviço', a.local]] as [string, string][]) : []),
    ...(a.endereco_texto ? ([['Endereço', a.endereco_texto]] as [string, string][]) : []),
    ...(a.descricao_atividade
      ? ([['Atividade', a.descricao_atividade]] as [string, string][])
      : []),
  ]
  const dadosEmpresa: [string, string][] = [
    ['Empresa prestadora', cfg.empresa],
    ['CNPJ', UNIDADE.cnpj],
    ...(cfg.responsavelEmpresa
      ? ([['Responsável pela empresa', cfg.responsavelEmpresa]] as [string, string][])
      : []),
    ...(cfg.responsavelTecnico
      ? ([['Responsável técnico(a)', cfg.responsavelTecnico]] as [string, string][])
      : []),
  ]
  const medirDados = (dados: [string, string][]) =>
    dados.map(([r, v]) => ({ r, linhas: quebrarLinhas(v, f.medio, 8.5, colunaW - 130) }))
  const ms = medirDados(dadosServico)
  const me = medirDados(dadosEmpresa)
  const alturaDe = (m: { linhas: string[] }[]) =>
    m.reduce((s, d) => s + Math.max(1, d.linhas.length) * 11 + 4, 0) + 30
  const alturaDados = Math.max(alturaDe(ms), alturaDe(me))
  const blocoDados = (m: typeof ms, x: number, titulo: string) => {
    cartao(p, x, y - alturaDados, colunaW, alturaDados, 10, {
      cor: COR.fundoSuave,
      borda: COR.borda,
    })
    cartao(p, x + 12, y - 18, 12, 3, 1.5, { cor: COR.verde })
    rotulo(p, f, titulo, x + 30, y - 18, COR.verde)
    let yd = y - 34
    for (const d of m) {
      texto(p, d.r, x + 12, yd, 7.5, f.negrito, COR.suave)
      d.linhas.forEach((l, i) => texto(p, l, x + 122, yd - i * 11, 8.5, f.medio, COR.texto))
      yd -= Math.max(1, d.linhas.length) * 11 + 4
    }
  }
  blocoDados(ms, M, 'Serviço')
  blocoDados(me, M + colunaW + 12, 'Empresa')
  y -= alturaDados + 10

  const intro =
    'Esta APR identifica, em cada etapa da tarefa, os riscos e as medidas de controle para garantir a segurança durante a execução. Todos os trabalhadores envolvidos devem conhecê-la e assiná-la antes de começar.'
  for (const l of quebrarLinhas(intro, f.normal, 8, LARGURA)) {
    texto(p, l, M, y - 8, 8, f.normal, COR.suave)
    y -= 11
  }
  y -= 8

  // ---- Tabela das etapas ----
  const COLUNAS: { titulo: string; peso: number; campo: keyof (typeof etapas)[number] | null }[] = [
    { titulo: 'Nº', peso: 0.045, campo: null },
    { titulo: 'Etapa do trabalho', peso: 0.19, campo: 'etapa' },
    { titulo: 'Riscos', peso: 0.17, campo: 'riscos' },
    { titulo: 'Medidas de controle', peso: 0.245, campo: 'medidas' },
    { titulo: 'O que pode dar errado', peso: 0.155, campo: 'o_que_pode_dar_errado' },
    { titulo: 'Ações corretivas', peso: 0.195, campo: 'acoes' },
  ]
  const larguras = COLUNAS.map((c) => c.peso * LARGURA)
  const xs = larguras.map((_, i) => M + larguras.slice(0, i).reduce((s, v) => s + v, 0))
  const T = 7.6
  const LH = T * 1.32
  const PADY = 6

  const cabecalhoTabela = () => {
    const h = 22
    cartao(p, M, y - h, LARGURA, h, 8, { cor: COR.verde })
    COLUNAS.forEach((c, i) =>
      texto(
        p,
        c.titulo.toUpperCase(),
        xs[i] + 6,
        y - 14,
        6.4,
        f.negrito,
        COR.branco,
        'esquerda',
        0.6,
      ),
    )
    y -= h
  }

  espaco(80)
  cabecalhoTabela()
  etapas.forEach((e, n) => {
    const celulas = COLUNAS.map((c, i) => {
      const valor = c.campo ? e[c.campo] : String(n + 1).padStart(2, '0')
      return quebrarLinhas(valor || '-', i === 1 ? f.medio : f.normal, T, larguras[i] - 12)
    })
    const altura = Math.max(...celulas.map((l) => l.length)) * LH + PADY * 2
    if (espaco(altura)) cabecalhoTabela()
    if (n % 2 === 1)
      p.drawRectangle({
        x: M,
        y: y - altura,
        width: LARGURA,
        height: altura,
        color: COR.fundoSuave,
      })
    celulas.forEach((linhas, i) =>
      linhas.forEach((l, j) =>
        texto(
          p,
          l,
          xs[i] + 6,
          y - PADY - T + 1 - j * LH,
          T,
          i <= 1 ? f.medio : f.normal,
          i === 0 ? COR.verde : COR.texto,
        ),
      ),
    )
    y -= altura
    p.drawLine({
      start: { x: M, y },
      end: { x: M + LARGURA, y },
      thickness: 0.5,
      color: COR.borda,
    })
  })
  y -= 14

  // ---- EPIs e emergência ----
  const larguraEpis = LARGURA * 0.62
  const larguraEmerg = LARGURA - larguraEpis - 12
  // Cada EPI com o marcador só na 1ª linha; as seguintes ficam recuadas.
  const linhasEpis = epis.flatMap((e) =>
    quebrarLinhas(e, f.normal, 8, larguraEpis / 2 - 32).map((l, i) => ({ l, primeira: i === 0 })),
  )
  const meio = Math.ceil(linhasEpis.length / 2)
  const alturaEpis = Math.max(meio * 11 + 36, EMERGENCIA.length * 12 + 36)
  espaco(alturaEpis + 30)
  cartao(p, M, y - alturaEpis, larguraEpis, alturaEpis, 10, {
    cor: COR.fundoSuave,
    borda: COR.borda,
  })
  cartao(p, M + 12, y - 18, 12, 3, 1.5, { cor: COR.verde })
  rotulo(p, f, 'EPIs obrigatórios (com CA válido)', M + 30, y - 18, COR.verde)
  linhasEpis.forEach(({ l, primeira }, i) => {
    const coluna = i < meio ? 0 : 1
    const linha = i < meio ? i : i - meio
    const x = M + 14 + coluna * (larguraEpis / 2)
    if (primeira) texto(p, '•', x, y - 34 - linha * 11, 8, f.negrito, COR.verde)
    texto(p, l, x + 9, y - 34 - linha * 11, 8, f.normal, COR.texto)
  })
  const xEm = M + larguraEpis + 12
  cartao(p, xEm, y - alturaEpis, larguraEmerg, alturaEpis, 10, {
    cor: COR.alertaClaro,
    borda: COR.alertaClaro,
  })
  rotulo(p, f, 'Em caso de emergência', xEm + 12, y - 18, COR.alerta)
  EMERGENCIA.forEach((t, i) => texto(p, t, xEm + 12, y - 34 - i * 12, 8.5, f.negrito, COR.noite))
  y -= alturaEpis + 8
  for (const l of quebrarLinhas(AVISO_RECUSA, f.medio, 8, LARGURA)) {
    texto(p, l, M, y - 8, 8, f.medio, COR.escuro)
    y -= 11
  }

  if (a.observacoes?.trim()) {
    const linhas = quebrarLinhas(a.observacoes.trim(), f.normal, 8.5, LARGURA - 24)
    const h = linhas.length * 11.5 + 30
    y -= 6
    espaco(h)
    cartao(p, M, y - h, LARGURA, h, 10, { cor: COR.fundoSuave, borda: COR.borda })
    rotulo(p, f, 'Observações', M + 12, y - 18, COR.verde)
    linhas.forEach((l, i) => texto(p, l, M + 12, y - 33 - i * 11.5, 8.5, f.normal, COR.texto))
    y -= h
  }
  y -= 14

  // ---- Ciência dos trabalhadores ----
  const LINHA_ASS = 40
  espaco(60 + LINHA_ASS)
  rotulo(p, f, 'Ciência dos trabalhadores', M, y - 8, COR.verde)
  y -= 14
  const declaracao =
    'Declaramos que conhecemos os perigos, os riscos e as medidas preventivas desta análise e que vamos adotá-las na execução das atividades.'
  for (const l of quebrarLinhas(declaracao, f.normal, 8, LARGURA)) {
    texto(p, l, M, y - 8, 8, f.normal, COR.texto)
    y -= 11
  }
  y -= 6
  const colAss = [0.34, 0.18, 0.3, 0.18].map((r) => r * LARGURA)
  const xAss = colAss.map((_, i) => M + colAss.slice(0, i).reduce((s, v) => s + v, 0))
  const cabecalhoAss = () => {
    const h = 20
    cartao(p, M, y - h, LARGURA, h, 8, { cor: COR.escuro })
    ;['Nome do trabalhador', 'Função', 'Assinatura', 'Assinado em'].forEach((t, i) =>
      texto(p, t.toUpperCase(), xAss[i] + 8, y - 13, 6.4, f.negrito, COR.branco, 'esquerda', 0.6),
    )
    y -= h
  }
  cabecalhoAss()
  for (const pessoa of pessoas) {
    if (espaco(LINHA_ASS)) cabecalhoAss()
    const meioLinha = y - LINHA_ASS / 2 - 3
    texto(p, pessoa.nome, xAss[0] + 8, meioLinha, 9, f.medio, COR.texto)
    texto(p, pessoa.funcao, xAss[1] + 8, meioLinha, 8.5, f.normal, COR.texto)
    const bytes = pessoa.assinatura_caminho ? assinaturas[pessoa.assinatura_caminho] : undefined
    if (bytes) {
      const img = await pdf.embedPng(bytes)
      const escala = Math.min((LINHA_ASS - 8) / img.height, (colAss[2] - 16) / img.width)
      p.drawImage(img, {
        x: xAss[2] + 8,
        y: y - LINHA_ASS + 4,
        width: img.width * escala,
        height: img.height * escala,
      })
    } else {
      texto(p, 'Aguardando assinatura', xAss[2] + 8, meioLinha, 8, f.medio, COR.alerta)
    }
    if (pessoa.assinada_em)
      texto(p, quando(pessoa.assinada_em), xAss[3] + 8, meioLinha, 8.5, f.normal, COR.texto)
    y -= LINHA_ASS
    p.drawLine({
      start: { x: M, y },
      end: { x: M + LARGURA, y },
      thickness: 0.5,
      color: COR.borda,
    })
  }

  // ---- Rodapé e cancelada, em todas as páginas ----
  const rodape = UNIDADE.certificado.rodape
  paginas.forEach((pg, i) => {
    pg.drawLine({
      start: { x: M, y: BASE - 12 },
      end: { x: A4.largura - M, y: BASE - 12 },
      thickness: 0.6,
      color: COR.borda,
    })
    let yr = BASE - 24
    texto(pg, rodape[0], A4.largura / 2, yr, 7.2, f.negrito, COR.escuro, 'centro')
    for (const l of rodape.slice(1)) {
      yr -= 8.5
      texto(pg, l, A4.largura / 2, yr, 6.4, f.normal, COR.suave, 'centro')
    }
    texto(
      pg,
      `Página ${i + 1} de ${paginas.length}`,
      A4.largura - M,
      BASE - 24,
      6.6,
      f.normal,
      COR.suave,
      'direita',
    )
    if (a.status === 'cancelada')
      pg.drawText('CANCELADA', {
        x: 220,
        y: 150,
        size: 110,
        font: f.extra,
        color: COR.vermelho,
        opacity: 0.2,
        rotate: degrees(25),
      })
  })

  const bytes = await pdf.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/** Baixa o PDF com o nome "APR 28-2026 - Cliente.pdf". */
export async function baixarPdfApr(a: Apr) {
  const blob = await gerarPdfApr(a)
  const nome = `APR ${numeroApr(a).replace('/', '-')} - ${a.cliente_nome}`
    .replace(/[\\/:*?"<>|]+/g, '-')
    .slice(0, 120)
  const link = URL.createObjectURL(blob)
  const el = document.createElement('a')
  el.href = link
  el.download = `${nome}.pdf`
  document.body.appendChild(el)
  el.click()
  el.remove()
  setTimeout(() => URL.revokeObjectURL(link), 60_000)
}
