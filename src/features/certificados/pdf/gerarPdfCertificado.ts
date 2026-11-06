import {
  degrees,
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
  type RGB,
} from 'pdf-lib'

import { enderecoDaFicha, fichaDaOs } from '@/features/os/api'
import { quebrarLinhas, textoSeguro } from '@/features/os/pdf/gerarPdfOs'
import { formatarCnpj, formatarCpf } from '@/lib/documentos'
import { UNIDADE } from '@/lib/unidade'

import type { CertificadoResumo } from '../api'
import {
  declaracao,
  lerProdutos,
  lerReservatorios,
  linhasDoProduto,
  localEData,
  mesCurto,
  MODELO,
  textoDias,
  textoValidadeMeses,
  textoValidoAte,
  type ModeloCertificado,
} from '../modelos'

/*
 * PDF do certificado, no navegador com pdf-lib (como o PDF da OS).
 * Segue os certificados em PowerPoint usados hoje: o fundo é a mesma arte (logo,
 * "CERTIFICADO" e gotas) na cor de cada serviço, e o texto vai por cima.
 *
 *   título · pragas-alvo · "Certificamos para os devidos fins…"
 *   blocos do meio (áreas e produtos | reservatórios | descrição da sucção)
 *   assinatura do responsável técnico · validade · rodapé da empresa
 */

const A4 = { largura: 595.28, altura: 841.89 }
const MARGEM = 34
const LARGURA_UTIL = A4.largura - MARGEM * 2
const PRETO = rgb(0, 0, 0)
const VERDE_EMAIL = rgb(0.15, 0.6, 0.2)
const VERMELHO = rgb(0.8, 0.1, 0.1)

// Faixas da página (em pontos, a partir de baixo)
const TOPO_CONTEUDO = A4.altura - 190 // logo abaixo da faixa do cabeçalho
const LIMITE_MEIO = 262 // os blocos do meio não descem daqui
const Y_LINHA_ASSINATURA = 245

type Fontes = { normal: PDFFont; negrito: PDFFont }

function documento(valor: string | null | undefined) {
  if (!valor) return ''
  return valor.length === 11 ? formatarCpf(valor) : formatarCnpj(valor)
}

function centro(
  p: PDFPage,
  texto: string,
  y: number,
  tamanho: number,
  fonte: PDFFont,
  cor: RGB = PRETO,
  centroX = A4.largura / 2,
) {
  const t = textoSeguro(texto)
  p.drawText(t, {
    x: centroX - fonte.widthOfTextAtSize(t, tamanho) / 2,
    y,
    size: tamanho,
    font: fonte,
    color: cor,
  })
}

function direita(
  p: PDFPage,
  texto: string,
  y: number,
  tamanho: number,
  fonte: PDFFont,
  xFim: number,
  cor: RGB = PRETO,
) {
  const t = textoSeguro(texto)
  p.drawText(t, {
    x: xFim - fonte.widthOfTextAtSize(t, tamanho),
    y,
    size: tamanho,
    font: fonte,
    color: cor,
  })
}

/** Parágrafo com trechos em negrito, quebrando as linhas; devolve o y seguinte. */
function paragrafo(
  p: PDFPage,
  f: Fontes,
  partes: { texto: string; negrito: boolean }[],
  y: number,
  tamanho: number,
  recuo: number,
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
  const largura = (w: Palavra) =>
    w.reduce(
      (s, q) => s + (q.negrito ? f.negrito : f.normal).widthOfTextAtSize(q.texto, tamanho),
      0,
    )
  const espaco = f.normal.widthOfTextAtSize(' ', tamanho)
  const entrelinha = tamanho * 1.45

  let linha: Palavra[] = []
  let ocupado = 0
  let primeira = true
  const escrever = (ultima: boolean) => {
    const inicio = MARGEM + (primeira ? recuo : 0)
    const disponivel = LARGURA_UTIL - (primeira ? recuo : 0)
    const somaPalavras = linha.reduce((s, w) => s + largura(w), 0)
    // Justificado, menos a última linha (como no PowerPoint).
    const vaos = linha.length - 1
    const folga = !ultima && vaos > 0 ? (disponivel - somaPalavras) / vaos : espaco
    let x = inicio
    for (const w of linha) {
      for (const q of w) {
        const fonte = q.negrito ? f.negrito : f.normal
        p.drawText(q.texto, { x, y, size: tamanho, font: fonte, color: PRETO })
        x += fonte.widthOfTextAtSize(q.texto, tamanho)
      }
      x += folga
    }
    y -= entrelinha
    primeira = false
    linha = []
    ocupado = 0
  }
  for (const w of palavras) {
    const disponivel = LARGURA_UTIL - (primeira ? recuo : 0)
    const extra = (linha.length ? espaco : 0) + largura(w)
    if (linha.length && ocupado + extra > disponivel) escrever(false)
    ocupado += (linha.length ? espaco : 0) + largura(w)
    linha.push(w)
  }
  if (linha.length) escrever(true)
  return y
}

/** Uma coluna de texto: título em negrito e linhas, alinhadas ao centro ou à direita. */
type Coluna = { titulos: string[]; linhas: string[] }

function alturaColuna(c: Coluna, f: Fontes, tamanho: number, largura: number) {
  const linhas = c.linhas.flatMap((l) => quebrarLinhas(l, f.normal, tamanho, largura))
  return (c.titulos.length + linhas.length) * tamanho * 1.4
}

function desenharColuna(
  p: PDFPage,
  f: Fontes,
  c: Coluna,
  y: number,
  tamanho: number,
  x0: number,
  largura: number,
  alinhamento: 'centro' | 'direita',
) {
  const entrelinha = tamanho * 1.4
  const escrever = (t: string, fonte: PDFFont) => {
    if (alinhamento === 'centro') centro(p, t, y, tamanho, fonte, PRETO, x0 + largura / 2)
    else direita(p, t, y, tamanho, fonte, x0 + largura)
    y -= entrelinha
  }
  for (const t of c.titulos) escrever(t, f.negrito)
  for (const l of c.linhas)
    for (const q of quebrarLinhas(l, f.normal, tamanho, largura)) escrever(q, f.normal)
}

/** Maior letra (de 10 até 6) em que as colunas cabem no espaço. */
function tamanhoQueCabe(colunas: Coluna[], f: Fontes, larguraColuna: number, altura: number) {
  for (let t = 10; t > 6; t -= 0.5) {
    if (colunas.every((c) => alturaColuna(c, f, t, larguraColuna) <= altura)) return t
  }
  return 6
}

export async function gerarPdfCertificado(c: CertificadoResumo): Promise<Blob> {
  const modelo = MODELO[c.modelo as ModeloCertificado] ?? MODELO.geral
  const ficha = fichaDaOs(c.ficha_cliente)
  const conf = UNIDADE.certificado
  const deContrato = c.tipo_validade === 'contrato'

  const pdf = await PDFDocument.create()
  pdf.setTitle(`${c.numero} - ${c.titulo}`)
  pdf.setAuthor(UNIDADE.nome)
  const f: Fontes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrito: await pdf.embedFont(StandardFonts.HelveticaBold),
  }
  const fundo = await pdf.embedJpg(
    await (await fetch(`/certificados/fundo-${modelo.fundo}.jpg`)).arrayBuffer(),
  )
  const p = pdf.addPage([A4.largura, A4.altura])
  p.drawImage(fundo, { x: 0, y: 0, width: A4.largura, height: A4.altura })

  // Número do certificado, discreto no canto (para achar no sistema).
  direita(p, c.numero, A4.altura - 182, 7, f.normal, A4.largura - MARGEM, rgb(0.45, 0.45, 0.45))

  // Título e pragas-alvo
  const corTitulo = rgb(...modelo.corTitulo)
  let y = TOPO_CONTEUDO - 18
  for (const linha of quebrarLinhas(c.titulo.toUpperCase(), f.negrito, 16, LARGURA_UTIL)) {
    centro(p, linha, y, 16, f.negrito, corTitulo)
    y -= 21
  }
  if (modelo.temPragas && c.pragas_alvo?.trim()) {
    for (const linha of quebrarLinhas(
      `Pragas Alvo (${c.pragas_alvo.trim()})`,
      f.negrito,
      13.5,
      LARGURA_UTIL,
    )) {
      centro(p, linha, y, 13.5, f.negrito, corTitulo)
      y -= 19
    }
  }
  y -= 14

  // "Certificamos para os devidos fins…"
  const doc = documento(ficha.cpf_cnpj)
  y = paragrafo(
    p,
    f,
    declaracao({
      servicoDescrito: c.servico_descrito,
      cliente: (ficha.razao_social || ficha.nome || '').toUpperCase(),
      // Contrato: a data vai na frase. Avulso: a data exata vai embaixo.
      dias: deContrato ? textoDias([c.data_execucao, ...(c.outras_datas ?? [])]) : '',
      endereco: enderecoDaFicha(ficha).replace(/ · /g, ' - '),
      documento: doc,
      ehCpf: (ficha.cpf_cnpj ?? '').length === 11,
      complemento: c.complemento,
    }),
    y,
    10,
    40,
  )
  y -= 28

  // Blocos do meio
  const altura = y - LIMITE_MEIO
  const produtos = lerProdutos(c.produtos)
  const areas = (c.areas ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const colProdutos: Coluna = {
    titulos: ['PRODUTOS E QTDE', '(Princípio ativo químico/Reg.Anvisa)'],
    linhas: produtos.flatMap((pr) => linhasDoProduto(pr).filter(Boolean)),
  }
  const colAreas: Coluna = { titulos: ['ÁREAS'], linhas: areas }
  const metade = LARGURA_UTIL / 2 - 10

  if (modelo.arranjo === 'areas_produtos' || modelo.arranjo === 'produtos_areas') {
    const [esq, dir] =
      modelo.arranjo === 'areas_produtos' ? [colAreas, colProdutos] : [colProdutos, colAreas]
    const visiveis = [esq, dir].filter((col) => col.linhas.length > 0)
    if (visiveis.length === 1) {
      // Só um dos blocos tem conteúdo: vai no centro da página.
      const larguraCentro = LARGURA_UTIL - 60
      const t = tamanhoQueCabe(visiveis, f, larguraCentro, altura)
      desenharColuna(p, f, visiveis[0], y, t, MARGEM + 30, larguraCentro, 'centro')
    } else if (visiveis.length === 2) {
      const t = tamanhoQueCabe(visiveis, f, metade, altura)
      desenharColuna(p, f, esq, y, t, MARGEM, metade, 'centro')
      desenharColuna(
        p,
        f,
        dir,
        y,
        t,
        MARGEM + LARGURA_UTIL - metade,
        metade,
        modelo.arranjo === 'areas_produtos' ? 'direita' : 'centro',
      )
    }
  } else if (modelo.arranjo === 'reservatorios') {
    const reservatorios = lerReservatorios(c.reservatorios)
    const cabecalho = ['QUANTIDADE', 'LOCAL', 'METRAGEM CÚBICA', 'PRODUTOS UTILIZADOS']
    const larguras = [0.2, 0.34, 0.22, 0.24].map((r) => r * LARGURA_UTIL)
    const centros = larguras.map(
      (w, i) => MARGEM + larguras.slice(0, i).reduce((s, v) => s + v, 0) + w / 2,
    )
    cabecalho.forEach((h, i) => {
      centro(p, h, y, 9.5, f.negrito, PRETO, centros[i])
      const w = f.negrito.widthOfTextAtSize(textoSeguro(h), 9.5)
      p.drawLine({
        start: { x: centros[i] - w / 2, y: y - 2 },
        end: { x: centros[i] + w / 2, y: y - 2 },
        thickness: 0.6,
        color: PRETO,
      })
    })
    y -= 16
    for (const r of reservatorios) {
      const celulas = [r.quantidade, r.local, r.metragem, r.produto].map((v, i) =>
        quebrarLinhas(v || '-', f.normal, 9.5, larguras[i] - 8),
      )
      const linhas = Math.max(...celulas.map((l) => l.length))
      celulas.forEach((cel, i) =>
        cel.forEach((l, j) => centro(p, l, y - j * 13, 9.5, f.normal, PRETO, centros[i])),
      )
      y -= linhas * 13 + 6
      if (y < LIMITE_MEIO) break
    }
    if (areas.length) {
      y -= 10
      desenharColuna(p, f, colAreas, y, 9.5, MARGEM, LARGURA_UTIL, 'centro')
    }
  } else {
    // Sucção: descrição no centro, com MTR e volume
    const linhas = [
      ...(c.descricao ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      c.mtr?.trim() && `MTR n° ${c.mtr.trim()}`,
      c.volume?.trim() && `Quantidade: ${c.volume.trim()}`,
    ].filter((l): l is string => !!l)
    const col: Coluna = { titulos: ['DESCRIÇÃO'], linhas }
    const t = tamanhoQueCabe([col], f, LARGURA_UTIL - 60, altura)
    desenharColuna(p, f, col, y, t, MARGEM + 30, LARGURA_UTIL - 60, 'centro')
    if (produtos.length) {
      // Produtos, se houver, embaixo da descrição.
      const yProdutos = y - alturaColuna(col, f, t, LARGURA_UTIL - 60) - 14
      if (yProdutos - alturaColuna(colProdutos, f, t, LARGURA_UTIL - 60) > LIMITE_MEIO)
        desenharColuna(p, f, colProdutos, yProdutos, t, MARGEM + 30, LARGURA_UTIL - 60, 'centro')
    }
  }

  // Assinatura do responsável técnico
  const resp =
    modelo.responsavelSuccao && conf.responsavelSuccao ? conf.responsavelSuccao : conf.responsavel
  const nome = c.responsavel_nome?.trim() || resp.nome
  const registro = c.responsavel_registro?.trim() || resp.registro
  p.drawLine({
    start: { x: A4.largura / 2 - 80, y: Y_LINHA_ASSINATURA },
    end: { x: A4.largura / 2 + 80, y: Y_LINHA_ASSINATURA },
    thickness: 0.7,
    color: PRETO,
  })
  let ya = Y_LINHA_ASSINATURA - 13
  const blocoAssinatura = [UNIDADE.certificado.rodape[0].toUpperCase(), nome, registro].filter(
    Boolean,
  )
  for (const linha of blocoAssinatura) {
    centro(p, linha, ya, 9, f.normal)
    ya -= 12
  }
  ya -= 4

  // Validade: contrato → "válido até" (fim do mês); avulso → data exata embaixo e meses ao lado.
  if (deContrato) {
    if (c.validade) centro(p, textoValidoAte(c.validade), ya, 9.5, f.normal)
  } else {
    centro(p, localEData(conf.cidade, c.data_execucao), ya, 9.5, f.normal)
    if (c.validade_meses)
      direita(p, textoValidadeMeses(c.validade_meses), ya - 14, 9.5, f.normal, A4.largura - MARGEM)
  }
  ya -= 17

  if (c.observacao_final?.trim()) {
    for (const l of quebrarLinhas(c.observacao_final.trim(), f.normal, 9.5, LARGURA_UTIL - 120)) {
      centro(p, l, ya, 9.5, f.normal)
      ya -= 12
    }
  }

  // Reservatório: lote do produto ao lado da assinatura (como no modelo).
  if (modelo.arranjo === 'reservatorios' && produtos.length) {
    let yl = Y_LINHA_ASSINATURA - 13
    for (const pr of produtos.slice(0, 3)) {
      const nomeProduto = pr.nome_comercial || pr.principio_ativo
      direita(
        p,
        [nomeProduto, pr.lote && `Lote ${pr.lote}`].filter(Boolean).join(' - '),
        yl,
        8.5,
        f.normal,
        A4.largura - MARGEM,
      )
      const datas = [
        pr.fabricacao && `Fab. ${mesCurto(pr.fabricacao)}`,
        pr.validade && `Val. ${mesCurto(pr.validade)}`,
      ]
        .filter(Boolean)
        .join(' - ')
      if (datas) direita(p, datas, yl - 11, 8.5, f.normal, A4.largura - MARGEM)
      yl -= 25
    }
  }

  // Rodapé da empresa
  const rodape = modelo.responsavelSuccao && conf.rodapeSuccao ? conf.rodapeSuccao : conf.rodape
  let yr = 22 + (rodape.length - 1) * 10.5
  centro(p, conf.email, yr + 13, 8.5, f.normal, VERDE_EMAIL)
  for (const [i, linha] of rodape.entries()) {
    centro(p, linha, yr, i === 0 ? 8.5 : 7.8, i === 0 ? f.negrito : f.normal)
    yr -= 10.5
  }

  if (c.cancelado_em) {
    p.drawText('CANCELADO', {
      x: 120,
      y: 280,
      size: 90,
      font: f.negrito,
      color: VERMELHO,
      opacity: 0.22,
      rotate: degrees(40),
    })
  }

  const bytes = await pdf.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/** Abre o PDF numa aba nova (ou na mesma, se o navegador bloquear). */
export async function abrirPdfCertificado(c: CertificadoResumo, aba: Window | null) {
  const blob = await gerarPdfCertificado(c)
  const link = URL.createObjectURL(blob)
  if (aba) aba.location.href = link
  else window.location.href = link
}
