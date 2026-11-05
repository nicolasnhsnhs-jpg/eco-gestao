// DANFSe: o PDF (Documento Auxiliar da NFS-e) montado a partir do XML autorizado pela
// Sefin Nacional. A API oficial de PDF está sendo desativada (NT 008/2026), então o PDF
// é gerado aqui, no leiaute do DANFSe v2.0 do portal nacional (blocos com o título à
// esquerda e quatro colunas), com a logo da empresa no topo e o QR Code da consulta.

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1'
import QRCode from 'npm:qrcode@1.5.4'

import { LOGO_JPG_BASE64 } from './logo.ts'
import { grupo, tag } from './sefin.ts'

const PRETO = rgb(0, 0, 0)
const FUNDO = rgb(0.93, 0.93, 0.93)
const A4 = { largura: 595.28, altura: 841.89 }
const MARGEM = 20
const LARGURA = A4.largura - 2 * MARGEM
const COLUNA = LARGURA / 4
const ROTULO = 6
const VALOR = 7.5
/** Altura do canhoto (data, assinatura, número) no pé da última página. */
const CANHOTO = 34

export const urlConsultaPublica = (chave: string) =>
  `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${chave}`

// As fontes padrão do PDF só têm o alfabeto latino (WinAnsi): troca o que não cabe.
const TROCAS: Record<string, string> = {
  '–': '-',
  '—': '-',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '•': '-',
  ' ': ' ',
}
function seguro(t: string): string {
  return t.replace(/[–—‘’“”• ]/g, (c) => TROCAS[c]).replace(/[^\n -~¡-ÿ]/g, '')
}

const reais = (v: string | null) =>
  v == null || v === ''
    ? '-'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ')
const data = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-')
const dataHora = (iso: string | null) => (iso ? `${data(iso)} ${iso.slice(11, 19)}` : '-')
function documento(v: string | null): string {
  const d = (v ?? '').replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return v || '-'
}
const cep = (v: string | null) => (v ? v.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2-$3') : '-')
const ibge = (v: string | null) => (v ? `${v.slice(0, 2)}.${v.slice(2)}` : '-')
const porcento = (v: string | null) => (v ? `${v.replace('.', ',')} %` : '-')
const ou = (...v: (string | null | undefined)[]) => v.find((x) => x != null && x !== '') ?? null

// UF pelo código IBGE do município (os dois primeiros dígitos).
const UF: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
}
const uf = (codigo: string | null) => (codigo ? (UF[codigo.slice(0, 2)] ?? '') : '')

const TRIB_ISSQN: Record<string, string> = {
  '1': 'Operação Tributável',
  '2': 'Imunidade',
  '3': 'Exportação de Serviço',
  '4': 'Não Incidência',
}
const RET_ISSQN: Record<string, string> = {
  '1': 'Não Retido',
  '2': 'Retido pelo Tomador',
  '3': 'Retido pelo Intermediário',
}
const REGIME_SN: Record<string, string> = {
  '1': 'Não optante',
  '2': 'Optante - MEI',
  '3': 'Optante - ME/EPP',
}
const RET_PISCOFINS: Record<string, string> = {
  '0': 'PIS/COFINS/CSLL Não Retidos',
  '1': 'PIS/COFINS Retidos',
  '2': 'PIS/COFINS Não Retidos',
  '3': 'PIS/COFINS/CSLL Retidos',
  '4': 'PIS/COFINS Retidos, CSLL Não Retido',
  '5': 'PIS Retido, COFINS/CSLL Não Retidos',
  '6': 'COFINS Retido, PIS/CSLL Não Retidos',
  '7': 'PIS Não Retido, COFINS/CSLL Retidos',
  '8': 'PIS/COFINS Não Retidos, CSLL Retido',
  '9': 'COFINS Não Retido, PIS/CSLL Retidos',
}
const EMITENTE: Record<string, string> = {
  '1': 'Prestador',
  '2': 'Tomador',
  '3': 'Intermediário',
}

/** Uma célula do bloco: rótulo em negrito em cima, valor embaixo; ocupa `colunas` de 4. */
type Celula = { rotulo?: string; valor?: string; colunas?: number; fundo?: boolean }

class Danfse {
  private paginas: PDFPage[] = []
  pagina!: PDFPage
  y = 0

  constructor(
    private pdf: PDFDocument,
    private fonte: PDFFont,
    private negrito: PDFFont,
  ) {
    this.novaPagina()
  }

  private novaPagina() {
    this.pagina = this.pdf.addPage([A4.largura, A4.altura])
    this.paginas.push(this.pagina)
    this.y = A4.altura - MARGEM
  }

  /** Garante espaço para `altura`; se não couber, continua na página seguinte. */
  private caber(altura: number) {
    if (this.y - altura < MARGEM + CANHOTO + 8) {
      this.linhaHorizontal(this.y)
      this.novaPagina()
      this.linhaHorizontal(this.y)
    }
  }

  quebrar(t: string, tamanho: number, largura: number, f: PDFFont = this.fonte): string[] {
    const linhas: string[] = []
    for (const paragrafo of seguro(t).split('\n')) {
      let atual = ''
      for (const palavra of paragrafo.split(/\s+/)) {
        const tentativa = atual ? `${atual} ${palavra}` : palavra
        if (f.widthOfTextAtSize(tentativa, tamanho) <= largura) atual = tentativa
        else {
          if (atual) linhas.push(atual)
          atual = palavra
        }
      }
      linhas.push(atual)
    }
    return linhas
  }

  escrever(t: string, x: number, y: number, tamanho: number, f: PDFFont = this.fonte) {
    this.pagina.drawText(seguro(t), { x, y, size: tamanho, font: f, color: PRETO })
  }

  centralizado(t: string, y: number, tamanho: number, f: PDFFont) {
    const w = f.widthOfTextAtSize(seguro(t), tamanho)
    this.escrever(t, MARGEM + (LARGURA - w) / 2, y, tamanho, f)
  }

  linhaHorizontal(y: number) {
    this.pagina.drawLine({
      start: { x: MARGEM, y },
      end: { x: A4.largura - MARGEM, y },
      thickness: 0.6,
      color: PRETO,
    })
  }

  private alturaCelula(c: Celula): number {
    const largura = COLUNA * (c.colunas ?? 1) - 6
    const rotulo = c.rotulo ? this.quebrar(c.rotulo, ROTULO, largura, this.negrito).length : 0
    const valor = c.valor != null ? this.quebrar(c.valor || '-', VALOR, largura).length : 0
    return rotulo * (ROTULO + 1.5) + valor * (VALOR + 1.5) + 4
  }

  /** Uma linha de células lado a lado, a partir da primeira coluna. */
  linha(celulas: Celula[]) {
    const altura = Math.max(...celulas.map((c) => this.alturaCelula(c)))
    this.caber(altura)
    let x = MARGEM
    for (const c of celulas) {
      const largura = COLUNA * (c.colunas ?? 1)
      if (c.fundo)
        this.pagina.drawRectangle({
          x,
          y: this.y - altura,
          width: largura,
          height: altura,
          color: FUNDO,
        })
      let y = this.y - ROTULO - 1
      if (c.rotulo)
        for (const l of this.quebrar(c.rotulo, ROTULO, largura - 6, this.negrito)) {
          this.escrever(l, x + 3, y, ROTULO, this.negrito)
          y -= ROTULO + 1.5
        }
      if (c.valor != null) {
        y -= c.rotulo ? 1.5 : 0
        for (const l of this.quebrar(c.valor || '-', VALOR, largura - 6)) {
          this.escrever(l, x + 3, y - (VALOR - ROTULO), VALOR)
          y -= VALOR + 1.5
        }
      }
      x += largura
    }
    this.y -= altura
  }

  /** Um bloco: linha em cima e o título (com fundo) na primeira coluna da primeira linha. */
  bloco(titulo: string, linhas: Celula[][]) {
    this.caber(24)
    this.linhaHorizontal(this.y)
    const [primeira = [], ...resto] = linhas
    this.linha([{ rotulo: titulo, fundo: true }, ...primeira])
    for (const l of resto) this.linha(l)
  }

  /** Linha de aviso centralizada entre linhas (destinatário, intermediário). */
  aviso(t: string) {
    this.caber(11)
    this.linhaHorizontal(this.y)
    this.centralizado(t, this.y - 8, VALOR, this.fonte)
    this.y -= 11
  }

  /** Texto corrido, na largura toda. */
  texto(t: string) {
    for (const l of this.quebrar(t, VALOR, LARGURA - 6)) {
      this.caber(VALOR + 2)
      this.escrever(l, MARGEM + 3, this.y - VALOR, VALOR)
      this.y -= VALOR + 2
    }
  }

  desenharQr(chave: string, x0: number, yTopo: number, lado: number) {
    const qr = QRCode.create(urlConsultaPublica(chave), { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const modulo = lado / n
    for (let linha = 0; linha < n; linha++)
      for (let coluna = 0; coluna < n; coluna++)
        if (qr.modules.get(linha, coluna))
          this.pagina.drawRectangle({
            x: x0 + coluna * modulo,
            y: yTopo - (linha + 1) * modulo,
            width: modulo,
            height: modulo,
            color: PRETO,
          })
  }

  /** Moldura de cada página e o canhoto no pé da última. */
  fechar(numero: string, chave: string) {
    this.linhaHorizontal(this.y)
    for (const p of this.paginas)
      p.drawRectangle({
        x: MARGEM - 4,
        y: MARGEM - 4,
        width: LARGURA + 8,
        height: A4.altura - 2 * MARGEM + 8,
        borderColor: PRETO,
        borderWidth: 0.8,
      })
    const base = MARGEM + 4
    const topo = base + CANHOTO - 8
    this.pagina.drawRectangle({
      x: MARGEM,
      y: base,
      width: LARGURA,
      height: topo - base,
      borderColor: PRETO,
      borderWidth: 0.8,
    })
    for (const x of [MARGEM + COLUNA, MARGEM + 2 * COLUNA])
      this.pagina.drawLine({
        start: { x, y: base },
        end: { x, y: topo },
        thickness: 0.8,
        color: PRETO,
      })
    this.escrever('DATA CIENTIFICAÇÃO:', MARGEM + 4, topo - 9, ROTULO, this.negrito)
    this.escrever('IDENTIFICAÇÃO E ASSINATURA', MARGEM + COLUNA + 4, topo - 9, ROTULO, this.negrito)
    this.escrever('N° NFS-e / CHAVE NFS-e', MARGEM + 2 * COLUNA + 4, topo - 9, ROTULO, this.negrito)
    this.escrever(`${numero} / ${chave}`, MARGEM + 2 * COLUNA + 4, topo - 18, VALOR)
  }
}

const endereco = (g: string) =>
  [tag(g, 'xLgr'), tag(g, 'nro'), tag(g, 'xCpl'), tag(g, 'xBairro')].filter(Boolean).join(', ') ||
  '-'

export async function gerarDanfse(xmlNfse: string): Promise<Uint8Array> {
  // O XML tem a parte da NFS-e (dados que a Sefin calculou) e, dentro, a DPS enviada.
  const posDps = xmlNfse.indexOf('<DPS')
  const nfse = posDps > 0 ? xmlNfse.slice(0, posDps) : xmlNfse
  const dps = posDps > 0 ? xmlNfse.slice(posDps) : ''
  const chave = (xmlNfse.match(/<infNFSe[^>]*Id="NFS(\d{50})"/) ?? [])[1] ?? ''
  const numero = tag(nfse, 'nNFSe') ?? '-'
  const emit = grupo(nfse, 'emit')
  const endEmit = grupo(emit, 'enderNac')
  const prest = grupo(dps, 'prest')
  const toma = grupo(dps, 'toma')
  const endToma = grupo(toma, 'end')
  const valoresNfse = grupo(nfse, 'valores')
  const vDps = grupo(dps, 'valores')
  const tribMun = grupo(vDps, 'tribMun')
  const tribFed = grupo(vDps, 'tribFed')
  const piscofins = grupo(tribFed, 'piscofins')
  const totTrib = grupo(vDps, 'vTotTrib')
  const ibsNfse = grupo(nfse, 'IBSCBS')
  const ibsDps = grupo(dps, 'IBSCBS')
  const homologacao = tag(dps, 'tpAmb') === '2'

  // Nomes dos municípios que o XML traz, para o do tomador (que só vem com o código).
  const nomes: Record<string, string> = {}
  const anotar = (codigo: string | null, nome: string | null) => {
    if (codigo && nome) nomes[codigo] = nome
  }
  anotar(tag(endEmit, 'cMun'), tag(nfse, 'xLocEmi'))
  anotar(tag(dps, 'cLocPrestacao'), tag(nfse, 'xLocPrestacao'))
  anotar(tag(nfse, 'cLocIncid'), tag(nfse, 'xLocIncid'))
  anotar(tag(ibsNfse, 'cLocalidadeIncid'), tag(ibsNfse, 'xLocalidadeIncid'))
  const municipio = (codigo: string | null) =>
    codigo ? `${nomes[codigo] ?? codigo} / ${uf(codigo)}` : '-'

  const pdf = await PDFDocument.create()
  pdf.setTitle(`NFS-e ${numero}`)
  pdf.setProducer('Eco Gestão')
  const fonte = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const d = new Danfse(pdf, fonte, negrito)

  // Cabeçalho: logo da empresa, título no centro e o município/ambiente à direita.
  const logo = await pdf.embedJpg(Uint8Array.from(atob(LOGO_JPG_BASE64), (c) => c.charCodeAt(0)))
  const alturaLogo = 36
  d.pagina.drawImage(logo, {
    x: MARGEM + 2,
    y: d.y - alturaLogo - 2,
    width: (alturaLogo * logo.width) / logo.height,
    height: alturaLogo,
  })
  d.centralizado('DANFSe v2.0', d.y - 15, 10, negrito)
  d.centralizado('Documento Auxiliar da NFS-e', d.y - 27, 10, negrito)
  const xDireita = MARGEM + 3 * COLUNA + 10
  const cLocEmi = ou(tag(dps, 'cLocEmi'), tag(endEmit, 'cMun'))
  d.escrever(`Município: ${tag(nfse, 'xLocEmi') ?? '-'} - ${uf(cLocEmi)}`, xDireita, d.y - 11, 9)
  d.escrever(`Ambiente Gerador: ${tag(nfse, 'ambGer') ?? '-'}`, xDireita, d.y - 20, 6.5)
  d.escrever(`Tipo de Ambiente: ${tag(dps, 'tpAmb') ?? '-'}`, xDireita, d.y - 28, 6.5)
  d.y -= alturaLogo + 6
  if (homologacao) {
    d.centralizado('AMBIENTE DE TESTES (PRODUÇÃO RESTRITA) - SEM VALOR FISCAL', d.y - 8, 9, negrito)
    d.y -= 12
  }

  // Identificação da nota, com o QR Code na quarta coluna.
  d.linhaHorizontal(d.y)
  const topoQr = d.y
  const ladoQr = 62
  if (chave) d.desenharQr(chave, MARGEM + 3 * COLUNA + (COLUNA - ladoQr) / 2, topoQr - 4, ladoQr)
  const avisoQr = d.quebrar(
    'A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e',
    6,
    COLUNA - 6,
  )
  avisoQr.forEach((l, i) =>
    d.escrever(l, MARGEM + 3 * COLUNA + 3, topoQr - ladoQr - 12 - i * 7.5, 6),
  )
  d.linha([{ rotulo: 'CHAVE DE ACESSO DA NFS-e', valor: chave || '-', colunas: 3 }])
  d.linha([
    { rotulo: 'NÚMERO DA NFS-e', valor: numero },
    { rotulo: 'COMPETÊNCIA DA NFS-e', valor: data(tag(dps, 'dCompet')) },
    { rotulo: 'DATA E HORA DA EMISSÃO DA NFS-e', valor: dataHora(tag(nfse, 'dhProc')) },
  ])
  d.linha([
    { rotulo: 'NÚMERO DA DPS', valor: tag(dps, 'nDPS') ?? '-' },
    { rotulo: 'SÉRIE DA DPS', valor: tag(dps, 'serie') ?? '-' },
    { rotulo: 'DATA E HORA DA EMISSÃO DA DPS', valor: dataHora(tag(dps, 'dhEmi')) },
  ])
  d.linha([
    { rotulo: 'EMITENTE DA NFS-e', valor: EMITENTE[tag(dps, 'tpEmit') ?? ''] ?? '-', fundo: true },
    { rotulo: 'SITUAÇÃO DA NFS-e', valor: tag(nfse, 'cStat') ?? '-' },
    {
      rotulo: 'FINALIDADE',
      valor: (tag(ibsDps, 'finNFSe') ?? '0') === '0' ? 'NFS-e regular' : 'NFS-e de ajuste',
    },
  ])
  d.y = Math.min(d.y, topoQr - ladoQr - 12 - avisoQr.length * 7.5)

  // Prestador.
  d.bloco('PRESTADOR / FORNECEDOR', [
    [
      { rotulo: 'CNPJ / CPF / NIF', valor: documento(ou(tag(emit, 'CNPJ'), tag(emit, 'CPF'))) },
      {
        rotulo: 'Indicador Municipal (Inscrição)',
        valor: ou(tag(emit, 'IM'), tag(prest, 'IM')) ?? '-',
      },
      { rotulo: 'Telefone', valor: ou(tag(emit, 'fone'), tag(prest, 'fone')) ?? '-' },
    ],
    [
      { rotulo: 'Nome / Nome Empresarial', valor: tag(emit, 'xNome') ?? '-', colunas: 2 },
      { rotulo: 'Município / Sigla UF', valor: municipio(tag(endEmit, 'cMun')) },
      {
        rotulo: 'Código IBGE / CEP',
        valor: `${ibge(tag(endEmit, 'cMun'))} / ${cep(tag(endEmit, 'CEP'))}`,
      },
    ],
    [
      { rotulo: 'Endereço', valor: endereco(endEmit), colunas: 2 },
      { rotulo: 'E-mail', valor: ou(tag(emit, 'email'), tag(prest, 'email')) ?? '-', colunas: 2 },
    ],
    [
      {
        rotulo: 'Simples Nacional na Data de Competência',
        valor: REGIME_SN[tag(prest, 'opSimpNac') ?? ''] ?? '-',
      },
      { rotulo: 'Regime de Apuração Tributária pelo SN', valor: tag(prest, 'regApTribSN') ?? '-' },
    ],
  ])

  // Tomador.
  const cMunToma = tag(endToma, 'cMun')
  d.bloco('TOMADOR / ADQUIRENTE', [
    [
      {
        rotulo: 'CNPJ / CPF / NIF',
        valor: documento(ou(tag(toma, 'CNPJ'), tag(toma, 'CPF'), tag(toma, 'NIF'))),
      },
      { rotulo: 'Indicador Municipal (Inscrição)', valor: tag(toma, 'IM') ?? '-' },
      { rotulo: 'Telefone', valor: tag(toma, 'fone') ?? '-' },
    ],
    [
      { rotulo: 'Nome / Nome Empresarial', valor: tag(toma, 'xNome') ?? '-', colunas: 2 },
      { rotulo: 'Município / Sigla UF', valor: municipio(cMunToma) },
      { rotulo: 'Código IBGE / CEP', valor: `${ibge(cMunToma)} / ${cep(tag(endToma, 'CEP'))}` },
    ],
    [
      { rotulo: 'Endereço', valor: endereco(endToma), colunas: 2 },
      { rotulo: 'E-mail', valor: tag(toma, 'email') ?? '-', colunas: 2 },
    ],
  ])
  if (!grupo(dps, 'dest')) d.aviso('DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e')
  if (!grupo(dps, 'interm')) d.aviso('INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e')

  // Serviço.
  const cTribNac = tag(dps, 'cTribNac')
  const nbs = tag(dps, 'cNBS')
  d.bloco('SERVIÇO PRESTADO', [
    [
      {
        rotulo: 'Código de Tributação Nacional/Municipal',
        valor: `${cTribNac ? cTribNac.replace(/^(\d{2})(\d{2})(\d{2})$/, '$1.$2.$3') : '-'} / ${tag(dps, 'cTribMun') ?? '-'}`,
      },
      {
        rotulo: 'Código da NBS',
        valor: nbs ? nbs.replace(/^(\d)(\d{4})(\d{2})(\d{2})$/, '$1.$2.$3.$4') : '-',
      },
      {
        rotulo: 'Local da Prestação / Sigla UF / País',
        valor: `${municipio(tag(dps, 'cLocPrestacao'))} / ${tag(dps, 'cPaisPrestacao') ?? '-'}`,
      },
    ],
    [{ valor: tag(nfse, 'xTribNac') ?? '-', colunas: 4 }],
    [{ rotulo: 'Descrição do Serviço', colunas: 4 }],
  ])
  // Linha a linha, para uma descrição longa continuar na página seguinte.
  d.texto(tag(dps, 'xDescServ') ?? '-')
  d.y -= 2

  // ISSQN.
  d.bloco('TRIBUTAÇÃO MUNICIPAL (ISSQN)', [
    [
      {
        rotulo: 'Tipo de Tributação do ISSQN',
        valor: TRIB_ISSQN[tag(tribMun, 'tribISSQN') ?? ''] ?? '-',
      },
      {
        rotulo: 'Município / Sigla UF / País de Incidência do ISSQN',
        valor: `${municipio(tag(nfse, 'cLocIncid'))} / ${tag(tribMun, 'cPaisResult') ?? '-'}`,
        colunas: 2,
      },
    ],
    [
      { rotulo: 'BC ISSQN', valor: reais(tag(valoresNfse, 'vBC')) },
      { rotulo: 'Alíquota Aplicada', valor: porcento(tag(valoresNfse, 'pAliqAplic')) },
      { rotulo: 'Retenção do ISSQN', valor: RET_ISSQN[tag(tribMun, 'tpRetISSQN') ?? ''] ?? '-' },
      { rotulo: 'ISSQN Apurado', valor: reais(tag(valoresNfse, 'vISSQN')) },
    ],
  ])

  // Federais.
  const tpRet = tag(piscofins, 'tpRetPisCofins')
  d.bloco('TRIBUTAÇÃO FEDERAL (EXCETO CBS)', [
    [
      { rotulo: 'IRRF', valor: reais(tag(tribFed, 'vRetIRRF')) },
      { rotulo: 'Contribuição Previdenciária - Retida', valor: reais(tag(tribFed, 'vRetCP')) },
      { rotulo: 'Contribuições Sociais - Retidas', valor: reais(tag(tribFed, 'vRetCSLL')) },
    ],
    [
      { rotulo: 'PIS - Débito Apuração Própria', valor: reais(tag(piscofins, 'vPis')) },
      { rotulo: 'COFINS - Débito Apuração Própria', valor: reais(tag(piscofins, 'vCofins')) },
      {
        rotulo: 'Descrição Contrib. Sociais - Retidas',
        valor: tpRet ? `${tpRet} - ${RET_PISCOFINS[tpRet] ?? ''}` : '-',
        colunas: 2,
      },
    ],
  ])

  // IBS/CBS (reforma tributária).
  let totalIbsCbs: number | null = null
  if (ibsNfse) {
    const v = grupo(ibsNfse, 'valores')
    const gIbs = grupo(ibsNfse, 'gIBS')
    const vIbsTot = tag(gIbs, 'vIBSTot')
    const vCbs = tag(grupo(ibsNfse, 'gCBS'), 'vCBS')
    totalIbsCbs = Number(vIbsTot ?? 0) + Number(vCbs ?? 0)
    const bc = tag(v, 'vBC')
    const vServ = tag(vDps, 'vServ')
    const cLocIbs = tag(ibsNfse, 'cLocalidadeIncid')
    const reducao = (t: string) => tag(v, t)?.replace('.', ',') ?? '-'
    d.bloco('TRIBUTAÇÃO IBS/CBS', [
      [
        {
          rotulo: 'CST / cClassTrib',
          valor: `${tag(ibsDps, 'CST') ?? '-'} / ${tag(ibsDps, 'cClassTrib') ?? '-'}`,
        },
        {
          rotulo:
            'Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF',
          valor: `${tag(ibsDps, 'cIndOp') ?? '-'} / ${cLocIbs ?? '-'} / ${municipio(cLocIbs)}`,
          colunas: 2,
        },
      ],
      [
        {
          rotulo: 'Exclusões e Reduções da Base de Cálculo',
          valor: bc && vServ ? reais((Number(vServ) - Number(bc)).toFixed(2)) : '-',
        },
        { rotulo: 'Base de Cálculo Após Exclusões e Reduções', valor: reais(bc) },
        {
          rotulo: 'Red. Alíquota IBS / Red. Alíquota CBS',
          valor: `${reducao('pRedAliqUF')} / ${reducao('pRedAliqMun')} / ${reducao('pRedAliqCBS')}`,
        },
        {
          rotulo: 'Alíquota - IBS UF / IBS Mun',
          valor: `${porcento(tag(v, 'pIBSUF'))} / ${porcento(tag(v, 'pIBSMun'))}`,
        },
      ],
      [
        { rotulo: 'Alíq. Efetiva Municipal - IBS', valor: porcento(tag(v, 'pAliqEfetMun')) },
        { rotulo: 'Valor Apurado Municipal - IBS', valor: reais(tag(gIbs, 'vIBSMun')) },
        { rotulo: 'Alíq. Efetiva Estadual - IBS', valor: porcento(tag(v, 'pAliqEfetUF')) },
        { rotulo: 'Valor Apurado Estadual - IBS', valor: reais(tag(gIbs, 'vIBSUF')) },
      ],
      [
        { rotulo: 'Valor Total Apurado - IBS', valor: reais(vIbsTot) },
        { rotulo: 'Alíquota - CBS', valor: porcento(tag(v, 'pCBS')) },
        { rotulo: 'Alíquota Efetiva - CBS', valor: porcento(tag(v, 'pAliqEfetCBS')) },
        { rotulo: 'Valor Total Apurado - CBS', valor: reais(vCbs) },
      ],
    ])
  }

  // Totais.
  const totais: Celula[] = [
    {
      rotulo: 'Total das Retenções (ISSQN / Federais)',
      valor: reais(tag(valoresNfse, 'vTotalRet')),
    },
    { rotulo: 'VALOR LÍQUIDO DA NFS-e', valor: reais(tag(valoresNfse, 'vLiq')) },
  ]
  if (totalIbsCbs != null)
    totais.push(
      { rotulo: 'Total do IBS/CBS', valor: reais(totalIbsCbs.toFixed(2)) },
      {
        rotulo: 'VALOR LÍQUIDO DA NFS-e + IBS/CBS',
        valor: reais(ou(tag(ibsNfse, 'vTotNF'), tag(valoresNfse, 'vLiq'))),
        fundo: true,
      },
    )
  d.bloco('VALOR TOTAL DA NFS-e', [
    [
      { rotulo: 'VALOR DA OPERAÇÃO / SERVIÇO', valor: reais(tag(vDps, 'vServ')) },
      { rotulo: 'Desconto Incondicionado', valor: reais(tag(vDps, 'vDescIncond')) },
      { rotulo: 'Desconto Condicionado', valor: reais(tag(vDps, 'vDescCond')) },
    ],
    totais,
  ])

  // Informações complementares.
  d.bloco('INFORMAÇÕES COMPLEMENTARES', [[]])
  const subst = tag(grupo(dps, 'subst'), 'chSubstda')
  if (subst) d.texto(`NFS-e Subst.: ${subst}`)
  const infComp = tag(grupo(dps, 'infoCompl'), 'xInfComp')
  if (infComp) d.texto(infComp)
  if (totTrib)
    d.texto(
      `Totais aproximados dos Tributos cfe. Lei n° 12.741/2012: Federais: ${reais(tag(totTrib, 'vTotTribFed'))}; Estaduais: ${reais(tag(totTrib, 'vTotTribEst'))}; Municipais: ${reais(tag(totTrib, 'vTotTribMun'))};`,
    )
  d.y -= 4

  d.fechar(numero, chave)
  return await pdf.save()
}
