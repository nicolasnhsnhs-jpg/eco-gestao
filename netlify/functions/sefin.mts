// Ponte para a Sefin Nacional (NFS-e). A Sefin pede o certificado do cliente no meio da
// conexão (renegociação TLS), o que o motor das Edge Functions do Supabase não suporta;
// o Node.js suporta. A função "nfse" do Supabase manda aqui o pedido junto com o
// certificado e a chave (lidos dos segredos de lá); esta ponte não guarda nada e só
// fala com a Sefin e com a parametrização municipal do ADN (a alíquota do ISS de cada
// cidade), nos dois ambientes.

import https from 'node:https'

const HOSTS = {
  producao: 'sefin.nfse.gov.br',
  homologacao: 'sefin.producaorestrita.nfse.gov.br',
} as const

// A parametrização dos municípios não fica na Sefin: é uma API do ADN.
const HOSTS_ADN = {
  producao: 'adn.nfse.gov.br',
  homologacao: 'adn.producaorestrita.nfse.gov.br',
} as const

// Só os caminhos que a função usa: emitir, consultar DPS, consultar nota e cancelar.
const CAMINHO = /^(nfse|dps\/DPS\d{42}|nfse\/\d{50}|nfse\/\d{50}\/eventos)$/
// A alíquota do serviço na cidade ({município}/{01.07.01.000}/{AAAA-MM-DD}/aliquota) e
// as notas em que a empresa aparece, em sequência (contribuintes/DFe/{NSU}).
const CAMINHO_ADN =
  /^(parametrizacao\/\d{7}\/\d{2}\.\d{2}\.\d{2}\.\d{3}\/\d{4}-\d{2}-\d{2}\/aliquota|contribuintes\/DFe\/\d{1,20}\?lote=true&cnpjConsulta=\d{14})$/

type Pedido = {
  ambiente: keyof typeof HOSTS
  metodo: 'GET' | 'POST'
  caminho: string
  corpo?: unknown
  cert: string
  chave: string
}

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

export default async (req: Request) => {
  if (req.method !== 'POST') return json(405, { erro: 'Método não permitido.' })
  let p: Pedido
  try {
    p = await req.json()
  } catch {
    return json(400, { erro: 'Pedido inválido.' })
  }
  const adn = CAMINHO_ADN.test(p.caminho ?? '')
  const host = (adn ? HOSTS_ADN : HOSTS)[p.ambiente]
  if (
    !host ||
    !['GET', 'POST'].includes(p.metodo) ||
    (!adn && !CAMINHO.test(p.caminho ?? '')) ||
    (adn && p.metodo !== 'GET') ||
    !p.cert?.includes('BEGIN CERTIFICATE') ||
    !p.chave?.includes('PRIVATE KEY')
  ) {
    return json(400, { erro: 'Pedido inválido.' })
  }

  const corpo = p.corpo === undefined ? undefined : JSON.stringify(p.corpo)
  const pedir = () =>
    new Promise<{ status: number; corpo: string }>((resolver, falhar) => {
      const pedido = https.request(
        {
          host,
          path: adn ? `/${p.caminho}` : `/SefinNacional/${p.caminho}`,
          method: p.metodo,
          cert: p.cert,
          key: p.chave,
          timeout: 25_000,
          headers: {
            Accept: 'application/json',
            ...(corpo ? { 'Content-Type': 'application/json' } : {}),
          },
        },
        (resposta) => {
          const partes: Buffer[] = []
          resposta.on('data', (d: Buffer) => partes.push(d))
          resposta.on('end', () =>
            resolver({
              status: resposta.statusCode ?? 0,
              corpo: Buffer.concat(partes).toString('utf8'),
            }),
          )
        },
      )
      pedido.on('timeout', () =>
        pedido.destroy(new Error('o Sistema Nacional não respondeu a tempo')),
      )
      pedido.on('error', falhar)
      pedido.end(corpo)
    })
  try {
    let r
    try {
      r = await pedir()
    } catch (e) {
      // Consulta (GET) que caiu no meio: tenta mais uma vez. A emissão (POST) não repete,
      // para não mandar a mesma nota duas vezes.
      if (p.metodo !== 'GET' || (e as NodeJS.ErrnoException).code !== 'ECONNRESET') throw e
      await new Promise((ok) => setTimeout(ok, 1_000))
      r = await pedir()
    }
    return json(200, r)
  } catch (e) {
    const onde = adn ? 'o Sistema Nacional (ADN)' : 'a Sefin'
    return json(502, { erro: `Falha na conexão com ${onde}: ${(e as Error).message}` })
  }
}
