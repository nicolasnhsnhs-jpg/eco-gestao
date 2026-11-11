import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'

import { formatarData } from '@/lib/datas'
import { formatarCnpj, formatarCpf, formatarTelefone } from '@/lib/documentos'
import { UNIDADE } from '@/lib/unidade'

import { enderecoDaFicha, fichaDaOs, type OsCompleta } from '../api'
import { nomeVeiculo } from '../nomeVeiculo'
import type { PontoOs } from '../pragasApi'
import {
  PERGUNTAS_CONFERENCIA_BEBEDOURO,
  TIPOS_BEBEDOURO,
  TRABALHO,
  etiqueta,
  type TipoBebedouro,
} from '../tipos/bebedouro'
import {
  AVISO_DESLOCAMENTO,
  CONDICOES_AMBIENTE,
  ESCOAMENTO,
  FOTOS_DEPOIS,
  INFORMACOES_TECNICAS,
  MATERIAIS,
  PERGUNTAS_CONFERENCIA,
  PERGUNTAS_LIBERACAO,
  PRODUTO_PADRAO,
  QUANTIDADES_PRODUTO,
  SUJIDADE,
  type EscopoCoifa,
} from '../tipos/coifa'
import {
  CONDICOES,
  ESPECIES,
  FORMAS_PRODUTO,
  HIGIENE,
  NIVEIS,
  PRAGAS_ALVO,
  PRAGAS_INSETOS,
  PROCEDIMENTOS,
  REFIL,
  SITUACOES_ARMADILHA,
  SITUACOES_ISCA,
  SITUACOES_PLACA,
  type EscopoPragas,
} from '../tipos/pragas'
import { EMPRESA_RODAPE, quebrarLinhas, textoSeguro } from './gerarPdfOs'
import { buscarDadosPragas } from './pragasPdf'

/*
 * OS física (via de campo): a mesma OS da tela, impressa para o técnico preencher
 * à caneta enquanto as equipes aprendem a OS digital. O que o escritório lançou sai
 * preenchido; o que o técnico preenche no celular sai em branco (linhas, quadrinhos
 * e tabelas), na mesma ordem das etapas do app, para depois passar para o sistema.
 * Não é guardada nos arquivos da OS: é só para imprimir.
 */

const A4 = { largura: 595.28, altura: 841.89 }
const MARGEM = 36
const LARGURA = A4.largura - MARGEM * 2
const VERDE = rgb(0.243, 0.482, 0.122)
const VERDE_ESCURO = rgb(0.122, 0.302, 0.102)
const VERDE_CLARO = rgb(0.93, 0.96, 0.91)
const CINZA = rgb(0.4, 0.4, 0.4)
const TRACO = rgb(0.55, 0.6, 0.55)
const PRETO = rgb(0, 0, 0)

type Coluna = { titulo: string; largura: number }

class Folha {
  pagina!: PDFPage
  y = 0
  paginas = 0
  private pdf: PDFDocument
  private normal: PDFFont
  private negrito: PDFFont
  private numero: string

  constructor(pdf: PDFDocument, normal: PDFFont, negrito: PDFFont, numero: string) {
    this.pdf = pdf
    this.normal = normal
    this.negrito = negrito
    this.numero = numero
    this.novaPagina()
  }

  novaPagina() {
    this.pagina = this.pdf.addPage([A4.largura, A4.altura])
    this.paginas++
    this.y = A4.altura - MARGEM
    this.pagina.drawLine({
      start: { x: MARGEM, y: 44 },
      end: { x: A4.largura - MARGEM, y: 44 },
      thickness: 0.6,
      color: TRACO,
    })
    for (const [i, linha] of EMPRESA_RODAPE.entries()) {
      const t = textoSeguro(linha)
      const fonte = i === 0 ? this.negrito : this.normal
      this.pagina.drawText(t, {
        x: (A4.largura - fonte.widthOfTextAtSize(t, 7.5)) / 2,
        y: 34 - i * 9,
        size: 7.5,
        font: fonte,
        color: i === 0 ? VERDE_ESCURO : CINZA,
      })
    }
    // Da 2ª página em diante, o número da OS no alto, para não misturar as folhas.
    if (this.paginas > 1) {
      const t = textoSeguro(`${this.numero} · via de campo · folha ${this.paginas}`)
      this.pagina.drawText(t, {
        x: A4.largura - MARGEM - this.normal.widthOfTextAtSize(t, 8),
        y: this.y - 8,
        size: 8,
        font: this.normal,
        color: CINZA,
      })
      this.y -= 16
    }
  }

  garantir(altura: number) {
    if (this.y - altura < MARGEM + 24) this.novaPagina()
  }

  escrever(texto: string, x: number, y: number, tamanho = 9, negrito = false, cor = PRETO) {
    this.pagina.drawText(textoSeguro(texto), {
      x,
      y,
      size: tamanho,
      font: negrito ? this.negrito : this.normal,
      color: cor,
    })
  }

  larguraTexto(texto: string, tamanho = 9, negrito = false) {
    return (negrito ? this.negrito : this.normal).widthOfTextAtSize(textoSeguro(texto), tamanho)
  }

  secao(titulo: string, alturaMinima = 60) {
    this.garantir(alturaMinima + 26)
    this.y -= 10
    this.pagina.drawRectangle({
      x: MARGEM,
      y: this.y - 16,
      width: LARGURA,
      height: 17,
      color: VERDE,
    })
    this.escrever(titulo.toUpperCase(), MARGEM + 6, this.y - 11.5, 9.5, true, rgb(1, 1, 1))
    this.y -= 23
  }

  /** Dado já lançado pelo escritório: "Rótulo: valor". */
  dado(rotulo: string, valor: string | null | undefined) {
    const larguraRotulo = 92
    const linhas = quebrarLinhas(valor || '—', this.normal, 9, LARGURA - larguraRotulo)
    this.garantir(linhas.length * 12 + 2)
    this.escrever(rotulo, MARGEM, this.y - 9, 9, true, VERDE_ESCURO)
    for (const linha of linhas) {
      this.escrever(linha, MARGEM + larguraRotulo, this.y - 9)
      this.y -= 12
    }
    this.y -= 1
  }

  /** Texto corrido (avisos, informações técnicas). */
  paragrafo(texto: string, tamanho = 8.5, cor = PRETO) {
    const linhas = quebrarLinhas(texto, this.normal, tamanho, LARGURA)
    this.garantir(linhas.length * (tamanho + 3))
    for (const linha of linhas) {
      this.escrever(linha, MARGEM, this.y - tamanho, tamanho, false, cor)
      this.y -= tamanho + 3
    }
    this.y -= 2
  }

  /** Linha para escrever à mão, de x até xFim, na altura y. */
  traco(x: number, xFim: number, y: number) {
    this.pagina.drawLine({ start: { x, y }, end: { x: xFim, y }, thickness: 0.6, color: TRACO })
  }

  /** "Rótulo ______" em várias linhas (a primeira começa ao lado do rótulo). */
  escrita(rotulo: string, linhas = 1) {
    const altura = 20
    this.garantir(linhas * altura + 4)
    const xInicio = MARGEM + this.larguraTexto(rotulo, 9, true) + 6
    this.escrever(rotulo, MARGEM, this.y - 14, 9, true, VERDE_ESCURO)
    for (let i = 0; i < linhas; i++) {
      this.traco(i === 0 ? xInicio : MARGEM, MARGEM + LARGURA, this.y - 16)
      this.y -= altura
    }
    this.y -= 2
  }

  /** Vários campos curtos na mesma linha: "Data ____  KM ____". */
  camposLinha(campos: { rotulo: string; largura: number }[]) {
    this.garantir(24)
    let x = MARGEM
    const total = campos.reduce((s, c) => s + c.largura, 0)
    for (const c of campos) {
      const largura = (c.largura / total) * LARGURA
      this.escrever(c.rotulo, x, this.y - 14, 9, true, VERDE_ESCURO)
      this.traco(x + this.larguraTexto(c.rotulo, 9, true) + 5, x + largura - 12, this.y - 16)
      x += largura
    }
    this.y -= 24
  }

  /** Quadrinho para marcar com X. Devolve onde termina o texto. */
  quadrinho(x: number, y: number, texto: string, tamanho = 8.5) {
    this.pagina.drawRectangle({
      x,
      y: y - 1,
      width: 9,
      height: 9,
      borderColor: PRETO,
      borderWidth: 0.8,
    })
    this.escrever(texto, x + 12, y, tamanho)
    return x + 12 + this.larguraTexto(texto, tamanho)
  }

  /** "Rótulo  ☐ A  ☐ B  ☐ C", quebrando a linha quando não cabe. */
  opcoes(rotulo: string, opcoes: string[], tamanho = 8.5) {
    this.garantir(18)
    this.escrever(rotulo, MARGEM, this.y - 10, 9, true, VERDE_ESCURO)
    const xInicio = rotulo ? MARGEM + Math.max(92, this.larguraTexto(rotulo, 9, true) + 8) : MARGEM
    let x = xInicio
    for (const opcao of opcoes) {
      const largura = 12 + this.larguraTexto(opcao, tamanho) + 14
      if (x + largura > MARGEM + LARGURA && x > xInicio) {
        this.y -= 15
        this.garantir(18)
        x = xInicio
      }
      this.quadrinho(x, this.y - 10, opcao, tamanho)
      x += largura
    }
    this.y -= 18
  }

  /** Pergunta de sim/não com linha para o motivo. */
  simNao(pergunta: string, detalhe?: string) {
    const larguraPergunta = LARGURA - 110
    const linhas = quebrarLinhas(pergunta, this.normal, 9, larguraPergunta)
    this.garantir(linhas.length * 12 + (detalhe ? 22 : 6))
    const topo = this.y
    for (const linha of linhas) {
      this.escrever(linha, MARGEM, this.y - 10, 9)
      this.y -= 12
    }
    const xSim = MARGEM + LARGURA - 100
    this.quadrinho(xSim, topo - 10, 'Sim')
    this.quadrinho(xSim + 50, topo - 10, 'Não')
    if (detalhe) {
      this.escrever(`${detalhe}:`, MARGEM + 10, this.y - 12, 8, false, CINZA)
      this.traco(MARGEM + 14 + this.larguraTexto(`${detalhe}:`, 8), MARGEM + LARGURA, this.y - 14)
      this.y -= 20
    }
    this.y -= 4
  }

  /** Legenda de códigos em letra miúda: "MS Mantido sem consumo · MC …". */
  legenda(titulo: string, codigos: Record<string, string>) {
    this.paragrafo(
      `${titulo}: ${Object.entries(codigos)
        .map(([c, n]) => `${c} = ${n}`)
        .join(' · ')}`,
      7.5,
      CINZA,
    )
  }

  /**
   * Tabela com grade. As células com texto saem preenchidas; as vazias ficam para
   * escrever. `vazias` acrescenta linhas em branco no fim (produtos, insetos).
   */
  tabela(colunas: Coluna[], linhas: string[][], vazias = 0, alturaLinha = 20) {
    const total = colunas.reduce((s, c) => s + c.largura, 0)
    const larguras = colunas.map((c) => (c.largura / total) * LARGURA)
    const tamanho = 7.5
    const cabecalho = () => {
      // Cabeçalho pode quebrar em duas linhas ("Lâmpadas / trocadas").
      const quebras = colunas.map((c, i) =>
        quebrarLinhas(c.titulo, this.negrito, tamanho, larguras[i] - 4),
      )
      const altura = Math.max(...quebras.map((q) => q.length)) * 9 + 6
      let x = MARGEM
      this.pagina.drawRectangle({
        x: MARGEM,
        y: this.y - altura,
        width: LARGURA,
        height: altura,
        color: VERDE_CLARO,
        borderColor: TRACO,
        borderWidth: 0.6,
      })
      for (const [i, q] of quebras.entries()) {
        for (const [j, linha] of q.entries())
          this.escrever(linha, x + 3, this.y - 10 - j * 9, tamanho, true, VERDE_ESCURO)
        if (i > 0) this.linhaVertical(x, this.y, this.y - altura)
        x += larguras[i]
      }
      this.y -= altura
    }
    this.garantir(alturaLinha * 2 + 24)
    cabecalho()
    const todas = [...linhas, ...Array.from({ length: vazias }, () => colunas.map(() => ''))]
    for (const linha of todas) {
      // Texto longo na célula quebra em até duas linhas.
      const celulas = linha.map((t, i) =>
        quebrarLinhas(t, this.normal, tamanho, larguras[i] - 5).slice(0, 2),
      )
      const altura = Math.max(alturaLinha, ...celulas.map((c) => c.length * 9 + 6))
      if (this.y - altura < MARGEM + 24) {
        this.novaPagina()
        cabecalho()
      }
      this.pagina.drawRectangle({
        x: MARGEM,
        y: this.y - altura,
        width: LARGURA,
        height: altura,
        borderColor: TRACO,
        borderWidth: 0.6,
      })
      let x = MARGEM
      for (const [i, c] of celulas.entries()) {
        for (const [j, t] of c.entries()) this.escrever(t, x + 3, this.y - 10 - j * 9, tamanho)
        if (i > 0) this.linhaVertical(x, this.y, this.y - altura)
        x += larguras[i]
      }
      this.y -= altura
    }
    this.y -= 6
  }

  private linhaVertical(x: number, y1: number, y2: number) {
    this.pagina.drawLine({
      start: { x, y: y1 },
      end: { x, y: y2 },
      thickness: 0.6,
      color: TRACO,
    })
  }

  /**
   * Grade de porta-iscas: um quadrinho por número, com espaço para o código da
   * situação. Uma faixa por área e tipo de isca.
   */
  gradePontos(titulo: string, numeros: number[]) {
    const colunas = 12
    const lado = LARGURA / colunas
    const altura = 24
    this.garantir(14 + altura)
    this.escrever(titulo, MARGEM, this.y - 9, 8.5, true, VERDE_ESCURO)
    this.y -= 13
    for (let i = 0; i < numeros.length; i += colunas) {
      if (this.y - altura < MARGEM + 24) {
        this.novaPagina()
        this.escrever(`${titulo} (continuação)`, MARGEM, this.y - 9, 8.5, true, VERDE_ESCURO)
        this.y -= 13
      }
      for (const [j, n] of numeros.slice(i, i + colunas).entries()) {
        const x = MARGEM + j * lado
        this.pagina.drawRectangle({
          x,
          y: this.y - altura,
          width: lado,
          height: altura,
          borderColor: TRACO,
          borderWidth: 0.6,
        })
        this.escrever(String(n).padStart(2, '0'), x + 2.5, this.y - 7.5, 6.5, true, CINZA)
      }
      this.y -= altura
    }
    this.y -= 6
  }

  /** Quadros de assinatura lado a lado, com nome e rótulo embaixo. */
  assinaturas(quadros: { rotulo: string; nome?: string }[]) {
    const altura = 92
    this.garantir(altura)
    const espaco = 18
    const largura = (LARGURA - espaco * (quadros.length - 1)) / quadros.length
    for (const [i, q] of quadros.entries()) {
      const x = MARGEM + i * (largura + espaco)
      this.escrever('Nome:', x, this.y - 12, 8.5, true, VERDE_ESCURO)
      if (q.nome) this.escrever(q.nome, x + 30, this.y - 12, 8.5)
      else this.traco(x + 30, x + largura, this.y - 14)
      this.traco(x, x + largura, this.y - 66)
      this.escrever(q.rotulo, x, this.y - 77, 8.5, false, CINZA)
    }
    this.y -= altura
  }
}

function documento(valor: string | null | undefined) {
  if (!valor) return ''
  return valor.length === 11 ? formatarCpf(valor) : formatarCnpj(valor)
}

/** Agrupa os porta-iscas por área e tipo de isca, na ordem dos números. */
function porArea(pontos: PontoOs[]) {
  const grupos = new Map<string, number[]>()
  for (const p of [...pontos].sort((a, b) => a.numero - b.numero)) {
    const isca = [p.forma_iscagem, p.tipo_isca].filter(Boolean).join(' · ')
    const chave = isca ? `${p.area} (${isca})` : p.area
    grupos.set(chave, [...(grupos.get(chave) ?? []), p.numero])
  }
  return [...grupos]
}

function escreverPragas(f: Folha, os: OsCompleta, pontos: PontoOs[]) {
  const escopo = (os.escopo ?? {}) as EscopoPragas
  const portaIscas = pontos.filter((p) => p.tipo === 'porta_isca')
  const armadilhas = pontos.filter((p) => p.tipo === 'armadilha_luminosa')

  f.secao('Porta-iscas')
  if (portaIscas.length > 0) {
    f.paragrafo(
      `${portaIscas.length} porta-iscas. Escreva no quadrinho o código da situação de cada um. ` +
        'Em branco = MS (mantido sem consumo); nas placas de cola, em branco = M (mantido).',
      8.5,
    )
    f.legenda('Iscas', SITUACOES_ISCA)
    if (portaIscas.some((p) => p.tipo_isca === 'CO')) f.legenda('Placas de cola', SITUACOES_PLACA)
    for (const [area, numeros] of porArea(portaIscas)) f.gradePontos(area, numeros)
  } else {
    f.paragrafo('Nenhum porta-isca cadastrado neste local.', 8.5, CINZA)
  }
  const alvo = escopo.pragas_alvo ?? []
  f.opcoes(
    'Pragas alvo',
    PRAGAS_ALVO.map((p) => (alvo.includes(p) ? `${p} (contrato)` : p)),
  )
  f.opcoes('Nível de infestação', Object.values(NIVEIS))
  f.escrita('Porta-iscas sem acesso (quais e por quê):', 2)
  f.escrita('Porta-iscas quebrados (quais e por quê):', 2)
  f.escrita('Comentários:', 2)

  f.secao('Produtos utilizados')
  f.paragrafo(`Formas: ${Object.values(FORMAS_PRODUTO).join(' · ')}`, 7.5, CINZA)
  f.tabela(
    [
      { titulo: 'Produto', largura: 4 },
      { titulo: 'Forma', largura: 2.5 },
      { titulo: 'Unidades', largura: 1.2 },
      { titulo: 'Gramas', largura: 1.2 },
    ],
    [],
    5,
  )

  if (armadilhas.length > 0) {
    const contrato = escopo.armadilhas_contrato ?? armadilhas.length
    f.secao(`Armadilhas luminosas (${contrato} no contrato)`)
    f.legenda('Situação', SITUACOES_ARMADILHA)
    f.legenda('Refil', REFIL)
    f.legenda('Higiene', HIGIENE)
    f.tabela(
      [
        { titulo: 'Nº · Área', largura: 3.2 },
        { titulo: 'Modelo', largura: 1 },
        { titulo: 'Última troca de lâmpada', largura: 1.5 },
        { titulo: 'Situação', largura: 1.1 },
        { titulo: 'Refil', largura: 0.9 },
        { titulo: 'Lâmpadas trocadas (S/N)', largura: 1.2 },
        { titulo: 'Higiene', largura: 1 },
        ...Object.values(ESPECIES).map((nome) => ({ titulo: nome, largura: 1 })),
      ],
      armadilhas
        .sort((a, b) => a.numero - b.numero)
        .map((a) => [
          `${String(a.numero).padStart(2, '0')} · ${a.area}`,
          a.modelo_armadilha === 'P' ? 'Branca (P)' : a.modelo_armadilha === 'G' ? 'Inox (G)' : '',
          a.ultima_troca_lampada ? formatarData(a.ultima_troca_lampada) : 'sem registro',
          '',
          '',
          '',
          '',
          ...Object.keys(ESPECIES).map(() => ''),
        ]),
      0,
      24,
    )
    f.paragrafo(
      'Capturas: escreva a quantidade de cada inseto (0 se não houver). Troca de lâmpada com custo à parte.',
      8,
      CINZA,
    )
  }

  if (escopo.subtipo === 'insetos_roedores') {
    f.secao('Controle de insetos')
    f.dado('Áreas do cliente', escopo.areas_insetos)
    f.opcoes('Monitoramento', ['Realizado nas áreas descritas', 'Não realizado'])
    f.legenda('Praga', PRAGAS_INSETOS)
    f.legenda('Nível', NIVEIS)
    f.legenda('Condições', CONDICOES)
    f.legenda('Procedimento', PROCEDIMENTOS)
    f.tabela(
      [
        { titulo: 'Área', largura: 3 },
        { titulo: 'Praga', largura: 1 },
        { titulo: 'Nível', largura: 0.9 },
        { titulo: 'Condições', largura: 1.1 },
        { titulo: 'Princípio ativo', largura: 2.2 },
        { titulo: 'Quantidade', largura: 1.3 },
        { titulo: 'Procedimento', largura: 1.3 },
      ],
      [],
      6,
    )
  }

  f.secao('Observações gerais')
  f.simNao('Medidas preventivas recomendadas?', 'Se sim, quais')
  f.escrita('Comentários e locais de aplicação:', 2)
  f.escrita('Solicitações ou considerações do cliente:', 2)
  f.escrita('Outras observações:', 2)
}

function escreverCoifa(f: Folha, os: OsCompleta, pontos: PontoOs[]) {
  const coifas = pontos.filter((p) => p.tipo === 'coifa')

  f.secao('Liberação para trabalho')
  for (const p of PERGUNTAS_LIBERACAO) f.simNao(p.texto, p.detalhe)
  f.opcoes(
    'Ambiente',
    Object.entries(CONDICOES_AMBIENTE).map(([c, n]) => `${c} · ${n}`),
  )
  f.opcoes('Escoamento do piso', Object.values(ESCOAMENTO))
  f.escrita('Observação do escoamento:')
  f.paragrafo(`Atenção: ${AVISO_DESLOCAMENTO}`, 8.5)

  f.secao('Coifas')
  f.legenda('Sujidade', SUJIDADE)
  f.tabela(
    [
      { titulo: 'Qtd. · Área', largura: 3.5 },
      { titulo: 'Material', largura: 1.4 },
      { titulo: 'Sujidade (B/M/A)', largura: 1.2 },
      { titulo: 'Nº de telas', largura: 1 },
      { titulo: 'Foto antes (S/N)', largura: 1 },
    ],
    coifas.map((c) => [
      `${c.quantidade ?? 1}x ${c.area}`,
      MATERIAIS[c.material as keyof typeof MATERIAIS] ?? '',
      '',
      '',
      '',
    ]),
    coifas.length === 0 ? 3 : 0,
  )

  f.secao('Telas e fotos depois')
  f.simNao('Telas retiradas para higienização na empresa?', 'Quantas')
  f.opcoes('Fotos depois', Object.values(FOTOS_DEPOIS))

  f.secao('Produto utilizado')
  f.dado('Produto', ((os.escopo ?? {}) as EscopoCoifa).produto ?? PRODUTO_PADRAO)
  f.opcoes('Quantidade', [
    ...QUANTIDADES_PRODUTO.map((ml) => `${ml.toLocaleString('pt-BR')} ml`),
    'Outra: ________ ml',
  ])

  f.secao('Conferência com o cliente')
  for (const p of PERGUNTAS_CONFERENCIA) f.simNao(p.texto, 'Se não, motivo')
  f.escrita('Observações:', 3)

  f.secao('Informações técnicas')
  for (const linha of INFORMACOES_TECNICAS) f.paragrafo(`• ${linha}`, 8)
}

function escreverBebedouro(f: Folha, pontos: PontoOs[]) {
  f.secao('Trabalho a ser realizado')
  f.opcoes('Trabalho', Object.values(TRABALHO))

  let algum = false
  for (const tipo of Object.keys(TIPOS_BEBEDOURO) as TipoBebedouro[]) {
    const lista = pontos.filter((p) => p.tipo === tipo).sort((a, b) => a.numero - b.numero)
    if (lista.length === 0) continue
    algum = true
    f.secao(TIPOS_BEBEDOURO[tipo].titulo)
    f.tabela(
      [
        { titulo: 'Etiqueta · Área', largura: 3 },
        { titulo: 'Filtro', largura: 1.5 },
        { titulo: 'Limpeza anterior', largura: 1.2 },
        { titulo: 'Limpo (Ok/Não)', largura: 1 },
        { titulo: 'Troca de filtro (S/N)', largura: 1 },
        { titulo: 'Observação', largura: 2.5 },
      ],
      lista.map((b) => [
        `${etiqueta(b.numero)} · ${b.area}`,
        b.codigo_filtro ?? '',
        b.ultima_limpeza ? formatarData(b.ultima_limpeza) : '—',
        '',
        '',
        '',
      ]),
    )
  }
  if (!algum) {
    f.secao('Bebedouros')
    f.tabela(
      [
        { titulo: 'Etiqueta · Área', largura: 3 },
        { titulo: 'Filtro', largura: 1.5 },
        { titulo: 'Limpo (Ok/Não)', largura: 1 },
        { titulo: 'Troca de filtro (S/N)', largura: 1 },
        { titulo: 'Observação', largura: 2.5 },
      ],
      [],
      6,
    )
  }

  f.secao('Conferência com o cliente')
  for (const p of PERGUNTAS_CONFERENCIA_BEBEDOURO) f.simNao(p.texto, p.detalhe)
  f.escrita('Observações:', 3)
}

/** Monta a OS física (em branco para o técnico) e devolve o PDF. */
export async function gerarFichaCampo(os: OsCompleta) {
  const formulario = os.tipo?.formulario_os
  const comPontos = formulario === 'pragas' || formulario === 'coifa' || formulario === 'bebedouro'
  const pontos = comPontos ? (await buscarDadosPragas(os.id)).pontos : []

  const ficha = fichaDaOs(os.ficha_cliente)
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${os.numero} - via de campo`)
  pdf.setAuthor(UNIDADE.nome)
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const logo = await pdf.embedJpg(await (await fetch('/logo-pdf.jpg')).arrayBuffer())

  const f = new Folha(pdf, normal, negrito, os.numero)

  // Cabeçalho: logo à esquerda; número, serviço e "via de campo" à direita.
  const alturaLogo = 54
  f.pagina.drawImage(logo, {
    x: MARGEM,
    y: f.y - alturaLogo,
    width: (logo.width / logo.height) * alturaLogo,
    height: alturaLogo,
  })
  const direita = (texto: string, deslocamento: number, tamanho: number, fonte: PDFFont) => {
    const t = textoSeguro(texto)
    f.pagina.drawText(t, {
      x: A4.largura - MARGEM - fonte.widthOfTextAtSize(t, tamanho),
      y: f.y - deslocamento,
      size: tamanho,
      font: fonte,
      color: VERDE_ESCURO,
    })
  }
  direita('ORDEM DE SERVIÇO', 14, 14, negrito)
  direita(os.numero, 30, 11, negrito)
  direita(os.tipo?.nome ?? '', 43, 10, normal)
  direita('Via de campo · preencher à caneta', 54, 8, normal)
  f.y -= alturaLogo + 4

  f.secao('Cliente')
  f.dado('Cliente', [ficha.nome_fantasia, ficha.nome].filter(Boolean).join(' · '))
  if (ficha.razao_social && ficha.razao_social !== ficha.nome)
    f.dado('Razão social', ficha.razao_social)
  f.dado('CPF/CNPJ', documento(ficha.cpf_cnpj))
  if (ficha.unidade?.apelido) f.dado('Unidade', ficha.unidade.apelido)
  f.dado('Endereço', enderecoDaFicha(ficha))
  f.dado(
    'Telefone',
    [ficha.telefone, ficha.whatsapp].filter(Boolean).map(formatarTelefone).join(' · '),
  )
  for (const c of ficha.contatos ?? []) {
    f.dado(
      'Contato',
      [c.nome, c.cargo, formatarTelefone(c.telefone), c.email].filter(Boolean).join(' · '),
    )
  }

  f.secao('Serviço')
  f.dado(
    'Agendado para',
    `${formatarData(os.data_agendada)}${os.hora_agendada ? ` às ${os.hora_agendada.slice(0, 5)}` : ''}`,
  )
  f.dado(
    'Operadores',
    os.operadores
      .map((o) => o.operador?.nome)
      .filter(Boolean)
      .join(', '),
  )
  if (os.descricao) f.dado('Descrição', os.descricao)
  if (os.observacoes_adm) f.dado('Observações ADM', os.observacoes_adm)

  f.secao('Chegada e horários')
  f.camposLinha([
    { rotulo: 'Data', largura: 1 },
    { rotulo: 'KM na chegada', largura: 1 },
  ])
  if (os.veiculo) f.dado('Veículo', nomeVeiculo(os.veiculo))
  else f.camposLinha([{ rotulo: 'Veículo', largura: 1 }])
  f.camposLinha([
    { rotulo: 'Chegada', largura: 1 },
    { rotulo: 'Início', largura: 1 },
    { rotulo: 'Término', largura: 1 },
    { rotulo: 'Saída', largura: 1 },
  ])

  if (formulario === 'pragas') escreverPragas(f, os, pontos)
  else if (formulario === 'coifa') escreverCoifa(f, os, pontos)
  else if (formulario === 'bebedouro') escreverBebedouro(f, pontos)
  else {
    f.secao('Serviço realizado')
    f.escrita('Resultado:', 6)
    f.escrita('Observações:', 4)
  }

  f.secao('Quem acompanhou e assinaturas', 120)
  f.camposLinha([
    { rotulo: 'Acompanhou (nome)', largura: 3 },
    { rotulo: 'Setor', largura: 2 },
  ])
  f.y -= 6
  f.assinaturas([
    { rotulo: 'Assinatura de quem acompanhou pelo cliente' },
    { rotulo: 'Operador (nome completo e visto)' },
  ])

  return pdf.save()
}
