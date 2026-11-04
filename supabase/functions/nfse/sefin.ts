// Conversa com a Sefin Nacional (API do Sistema Nacional NFS-e), autenticada pelo
// certificado A1 da empresa (mTLS). O XML vai e volta compactado (gzip) em base64.
//   POST /nfse                → emite (síncrono): {chaveAcesso, nfseXmlGZipB64} ou {erros}
//   GET  /dps/{id}            → chave da nota gerada por aquela DPS (se já foi gerada)
//   GET  /nfse/{chave}        → o XML da nota

import { decodeBase64, encodeBase64 } from 'jsr:@std/encoding@1/base64'

import type { Certificado } from './certificado.ts'

const ENDERECOS = {
  producao: 'https://sefin.nfse.gov.br/SefinNacional',
  homologacao: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
}

export type Ambiente = keyof typeof ENDERECOS

export type ErroSefin = { codigo: string | null; descricao: string }

export type RespostaEmissao =
  | { ok: true; chaveAcesso: string; xml: string; alertas: string[] }
  | { ok: false; erros: ErroSefin[]; status: number }

async function comprimir(texto: string): Promise<string> {
  const fluxo = new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'))
  return encodeBase64(new Uint8Array(await new Response(fluxo).arrayBuffer()))
}

async function descomprimir(b64: string): Promise<string> {
  const fluxo = new Blob([decodeBase64(b64)]).stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(fluxo).text()
}

const FALHAS: Record<number, string> = {
  401: 'acesso recusado: confira se o certificado é desta empresa e está na validade',
  403: 'acesso recusado: confira se o certificado é desta empresa e está na validade',
  429: 'muitos pedidos seguidos: aguarde um pouco e tente de novo',
  500: 'erro interno da Sefin Nacional',
  502: 'Sefin Nacional fora do ar',
  503: 'Sefin Nacional fora do ar',
  504: 'Sefin Nacional não respondeu a tempo',
}

function lerErros(dados: Record<string, unknown>): ErroSefin[] {
  let brutos = (dados.erros ?? dados.erro ?? dados.Erros ?? []) as unknown
  if (brutos && !Array.isArray(brutos)) brutos = [brutos]
  return (brutos as Record<string, string>[]).map((e) => ({
    codigo: e.codigo ?? e.Codigo ?? null,
    descricao: [
      e.descricao ?? e.Descricao ?? e.mensagem ?? e.Mensagem,
      e.complemento ?? e.Complemento,
    ]
      .filter(Boolean)
      .join(' — '),
  }))
}

export function textoDosErros(erros: ErroSefin[]): string {
  return erros.map((e) => (e.codigo ? `[${e.codigo}] ${e.descricao}` : e.descricao)).join(' | ')
}

export class Sefin {
  private base: string
  private cliente: Deno.HttpClient

  constructor(
    readonly ambiente: Ambiente,
    cert: Certificado,
  ) {
    this.base = ENDERECOS[ambiente]
    this.cliente = Deno.createHttpClient({ cert: cert.certPem, key: cert.chavePem })
  }

  private pedir(metodo: string, caminho: string, corpo?: unknown) {
    return fetch(`${this.base}/${caminho}`, {
      method: metodo,
      client: this.cliente,
      headers: {
        Accept: 'application/json',
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: AbortSignal.timeout(60_000),
    })
  }

  async emitir(xmlAssinado: string): Promise<RespostaEmissao> {
    const r = await this.pedir('POST', 'nfse', { dpsXmlGZipB64: await comprimir(xmlAssinado) })
    const bruto = await r.text()
    let dados: Record<string, unknown> = {}
    try {
      dados = JSON.parse(bruto)
    } catch {
      return {
        ok: false,
        status: r.status,
        erros: [
          {
            codigo: null,
            descricao: `Resposta inesperada (HTTP ${r.status})${FALHAS[r.status] ? `: ${FALHAS[r.status]}` : ''}.`,
          },
        ],
      }
    }
    const erros = lerErros(dados)
    if (erros.length || !dados.nfseXmlGZipB64) {
      return {
        ok: false,
        status: r.status,
        erros: erros.length
          ? erros
          : [
              {
                codigo: null,
                descricao: `Sem a nota na resposta (HTTP ${r.status})${FALHAS[r.status] ? `: ${FALHAS[r.status]}` : ''}.`,
              },
            ],
      }
    }
    const xml = await descomprimir(String(dados.nfseXmlGZipB64))
    const alertas = lerErros({ erros: dados.alertas ?? [] }).map((a) => a.descricao)
    return {
      ok: true,
      chaveAcesso: String(dados.chaveAcesso ?? tag(xml, 'chNFSe') ?? ''),
      xml,
      alertas,
    }
  }

  /** A chave da nota que esta DPS já gerou (num envio anterior que não teve resposta), ou null. */
  async chaveDaDps(idDps: string): Promise<string | null> {
    const r = await this.pedir('GET', `dps/${idDps}`)
    if (r.status === 404) {
      await r.body?.cancel()
      return null
    }
    if (!r.ok) {
      await r.body?.cancel()
      throw new Error(
        `Consulta da DPS falhou (HTTP ${r.status})${FALHAS[r.status] ? `: ${FALHAS[r.status]}` : ''}.`,
      )
    }
    const dados = (await r.json()) as { chaveAcesso?: string }
    return dados.chaveAcesso ?? null
  }

  async xmlDaNota(chave: string): Promise<string | null> {
    const r = await this.pedir('GET', `nfse/${chave}`)
    if (r.status === 404) {
      await r.body?.cancel()
      return null
    }
    if (!r.ok) {
      await r.body?.cancel()
      throw new Error(
        `Consulta da nota falhou (HTTP ${r.status})${FALHAS[r.status] ? `: ${FALHAS[r.status]}` : ''}.`,
      )
    }
    const dados = (await r.json()) as { nfseXmlGZipB64?: string }
    return dados.nfseXmlGZipB64 ? await descomprimir(dados.nfseXmlGZipB64) : null
  }
}

/** Conteúdo da primeira tag com este nome (o XML da Sefin não tem prefixos). */
export function tag(xml: string, nome: string): string | null {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([^<]*)</${nome}>`))
  return m ? desescapar(m[1].trim()) : null
}

const ENTIDADES: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }

function desescapar(t: string): string {
  return t.replace(/&(#x[\da-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(
          e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)),
        )
      : ENTIDADES[e.toLowerCase()],
  )
}

/** O trecho de um grupo (ex.: "toma", "prest") para ler as tags dele. */
export function grupo(xml: string, nome: string): string {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`))
  return m ? m[1] : ''
}
