// Assinatura digital de PDF com um certificado A1 (o mesmo tipo de assinatura que o
// Adobe faz: adbe.pkcs7.detached, SHA-256). O Adobe Reader mostra quem assinou e
// quando, e acusa qualquer mudança feita no arquivo depois da assinatura.
//
// Como funciona:
//   1. entra no PDF um campo de assinatura (invisível) com um espaço reservado
//      (/Contents <000…>) e um /ByteRange provisório;
//   2. o PDF é salvo; o /ByteRange passa a dizer "tudo menos o espaço reservado";
//   3. esses bytes são assinados (CMS/PKCS#7 destacado) e a assinatura entra no espaço.

// @ts-types="npm:@types/node-forge@1.3.11"
import forge from 'npm:node-forge@1.3.1'
import {
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFString,
  rgb,
  StandardFonts,
  type PDFFont,
} from 'npm:pdf-lib@1.17.1'

import type { Certificado } from './certificadoA1.ts'

/** Bytes reservados para a assinatura (certificado + cadeia cabem com folga). */
const ESPACO = 16384
/** Marca do /ByteRange provisório (trocada pelos números depois de salvar). */
const MARCA = '**********'
/**
 * Onde o PDF diz o lugar do carimbo visível: [x, y, largura, altura] no catálogo.
 * Igual a src/features/certificados/pdf/gerarPdfCertificado.ts.
 */
const CHAVE_CARIMBO = 'EcoCarimboAssinatura'

type Caixa = { x: number; y: number; largura: number; altura: number }

export type InfoAssinatura = {
  /** Ex.: "Certificado CERT-2026-0001". */
  motivo: string
  /** Ex.: "Esteio/RS". */
  local?: string
  quando?: Date
}

const ascii = (t: string) => Uint8Array.from(t, (c) => c.charCodeAt(0))

/** Posição de `procurado` (texto ASCII) em `bytes`, a partir de `desde`; -1 se não achar. */
function achar(bytes: Uint8Array, procurado: string, desde = 0): number {
  const p = ascii(procurado)
  let i = bytes.indexOf(p[0], desde)
  while (i !== -1 && i + p.length <= bytes.length) {
    let ok = true
    for (let j = 1; j < p.length; j++) {
      if (bytes[i + j] !== p[j]) {
        ok = false
        break
      }
    }
    if (ok) return i
    i = bytes.indexOf(p[0], i + 1)
  }
  return -1
}

/** Bytes → "string binária" (um caractere por byte), que é o que o node-forge usa. */
function binario(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return s
}

/** Data e hora de Brasília como o Adobe mostra: "06/11/2026 16:28:41 -03:00". */
export function dataHoraBrasilia(d: Date): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
  const fuso = String(partes.timeZoneName ?? '').replace('GMT', '') || '-03:00'
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute}:${partes.second} ${fuso}`
}

/** Quebra o texto em linhas que cabem na largura. */
function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = []
  let atual = ''
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra
    if (!atual || fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) atual = tentativa
    else {
      linhas.push(atual)
      atual = palavra
    }
  }
  if (atual) linhas.push(atual)
  return linhas
}

/** Só o que a fonte padrão do PDF (WinAnsi) consegue escrever. */
const winAnsi = (t: string) => t.normalize('NFC').replace(/[^\x20-\x7E\xA0-\xFF]/g, '')

/** Lugar do carimbo que o PDF reservou (e tira a marca, que não faz parte do documento). */
function caixaDoCarimbo(pdf: PDFDocument): Caixa | null {
  const chave = PDFName.of(CHAVE_CARIMBO)
  const arr = pdf.catalog.lookupMaybe(chave, PDFArray)
  pdf.catalog.delete(chave)
  if (!arr || arr.size() !== 4) return null
  const [x, y, largura, altura] = arr
    .asArray()
    .map((n) => (n instanceof PDFNumber ? n.asNumber() : NaN))
  if (![x, y, largura, altura].every(Number.isFinite) || largura < 60 || altura < 20) return null
  return { x, y, largura, altura }
}

/**
 * Carimbo visível, como o do Adobe: quem assinou (nome do certificado com CNPJ/CPF),
 * data e hora, e onde conferir. Fica dentro da área assinada: qualquer mudança aparece.
 */
async function desenharCarimbo(pdf: PDFDocument, caixa: Caixa, cert: Certificado, quando: Date) {
  const pagina = pdf.getPage(0)
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const verde = rgb(0.243, 0.482, 0.122)
  const escuro = rgb(0.059, 0.165, 0.051)
  const suave = rgb(0.345, 0.396, 0.325)
  const largura = caixa.largura - 16

  // Diminui a letra até tudo caber na caixa.
  let k = 1
  let linhas: { texto: string; fonte: PDFFont; tamanho: number; cor: typeof verde }[] = []
  for (; k >= 0.6; k -= 0.05) {
    const titular = quebrar(winAnsi(cert.titular), negrito, 6.6 * k, largura)
    linhas = [
      {
        texto: 'Documento assinado digitalmente (ICP-Brasil) por',
        fonte: normal,
        tamanho: 5.6 * k,
        cor: suave,
      },
      ...titular.map((t) => ({ texto: t, fonte: negrito, tamanho: 6.6 * k, cor: escuro })),
      { texto: `Data: ${dataHoraBrasilia(quando)}`, fonte: normal, tamanho: 6 * k, cor: escuro },
      { texto: 'Confira em validar.iti.gov.br', fonte: normal, tamanho: 5.4 * k, cor: verde },
    ]
    const altura = linhas.reduce((s, l) => s + l.tamanho * 1.3, 0) + 8
    if (altura <= caixa.altura) break
  }

  pagina.drawRectangle({
    x: caixa.x,
    y: caixa.y,
    width: caixa.largura,
    height: caixa.altura,
    color: rgb(0.957, 0.969, 0.937),
    borderColor: verde,
    borderWidth: 0.7,
  })
  pagina.drawRectangle({ x: caixa.x, y: caixa.y, width: 2.5, height: caixa.altura, color: verde })
  const total = linhas.reduce((s, l) => s + l.tamanho * 1.3, 0)
  let y = caixa.y + caixa.altura / 2 + total / 2
  for (const l of linhas) {
    y -= l.tamanho * 1.3
    pagina.drawText(l.texto, {
      x: caixa.x + 9,
      y: y + l.tamanho * 0.25,
      size: l.tamanho,
      font: l.fonte,
      color: l.cor,
    })
  }
}

/** Assina o PDF com o certificado. Devolve os bytes do PDF assinado. */
export async function assinarPdf(
  pdf: PDFDocument,
  cert: Certificado,
  info: InfoAssinatura,
): Promise<Uint8Array> {
  const quando = info.quando ?? new Date()
  const ctx = pdf.context

  // Carimbo visível, se o PDF reservou o lugar.
  const caixa = caixaDoCarimbo(pdf)
  if (caixa) await desenharCarimbo(pdf, caixa, cert, quando)

  // 1. Dicionário da assinatura, com os espaços provisórios.
  const byteRange = PDFArray.withContext(ctx)
  byteRange.push(PDFNumber.of(0))
  for (let i = 0; i < 3; i++) byteRange.push(PDFName.of(MARCA))
  const assinatura = ctx.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: byteRange,
    Contents: PDFHexString.of('0'.repeat(ESPACO * 2)),
    Name: PDFHexString.fromText(cert.titular),
    Reason: PDFHexString.fromText(info.motivo),
    M: PDFString.fromDate(quando),
  })
  if (info.local) assinatura.set(PDFName.of('Location'), PDFHexString.fromText(info.local))
  const refAssinatura = ctx.register(assinatura)

  // Campo de assinatura na 1ª página, sobre o carimbo (no Adobe, clicar nele abre os
  // detalhes da assinatura); sem carimbo, invisível. O Adobe lista no painel "Assinaturas".
  const pagina = pdf.getPage(0)
  const rect = caixa
    ? [caixa.x, caixa.y, caixa.x + caixa.largura, caixa.y + caixa.altura]
    : [0, 0, 0, 0]
  const campo = ctx.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: rect,
    V: refAssinatura,
    T: PDFHexString.fromText('Assinatura digital'),
    F: 132, // imprimir + travado
    P: pagina.ref,
  })
  const refCampo = ctx.register(campo)
  const anotacoes = pagina.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
  if (anotacoes) anotacoes.push(refCampo)
  else pagina.node.set(PDFName.of('Annots'), ctx.obj([refCampo]))
  const formulario = pdf.catalog.getOrCreateAcroForm()
  formulario.addField(refCampo)
  // 1 = tem assinaturas; 2 = só acrescentar (não reescrever o arquivo).
  formulario.dict.set(PDFName.of('SigFlags'), PDFNumber.of(3))

  // 2. Salva sem compactar os objetos, para achar os espaços provisórios no arquivo.
  const bytes = await pdf.save({ useObjectStreams: false, updateFieldAppearances: false })

  const inicio = achar(bytes, `<${'0'.repeat(ESPACO * 2)}>`)
  if (inicio === -1) throw new Error('Não achei o espaço da assinatura no PDF.')
  const fim = inicio + ESPACO * 2 + 2
  const chave = achar(bytes, '/ByteRange')
  const abre = chave === -1 ? -1 : achar(bytes, '[', chave)
  const fecha = abre === -1 ? -1 : achar(bytes, ']', abre)
  if (fecha === -1 || !binario(bytes.subarray(abre, fecha)).includes(MARCA))
    throw new Error('Não achei o /ByteRange no PDF.')

  const faixa = `[0 ${inicio} ${fim} ${bytes.length - fim}`
  const tamanho = fecha - abre // sem o "]"
  if (faixa.length > tamanho) throw new Error('O /ByteRange não coube no espaço reservado.')
  bytes.set(ascii(faixa.padEnd(tamanho, ' ')), abre)

  // 3. Assina tudo menos o espaço reservado.
  const conteudo = new Uint8Array(inicio + (bytes.length - fim))
  conteudo.set(bytes.subarray(0, inicio), 0)
  conteudo.set(bytes.subarray(fim), inicio)

  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(binario(conteudo))
  p7.addCertificate(cert.cert)
  for (const c of cert.cadeia) p7.addCertificate(c)
  p7.addSigner({
    key: cert.chave,
    certificate: cert.cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      // O node-forge aceita Date aqui, embora os tipos digam string.
      { type: forge.pki.oids.signingTime, value: quando as unknown as string },
    ],
  })
  p7.sign({ detached: true })
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes()
  const hex = forge.util.bytesToHex(der)
  if (hex.length > ESPACO * 2) throw new Error('A assinatura ficou maior que o espaço reservado.')
  bytes.set(ascii(hex), inicio + 1)
  return bytes
}
