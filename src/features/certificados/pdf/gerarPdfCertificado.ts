import fontkit from '@pdf-lib/fontkit'
import { degrees, PDFDocument, PDFName, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'

import { enderecoDaFicha, fichaDaOs } from '@/features/os/api'
import { quebrarLinhas, textoSeguro } from '@/features/os/pdf/gerarPdfOs'
import { formatarData } from '@/lib/datas'
import { formatarCnpj, formatarCpf } from '@/lib/documentos'
import { UNIDADE } from '@/lib/unidade'

import {
  assinarPdfCertificado,
  baixarAssinatura,
  type CertificadoResumo,
  type QualAssinatura,
} from '../api'
import {
  declaracao,
  lerProdutos,
  lerReservatorios,
  linhasDoProduto,
  localEData,
  MODELO,
  responsavelDoModelo,
  textoDias,
  type ModeloCertificado,
} from '../modelos'

/*
 * PDF do certificado, no navegador com pdf-lib (como o PDF da OS).
 * Folha A4 deitada (paisagem), fundo branco (o cliente imprime), com a identidade
 * do site: fonte Plus Jakarta Sans, verde-escuro e lima, cartões arredondados.
 *
 *   logo · número
 *   faixa verde: "CERTIFICADO" · título · pragas-alvo
 *   "Certificamos para os devidos fins…"
 *   à esquerda: blocos (áreas e produtos | reservatórios | sucção) e observação
 *   à direita: data · válido até · validade e a assinatura
 *   rodapé da empresa
 */

// -----------------------------------------------------------------------------
// Medidas e cores
// -----------------------------------------------------------------------------

const A4 = { largura: 841.89, altura: 595.28 }
/** Margem do conteúdo (as impressoras não imprimem bem perto da borda). */
const M = 38
const LARGURA = A4.largura - M * 2
/** Moldura fina em volta da folha. */
const MOLDURA = 18
/** Coluna da direita (datas e assinatura) e o vão até os blocos. */
const LATERAL = 222
const VAO_LATERAL = 18
const LARGURA_BLOCOS = LARGURA - LATERAL - VAO_LATERAL

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
  limaForte: hex('#B8E36F'),
  limaClaro: hex('#EEF7DF'),
  texto: hex('#13230F'),
  suave: hex('#586553'),
  borda: hex('#E2E8DC'),
  fundoSuave: hex('#F4F7EF'),
  branco: rgb(1, 1, 1),
  vermelho: hex('#C62828'),
}

/** Onde terminam os blocos e a coluna da direita (acima do rodapé). */
const BASE_CORPO = 96
/** Altura do carimbo da assinatura digital (desenhado pelo servidor, função "assinatura"). */
const ALTURA_CARIMBO = 40
/** Onde o PDF diz ao servidor o lugar do carimbo: [x, y, largura, altura]. Igual a _shared/assinarPdf.ts. */
const CHAVE_CARIMBO = 'EcoCarimboAssinatura'

type Fontes = { normal: PDFFont; medio: PDFFont; negrito: PDFFont; extra: PDFFont }

// -----------------------------------------------------------------------------
// Desenho básico
// -----------------------------------------------------------------------------

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
  const largura = larguraTexto(s, fonte, tamanho, espacamento)
  const x0 = alinhar === 'centro' ? x - largura / 2 : alinhar === 'direita' ? x - largura : x
  if (!espacamento) {
    p.drawText(s, { x: x0, y, size: tamanho, font: fonte, color: cor })
    return
  }
  // Letras espaçadas (títulos pequenos em maiúsculas, como no site).
  let xi = x0
  for (const letra of s) {
    p.drawText(letra, { x: xi, y, size: tamanho, font: fonte, color: cor })
    xi += fonte.widthOfTextAtSize(letra, tamanho) + espacamento
  }
}

function larguraTexto(s: string, fonte: PDFFont, tamanho: number, espacamento = 0) {
  return fonte.widthOfTextAtSize(s, tamanho) + Math.max(0, s.length - 1) * espacamento
}

/** Retângulo de cantos arredondados (x, y = canto de baixo à esquerda). */
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
  const k = r * 0.5523 // aproximação do arco por curva de Bézier
  // SVG: y cresce para baixo; o drawSvgPath recebe o canto de cima em (x, y + h).
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

/** Título pequeno, em maiúsculas e espaçado, na cor de destaque. */
function rotulo(
  p: PDFPage,
  f: Fontes,
  t: string,
  x: number,
  y: number,
  cor: RGB,
  alinhar: 'esquerda' | 'centro' = 'esquerda',
) {
  texto(p, t.toUpperCase(), x, y, 7, f.negrito, cor, alinhar, 1.1)
}

// -----------------------------------------------------------------------------
// Parágrafo justificado com trechos em negrito
// -----------------------------------------------------------------------------

function paragrafo(
  p: PDFPage,
  f: Fontes,
  partes: { texto: string; negrito: boolean }[],
  y: number,
  tamanho: number,
) {
  // Uma "palavra" pode juntar pedaços em negrito e normais sem espaço entre eles
  // (ex.: "LTDA" em negrito seguido de "," normal).
  type Pedaco = { texto: string; negrito: boolean }
  type Palavra = Pedaco[]
  const palavras: Palavra[] = []
  let colar = false
  for (const parte of partes) {
    for (const pedaco of textoSeguro(parte.texto).split(/(\s+)/)) {
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
  const fonteDe = (q: Pedaco) => (q.negrito ? f.negrito : f.normal)
  const largura = (w: Palavra) =>
    w.reduce((s, q) => s + fonteDe(q).widthOfTextAtSize(q.texto, tamanho), 0)
  const espaco = f.normal.widthOfTextAtSize(' ', tamanho)
  const entrelinha = tamanho * 1.6

  let linha: Palavra[] = []
  let ocupado = 0
  const escrever = (ultima: boolean) => {
    const soma = linha.reduce((s, w) => s + largura(w), 0)
    const vaos = linha.length - 1
    const folga = !ultima && vaos > 0 ? (LARGURA - soma) / vaos : espaco
    let x = M
    for (const w of linha) {
      for (const q of w) {
        p.drawText(q.texto, {
          x,
          y,
          size: tamanho,
          font: fonteDe(q),
          color: q.negrito ? COR.noite : COR.texto,
        })
        x += fonteDe(q).widthOfTextAtSize(q.texto, tamanho)
      }
      x += folga
    }
    y -= entrelinha
    linha = []
    ocupado = 0
  }
  for (const w of palavras) {
    const extra = (linha.length ? espaco : 0) + largura(w)
    if (linha.length && ocupado + extra > LARGURA) escrever(false)
    ocupado += (linha.length ? espaco : 0) + largura(w)
    linha.push(w)
  }
  if (linha.length) escrever(true)
  return y
}

// -----------------------------------------------------------------------------
// Cartões do meio (áreas, produtos, descrição)
// -----------------------------------------------------------------------------

/** Item de um cartão: linha principal e, opcionalmente, uma linha menor embaixo. */
type Item = { principal: string; detalhe?: string }
type Bloco = { titulo: string; itens: Item[] }

const PAD = 14
const VAO_COLUNA = 16

type Medido = { principal: string[]; detalhe: string[]; altura: number }

function medir(b: Bloco, f: Fontes, t: number, largura: number): Medido[] {
  return b.itens.map((i) => {
    const principal = quebrarLinhas(i.principal, f.medio, t, largura)
    const detalhe = i.detalhe ? quebrarLinhas(i.detalhe, f.normal, t - 1.2, largura) : []
    return {
      principal,
      detalhe,
      altura: principal.length * t * 1.35 + detalhe.length * (t - 1.2) * 1.35 + t * 0.55,
    }
  })
}

/** Divide os itens em colunas de altura parecida, mantendo a ordem. */
function emColunas(itens: Medido[], n: number): Medido[][] {
  const total = itens.reduce((s, i) => s + i.altura, 0)
  const colunas: Medido[][] = [[]]
  let soma = 0
  for (const item of itens) {
    const cheia = soma > 0 && soma + item.altura / 2 > total / n
    if (cheia && colunas.length < n) {
      colunas.push([])
      soma = 0
    }
    colunas[colunas.length - 1].push(item)
    soma += item.altura
  }
  return colunas
}

type Arrumacao = { t: number; colunas: Medido[][]; altura: number; larguraTexto: number }

function arrumar(b: Bloco, f: Fontes, t: number, largura: number, n: number): Arrumacao {
  const larguraTexto = (largura - PAD * 2 - VAO_COLUNA * (n - 1)) / n
  const colunas = emColunas(medir(b, f, t, larguraTexto), n)
  const corpo = Math.max(...colunas.map((c) => c.reduce((s, i) => s + i.altura, 0)))
  return { t, colunas, altura: PAD + 18 + corpo + PAD - t * 0.55, larguraTexto }
}

function desenharBloco(
  p: PDFPage,
  f: Fontes,
  b: Bloco,
  a: Arrumacao,
  x: number,
  yTopo: number,
  largura: number,
  altura: number,
  destaque: RGB,
) {
  cartao(p, x, yTopo - altura, largura, altura, 12, { cor: COR.fundoSuave, borda: COR.borda })
  // Barrinha de destaque ao lado do título
  cartao(p, x + PAD, yTopo - PAD - 8.5, 14, 3, 1.5, { cor: destaque })
  rotulo(p, f, b.titulo, x + PAD + 20, yTopo - PAD - 8.5, destaque)
  const t = a.t
  a.colunas.forEach((coluna, n) => {
    const xc = x + PAD + n * (a.larguraTexto + VAO_COLUNA)
    let y = yTopo - PAD - 18 - t
    for (const item of coluna) {
      for (const s of item.principal) {
        texto(p, s, xc, y, t, f.medio, COR.texto)
        y -= t * 1.35
      }
      for (const s of item.detalhe) {
        texto(p, s, xc, y, t - 1.2, f.normal, COR.suave)
        y -= (t - 1.2) * 1.35
      }
      y -= t * 0.55
    }
  })
}

/**
 * Blocos do meio. Primeiro tenta lado a lado (letra de 10 até 7,5); se não cabe,
 * põe um embaixo do outro na largura toda, dividindo listas longas em até 3 colunas
 * (letra de 9,5 até 6). Devolve o y de baixo.
 */
function blocosDoMeio(
  p: PDFPage,
  f: Fontes,
  blocos: Bloco[],
  x0: number,
  larguraTotal: number,
  yTopo: number,
  yLimite: number,
  destaque: RGB,
) {
  const visiveis = blocos.filter((b) => b.itens.length > 0)
  if (visiveis.length === 0) return yTopo
  const disponivel = yTopo - yLimite
  const vao = 14

  const larguraLado = visiveis.length === 1 ? larguraTotal : (larguraTotal - vao) / 2
  for (let t = 10; t >= 7.5; t -= 0.25) {
    const arr = visiveis.map((b) => arrumar(b, f, t, larguraLado, 1))
    const altura = Math.max(...arr.map((a) => a.altura))
    if (altura <= disponivel) {
      visiveis.forEach((b, i) =>
        desenharBloco(
          p,
          f,
          b,
          arr[i],
          x0 + i * (larguraLado + vao),
          yTopo,
          larguraLado,
          altura,
          destaque,
        ),
      )
      return yTopo - altura
    }
  }

  // Um embaixo do outro; cada bloco com o número de colunas que o deixa mais baixo.
  let escolha: Arrumacao[] = []
  for (let t = 9.5; t >= 6; t -= 0.25) {
    escolha = visiveis.map((b) => {
      const opcoes = [1, 2, 3].map((n) => arrumar(b, f, t, larguraTotal, n))
      return opcoes.reduce((melhor, a) => (a.altura < melhor.altura - 1 ? a : melhor))
    })
    const total = escolha.reduce((s, a) => s + a.altura, 0) + vao * (escolha.length - 1)
    if (total <= disponivel) break
  }
  let y = yTopo
  visiveis.forEach((b, i) => {
    desenharBloco(p, f, b, escolha[i], x0, y, larguraTotal, escolha[i].altura, destaque)
    y -= escolha[i].altura + vao
  })
  return y + vao
}

// -----------------------------------------------------------------------------
// Certificado
// -----------------------------------------------------------------------------

function documento(valor: string | null | undefined) {
  if (!valor) return ''
  return valor.length === 11 ? formatarCpf(valor) : formatarCnpj(valor)
}

const meses = (n: number) => `${String(n).padStart(2, '0')} ${n === 1 ? 'mês' : 'meses'}`

async function carregar(caminho: string) {
  return new Uint8Array(await (await fetch(caminho)).arrayBuffer())
}

/** Qual assinatura escaneada vai neste certificado. */
export function assinaturaDoCertificado(c: CertificadoResumo): QualAssinatura {
  const modelo = MODELO[c.modelo as ModeloCertificado] ?? MODELO.geral
  return modelo.responsavelSuccao && UNIDADE.certificado.responsavelSuccao
    ? 'succao'
    : 'responsavel'
}

/**
 * @param assinatura PNG da assinatura escaneada do responsável padrão. Só entra se
 *   o certificado estiver no nome dele (outro nome digitado → sem assinatura).
 */
export async function gerarPdfCertificado(
  c: CertificadoResumo,
  assinatura?: Uint8Array | null,
): Promise<Blob> {
  const modelo = MODELO[c.modelo as ModeloCertificado] ?? MODELO.geral
  const destaque = hex(modelo.destaque.forte)
  const destaqueClaro = hex(modelo.destaque.claro)
  const ficha = fichaDaOs(c.ficha_cliente)
  const conf = UNIDADE.certificado
  const deContrato = c.tipo_validade === 'contrato'

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(`${c.numero} - ${c.titulo}`)
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
  const p = pdf.addPage([A4.largura, A4.altura])

  // Moldura fina e detalhe lima no alto
  cartao(p, MOLDURA, MOLDURA, A4.largura - MOLDURA * 2, A4.altura - MOLDURA * 2, 18, {
    borda: COR.borda,
    espessura: 1,
  })
  cartao(p, A4.largura / 2 - 50, A4.altura - MOLDURA - 1.5, 100, 3, 1.5, { cor: COR.lima })

  // Cabeçalho: logo à esquerda, número à direita
  let y = A4.altura - 36
  const alturaLogo = 46
  const larguraLogo = (logo.width / logo.height) * alturaLogo
  p.drawImage(logo, { x: M, y: y - alturaLogo, width: larguraLogo, height: alturaLogo })
  texto(p, 'CERTIFICADO Nº', A4.largura - M, y - 12, 7, f.negrito, COR.suave, 'direita', 1.1)
  texto(p, c.numero, A4.largura - M, y - 27, 12, f.extra, COR.noite, 'direita')
  texto(p, UNIDADE.nome, A4.largura - M, y - 39, 7.5, f.normal, COR.suave, 'direita')
  y -= alturaLogo + 12

  // Faixa verde-escura: "CERTIFICADO", título e pragas-alvo
  const larguraTitulo = LARGURA - 170
  const tituloLinhas = quebrarLinhas(c.titulo.toUpperCase(), f.extra, 18, larguraTitulo)
  const pragas =
    modelo.temPragas && c.pragas_alvo?.trim()
      ? quebrarLinhas(`Pragas-alvo: ${c.pragas_alvo.trim()}`, f.medio, 10, larguraTitulo)
      : []
  const alturaFaixa =
    20 + 10 + tituloLinhas.length * 22 + (pragas.length ? 4 + pragas.length * 14 : 0) + 14
  cartao(p, M, y - alturaFaixa, LARGURA, alturaFaixa, 16, { cor: COR.noite })
  // Gotas do logo, em lima, no canto direito da faixa
  const gota = 'M 50 0 C 62 22 100 52 100 80 A 50 50 0 0 1 0 80 C 0 52 38 22 50 0 Z'
  const alturaGota = Math.min(alturaFaixa - 22, 60)
  const escalaGota = alturaGota / 130
  const xGota = M + LARGURA - 34 - 100 * escalaGota
  p.drawSvgPath(gota, { x: xGota, y: y - 11, scale: escalaGota, color: COR.lima })
  p.drawSvgPath(gota, {
    x: xGota - 48 * escalaGota,
    y: y - 11 - alturaGota * 0.55,
    scale: escalaGota * 0.45,
    color: COR.verde,
  })
  let yf = y - 20
  texto(
    p,
    'CERTIFICADO DE EXECUÇÃO DE SERVIÇO',
    M + 24,
    yf - 2,
    7,
    f.negrito,
    COR.lima,
    'esquerda',
    1.1,
  )
  yf -= 10 + 18
  for (const l of tituloLinhas) {
    texto(p, l, M + 24, yf, 18, f.extra, COR.branco)
    yf -= 22
  }
  for (const l of pragas) {
    texto(p, l, M + 24, yf + 2, 10, f.medio, COR.limaForte)
    yf -= 14
  }
  y -= alturaFaixa + 22

  // "Certificamos para os devidos fins…"
  y = paragrafo(
    p,
    f,
    declaracao({
      servicoDescrito: c.servico_descrito,
      cliente: (ficha.razao_social || ficha.nome || '').toUpperCase(),
      // Contrato: a data vai na frase. Avulso: a data exata vai embaixo.
      dias: deContrato ? textoDias([c.data_execucao, ...(c.outras_datas ?? [])]) : '',
      endereco: enderecoDaFicha(ficha).replace(/ · /g, ' - '),
      documento: documento(ficha.cpf_cnpj),
      ehCpf: (ficha.cpf_cnpj ?? '').length === 11,
      complemento: c.complemento,
    }),
    y,
    10.5,
  )
  const topoCorpo = y - 4

  // ---- Coluna da direita: data · válido até · validade, e a assinatura ----
  const xLateral = M + LARGURA - LATERAL
  const datas = [c.data_execucao, ...(c.outras_datas ?? [])]
  const info = [
    {
      rotulo: datas.length > 1 ? 'Datas do serviço' : 'Data do serviço',
      valor: textoDias(datas).replace(/^nos? dias? /, ''),
    },
    c.validade && { rotulo: 'Válido até', valor: formatarData(c.validade) },
    c.validade_meses && {
      rotulo: 'Validade',
      valor: deContrato ? `${meses(c.validade_meses)} · contrato` : meses(c.validade_meses),
    },
  ].filter((i): i is { rotulo: string; valor: string } => !!i)
  let yl = topoCorpo
  for (const i of info) {
    const destacado = i.rotulo === 'Válido até'
    cartao(p, xLateral, yl - 40, LATERAL, 40, 12, {
      cor: destacado ? destaqueClaro : COR.branco,
      borda: destacado ? undefined : COR.borda,
    })
    rotulo(p, f, i.rotulo, xLateral + 14, yl - 15, destacado ? destaque : COR.suave)
    let t = 12.5
    while (t > 8 && f.extra.widthOfTextAtSize(textoSeguro(i.valor), t) > LATERAL - 28) t -= 0.5
    texto(p, i.valor, xLateral + 14, yl - 31, t, f.extra, COR.noite)
    yl -= 40 + 8
  }

  // Rodapé (a linha divisória limita o carimbo da assinatura digital)
  const rodape = modelo.responsavelSuccao && conf.rodapeSuccao ? conf.rodapeSuccao : conf.rodape
  const linhasRodape = rodape.slice(1).flatMap((l) => quebrarLinhas(l, f.normal, 6.8, LARGURA))
  let yr = MOLDURA + 12 + (linhasRodape.length - 1) * 9
  const yDivisa = yr + 30

  // Assinatura do responsável técnico, no pé da coluna
  const centroLateral = xLateral + LATERAL / 2
  // Com assinatura digital, a assinatura sobe para caber o carimbo embaixo (sem passar
  // por cima dos cartões de data e validade).
  const yNormal = BASE_CORPO + 34
  const yLinha = c.assinatura_digital
    ? Math.max(yNormal, Math.min(yNormal + ALTURA_CARIMBO + 6, yl - 64))
    : yNormal
  const resp = responsavelDoModelo(c.modelo as ModeloCertificado)
  const nome = c.responsavel_nome?.trim() || resp.nome
  const registro = c.responsavel_registro?.trim() || resp.registro
  const mesmaPessoa = !!resp.nome && nome.toUpperCase() === resp.nome.toUpperCase()
  if (assinatura && mesmaPessoa) {
    const img = await pdf.embedPng(assinatura)
    const escala = Math.min(44 / img.height, 160 / img.width)
    const w = img.width * escala
    p.drawImage(img, {
      x: centroLateral - w / 2,
      y: yLinha - 5,
      width: w,
      height: img.height * escala,
    })
  }
  // Local e data (avulso: a data exata vai embaixo, junto da assinatura)
  if (!deContrato)
    texto(
      p,
      localEData(conf.cidade, c.data_execucao),
      centroLateral,
      yLinha + 52,
      9,
      f.normal,
      COR.texto,
      'centro',
    )
  p.drawLine({
    start: { x: xLateral + 10, y: yLinha },
    end: { x: xLateral + LATERAL - 10, y: yLinha },
    thickness: 0.8,
    color: COR.noite,
  })
  let ya = yLinha - 13
  const linhasAssinatura: [string, PDFFont, RGB, number][] = [
    [nome, f.negrito, COR.noite, 9],
    [registro, f.normal, COR.suave, 8],
    [conf.rodape[0], f.normal, COR.suave, 6.8],
  ]
  for (const [t, fonte, cor, tamanho] of linhasAssinatura) {
    if (!t) continue
    const linha = quebrarLinhas(t, fonte, tamanho, LATERAL)[0] ?? ''
    texto(p, linha, centroLateral, ya, tamanho, fonte, cor, 'centro')
    ya -= tamanho + 3
  }
  // Com assinatura digital, fica reservado embaixo do nome o espaço do carimbo, que o
  // servidor desenha na hora de assinar (nome do certificado, CNPJ/CPF, data e hora).
  if (c.assinatura_digital) {
    const topo = ya + 2
    const base = Math.max(yDivisa + 5, topo - ALTURA_CARIMBO)
    pdf.catalog.set(
      PDFName.of(CHAVE_CARIMBO),
      pdf.context.obj([xLateral + 6, base, LATERAL - 12, topo - base]),
    )
  }

  // ---- Blocos à esquerda ----
  const obs = c.observacao_final?.trim()
  const limite = BASE_CORPO + (obs ? 20 : 0)
  const produtos = lerProdutos(c.produtos)
  const itensProdutos: Item[] = produtos.map((pr) => {
    const [principal, detalhe] = linhasDoProduto(pr)
    return { principal, detalhe: detalhe || undefined }
  })
  const itensAreas: Item[] = (c.areas ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => ({ principal: l }))
  const blocoProdutos: Bloco = { titulo: 'Produtos e quantidades', itens: itensProdutos }
  const blocoAreas: Bloco = { titulo: 'Áreas atendidas', itens: itensAreas }
  const meio = (blocos: Bloco[], topo: number) =>
    blocosDoMeio(p, f, blocos, M, LARGURA_BLOCOS, topo, limite, destaque)

  if (modelo.arranjo === 'areas_produtos' || modelo.arranjo === 'produtos_areas') {
    meio(
      modelo.arranjo === 'areas_produtos'
        ? [blocoAreas, blocoProdutos]
        : [blocoProdutos, blocoAreas],
      topoCorpo,
    )
  } else if (modelo.arranjo === 'reservatorios') {
    const yTabela = tabelaReservatorios(p, f, c, topoCorpo, destaque)
    meio([blocoProdutos, blocoAreas], yTabela - 12)
  } else {
    // Sucção: descrição, com MTR e volume
    const itens: Item[] = [
      ...(c.descricao ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => ({ principal: l })),
      ...(c.mtr?.trim() ? [{ principal: `MTR nº ${c.mtr.trim()}` }] : []),
      ...(c.volume?.trim() ? [{ principal: `Quantidade: ${c.volume.trim()}` }] : []),
    ]
    meio([{ titulo: 'Descrição do serviço', itens }, blocoProdutos], topoCorpo)
  }

  if (obs) {
    const l = quebrarLinhas(obs, f.medio, 9, LARGURA_BLOCOS)[0] ?? ''
    texto(p, l, M, BASE_CORPO + 4, 9, f.medio, COR.escuro)
  }

  // Rodapé da empresa
  p.drawLine({
    start: { x: M, y: yDivisa },
    end: { x: A4.largura - M, y: yDivisa },
    thickness: 0.6,
    color: COR.borda,
  })
  texto(
    p,
    `${rodape[0]}  ·  ${conf.email}`,
    A4.largura / 2,
    yr + 15,
    7.5,
    f.negrito,
    COR.escuro,
    'centro',
  )
  for (const l of linhasRodape) {
    texto(p, l, A4.largura / 2, yr + 3, 6.8, f.normal, COR.suave, 'centro')
    yr -= 9
  }

  if (c.cancelado_em) {
    p.drawText('CANCELADO', {
      x: 210,
      y: 150,
      size: 110,
      font: f.extra,
      color: COR.vermelho,
      opacity: 0.2,
      rotate: degrees(25),
    })
  }

  const bytes = await pdf.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/** Tabela dos reservatórios: quantidade · local · m³ · produto. Devolve o y de baixo. */
function tabelaReservatorios(
  p: PDFPage,
  f: Fontes,
  c: CertificadoResumo,
  y: number,
  destaque: RGB,
) {
  const linhas = lerReservatorios(c.reservatorios)
  const cabecalho = ['Quantidade', 'Local', 'Metragem cúbica', 'Produto utilizado']
  const larguras = [0.17, 0.37, 0.2, 0.26].map((r) => r * LARGURA_BLOCOS)
  const xs = larguras.map((_, i) => M + larguras.slice(0, i).reduce((s, v) => s + v, 0))
  const t = 9
  cartao(p, M, y - 26, LARGURA_BLOCOS, 26, 10, { cor: destaque })
  cabecalho.forEach((h, i) =>
    texto(p, h.toUpperCase(), xs[i] + 12, y - 16.5, 6.8, f.negrito, COR.branco, 'esquerda', 0.8),
  )
  y -= 26
  linhas.forEach((r, n) => {
    const celulas = [r.quantidade, r.local, r.metragem, r.produto].map((v, i) =>
      quebrarLinhas(v || '-', f.normal, t, larguras[i] - 20),
    )
    const altura = Math.max(...celulas.map((l) => l.length)) * t * 1.35 + 12
    if (n % 2 === 1)
      p.drawRectangle({
        x: M,
        y: y - altura,
        width: LARGURA_BLOCOS,
        height: altura,
        color: COR.fundoSuave,
      })
    celulas.forEach((cel, i) =>
      cel.forEach((l, j) =>
        texto(
          p,
          l,
          xs[i] + 12,
          y - 6 - t - j * t * 1.35,
          t,
          i === 0 ? f.medio : f.normal,
          COR.texto,
        ),
      ),
    )
    y -= altura
    p.drawLine({
      start: { x: M, y },
      end: { x: M + LARGURA_BLOCOS, y },
      thickness: 0.5,
      color: COR.borda,
    })
  })
  return y
}

/**
 * Abre o PDF numa aba nova (ou na mesma, se o navegador bloquear). Certificado com
 * assinatura digital vai antes ao servidor, que devolve o PDF assinado.
 */
export async function abrirPdfCertificado(c: CertificadoResumo, aba: Window | null) {
  const assinatura = await baixarAssinatura(assinaturaDoCertificado(c))
  let blob = await gerarPdfCertificado(c, assinatura)
  if (c.assinatura_digital) blob = await assinarPdfCertificado(c.id, blob)
  const link = URL.createObjectURL(blob)
  if (aba) aba.location.href = link
  else window.location.href = link
}
