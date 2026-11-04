// DANFSe: o PDF (Documento Auxiliar da NFS-e) montado a partir do XML autorizado pela
// Sefin Nacional. A API oficial de PDF está sendo desativada (NT 008/2026), então o PDF
// é gerado aqui, com os dados do próprio XML e o QR Code da consulta pública.

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1'
import QRCode from 'npm:qrcode@1.5.4'

import { grupo, tag } from './sefin.ts'

const VERDE = rgb(0.12, 0.3, 0.1)
const CINZA = rgb(0.33, 0.38, 0.31)
const LINHA = rgb(0.82, 0.86, 0.8)
const A4 = { largura: 595.28, altura: 841.89 }
const MARGEM = 32

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
  ' ': ' ',
}
function seguro(t: string): string {
  return t.replace(/[–—‘’“”• ]/g, (c) => TROCAS[c]).replace(/[^\n -~¡-ÿ]/g, '')
}

const reais = (v: string | null) =>
  v == null || v === ''
    ? '-'
    : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const data = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '-')
const dataHora = (iso: string | null) => (iso ? `${data(iso)} ${iso.slice(11, 19)}` : '-')
function documento(v: string | null): string {
  const d = (v ?? '').replace(/\D/g, '')
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return v || '-'
}
const cep = (v: string | null) => (v ? v.replace(/^(\d{5})(\d{3})$/, '$1-$2') : '')

const TRIB_ISSQN: Record<string, string> = {
  '1': 'Operação tributável',
  '2': 'Imunidade',
  '3': 'Exportação de serviço',
  '4': 'Não incidência',
}
const RET_ISSQN: Record<string, string> = {
  '1': 'Não retido',
  '2': 'Retido pelo tomador',
  '3': 'Retido pelo intermediário',
}
const REGIME_SN: Record<string, string> = {
  '1': 'Não optante',
  '2': 'MEI',
  '3': 'ME/EPP',
}

class Pagina {
  y = A4.altura - MARGEM
  constructor(
    private pagina: PDFPage,
    private fonte: PDFFont,
    private negrito: PDFFont,
  ) {}

  private quebrar(t: string, tamanho: number, largura: number, f: PDFFont): string[] {
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

  titulo(t: string) {
    this.y -= 6
    this.pagina.drawRectangle({
      x: MARGEM,
      y: this.y - 14,
      width: A4.largura - 2 * MARGEM,
      height: 16,
      color: rgb(0.96, 0.97, 0.94),
      borderColor: LINHA,
      borderWidth: 0.5,
    })
    this.pagina.drawText(seguro(t.toUpperCase()), {
      x: MARGEM + 6,
      y: this.y - 10,
      size: 8,
      font: this.negrito,
      color: VERDE,
    })
    this.y -= 20
  }

  /** Campos lado a lado: [rótulo, valor, fração da largura]. */
  campos(lista: [string, string, number][]) {
    const larguraTotal = A4.largura - 2 * MARGEM
    let x = MARGEM
    let menorY = this.y
    for (const [rotulo, valor, fracao] of lista) {
      const largura = larguraTotal * fracao
      this.pagina.drawText(seguro(rotulo), {
        x: x + 4,
        y: this.y - 7,
        size: 6,
        font: this.fonte,
        color: CINZA,
      })
      let y = this.y - 16
      for (const l of this.quebrar(valor || '-', 8, largura - 8, this.negrito)) {
        this.pagina.drawText(l, { x: x + 4, y, size: 8, font: this.negrito })
        y -= 10
      }
      menorY = Math.min(menorY, y)
      x += largura
    }
    this.y = menorY - 2
  }

  texto(t: string, tamanho = 8) {
    for (const l of this.quebrar(t, tamanho, A4.largura - 2 * MARGEM - 8, this.fonte)) {
      this.pagina.drawText(l, {
        x: MARGEM + 4,
        y: this.y - tamanho,
        size: tamanho,
        font: this.fonte,
      })
      this.y -= tamanho + 2.5
    }
    this.y -= 4
  }
}

export async function gerarDanfse(xmlNfse: string): Promise<Uint8Array> {
  // O XML tem a parte da NFS-e (dados que a Sefin calculou) e, dentro, a DPS enviada.
  const posDps = xmlNfse.indexOf('<DPS')
  const nfse = posDps > 0 ? xmlNfse.slice(0, posDps) : xmlNfse
  const dps = posDps > 0 ? xmlNfse.slice(posDps) : ''
  const chave = (xmlNfse.match(/<infNFSe[^>]*Id="NFS(\d{50})"/) ?? [])[1] ?? ''
  const emit = grupo(nfse, 'emit')
  const endEmit = grupo(emit, 'enderNac')
  const toma = grupo(dps, 'toma')
  const endToma = grupo(toma, 'end')
  const valoresNfse = grupo(nfse, 'valores')
  const vDps = grupo(dps, 'valores')
  const tribMun = grupo(vDps, 'tribMun')
  const tribFed = grupo(vDps, 'tribFed')
  const homologacao = tag(dps, 'tpAmb') === '2'

  const pdf = await PDFDocument.create()
  pdf.setTitle(`NFS-e ${tag(nfse, 'nNFSe') ?? ''}`)
  pdf.setProducer('Eco Gestão')
  const pagina = pdf.addPage([A4.largura, A4.altura])
  const fonte = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const p = new Pagina(pagina, fonte, negrito)

  // Cabeçalho, com o QR Code da consulta pública à direita.
  pagina.drawText('DANFSe', { x: MARGEM, y: p.y - 16, size: 18, font: negrito, color: VERDE })
  pagina.drawText('Documento Auxiliar da Nota Fiscal de Serviço eletrônica', {
    x: MARGEM,
    y: p.y - 30,
    size: 9,
    font: fonte,
    color: CINZA,
  })
  pagina.drawText(seguro(`${tag(nfse, 'xLocEmi') ?? ''} · Sistema Nacional NFS-e`), {
    x: MARGEM,
    y: p.y - 42,
    size: 8,
    font: fonte,
    color: CINZA,
  })
  if (chave) {
    const qr = QRCode.create(urlConsultaPublica(chave), { errorCorrectionLevel: 'M' })
    const n = qr.modules.size
    const lado = 72
    const modulo = lado / n
    const x0 = A4.largura - MARGEM - lado
    const y0 = p.y - lado
    for (let linha = 0; linha < n; linha++)
      for (let coluna = 0; coluna < n; coluna++)
        if (qr.modules.get(linha, coluna))
          pagina.drawRectangle({
            x: x0 + coluna * modulo,
            y: y0 + (n - 1 - linha) * modulo,
            width: modulo,
            height: modulo,
            color: rgb(0, 0, 0),
          })
  }
  p.y -= 80

  if (homologacao) {
    pagina.drawText('AMBIENTE DE TESTES (PRODUÇÃO RESTRITA) - SEM VALOR FISCAL', {
      x: MARGEM,
      y: p.y,
      size: 10,
      font: negrito,
      color: rgb(0.75, 0.1, 0.1),
    })
    p.y -= 14
  }

  p.titulo('Dados da NFS-e')
  p.campos([
    ['Número da NFS-e', tag(nfse, 'nNFSe') ?? '-', 0.2],
    ['Competência', data(tag(dps, 'dCompet')), 0.2],
    ['Emissão da NFS-e', dataHora(tag(nfse, 'dhProc')), 0.3],
    ['DPS (série / número)', `${tag(dps, 'serie') ?? '-'} / ${tag(dps, 'nDPS') ?? '-'}`, 0.3],
  ])
  p.campos([['Chave de acesso', chave.replace(/(\d{5})(?=\d)/g, '$1 '), 1]])

  p.titulo('Prestador do serviço')
  p.campos([
    ['CNPJ / CPF', documento(tag(emit, 'CNPJ') ?? tag(emit, 'CPF')), 0.25],
    ['Inscrição municipal', tag(emit, 'IM') ?? '-', 0.2],
    ['Telefone', tag(emit, 'fone') ?? '-', 0.2],
    ['E-mail', tag(emit, 'email') ?? '-', 0.35],
  ])
  p.campos([
    ['Nome / razão social', tag(emit, 'xNome') ?? '-', 0.6],
    ['Simples Nacional', REGIME_SN[tag(dps, 'opSimpNac') ?? ''] ?? '-', 0.4],
  ])
  p.campos([
    [
      'Endereço',
      [tag(endEmit, 'xLgr'), tag(endEmit, 'nro'), tag(endEmit, 'xCpl'), tag(endEmit, 'xBairro')]
        .filter(Boolean)
        .join(', '),
      0.6,
    ],
    ['Município / CEP', `${tag(nfse, 'xLocEmi') ?? ''} ${cep(tag(endEmit, 'CEP'))}`.trim(), 0.4],
  ])

  p.titulo('Tomador do serviço')
  p.campos([
    ['CNPJ / CPF', documento(tag(toma, 'CNPJ') ?? tag(toma, 'CPF')), 0.25],
    ['Inscrição municipal', tag(toma, 'IM') ?? '-', 0.2],
    ['E-mail', tag(toma, 'email') ?? '-', 0.55],
  ])
  p.campos([['Nome / razão social', tag(toma, 'xNome') ?? '-', 1]])
  p.campos([
    [
      'Endereço',
      [tag(endToma, 'xLgr'), tag(endToma, 'nro'), tag(endToma, 'xCpl'), tag(endToma, 'xBairro')]
        .filter(Boolean)
        .join(', '),
      0.75,
    ],
    ['CEP', cep(tag(endToma, 'CEP')), 0.25],
  ])

  p.titulo('Serviço prestado')
  p.campos([
    [
      'Código de tributação nacional',
      `${tag(dps, 'cTribNac') ?? ''} - ${tag(nfse, 'xTribNac') ?? ''}`,
      0.7,
    ],
    ['Código NBS', tag(dps, 'cNBS') ?? '-', 0.3],
  ])
  p.campos([
    ['Local da prestação', tag(nfse, 'xLocPrestacao') ?? '-', 0.5],
    ['Município de incidência do ISSQN', tag(nfse, 'xLocIncid') ?? '-', 0.5],
  ])
  pagina.drawText('Descrição do serviço', {
    x: MARGEM + 4,
    y: p.y - 7,
    size: 6,
    font: fonte,
    color: CINZA,
  })
  p.y -= 10
  p.texto(tag(dps, 'xDescServ') ?? '-')

  p.titulo('Tributação municipal (ISSQN)')
  p.campos([
    ['Tributação', TRIB_ISSQN[tag(tribMun, 'tribISSQN') ?? ''] ?? '-', 0.25],
    ['Retenção do ISSQN', RET_ISSQN[tag(tribMun, 'tpRetISSQN') ?? ''] ?? '-', 0.25],
    ['Base de cálculo', reais(tag(valoresNfse, 'vBC')), 0.17],
    [
      'Alíquota',
      tag(valoresNfse, 'pAliqAplic')
        ? `${tag(valoresNfse, 'pAliqAplic')!.replace('.', ',')}%`
        : '-',
      0.13,
    ],
    ['ISSQN', reais(tag(valoresNfse, 'vISSQN')), 0.2],
  ])

  p.titulo('Tributação federal')
  p.campos([
    ['PIS', reais(tag(tribFed, 'vPis')), 0.2],
    ['COFINS', reais(tag(tribFed, 'vCofins')), 0.2],
    ['IRRF retido', reais(tag(tribFed, 'vRetIRRF')), 0.2],
    ['CSLL retida', reais(tag(tribFed, 'vRetCSLL')), 0.2],
    ['INSS (CP) retido', reais(tag(tribFed, 'vRetCP')), 0.2],
  ])

  p.titulo('Valor total da NFS-e')
  p.campos([
    ['Valor do serviço', reais(tag(vDps, 'vServ')), 0.25],
    ['Descontos', reais(tag(vDps, 'vDescIncond') ?? tag(vDps, 'vDescCond')), 0.2],
    ['Total de retenções', reais(tag(valoresNfse, 'vTotalRet')), 0.25],
    ['Valor líquido', reais(tag(valoresNfse, 'vLiq')), 0.3],
  ])

  p.titulo('Informações complementares')
  p.texto(
    `Consulte a autenticidade desta nota no Portal Nacional da NFS-e (www.nfse.gov.br/consultapublica) com a chave de acesso acima, ou pelo QR Code.`,
    7,
  )

  return await pdf.save()
}
