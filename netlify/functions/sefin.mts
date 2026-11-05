// Ponte para a Sefin Nacional (NFS-e). A Sefin pede o certificado do cliente no meio da
// conexão (renegociação TLS), o que o motor das Edge Functions do Supabase não suporta;
// o Node.js suporta. A função "nfse" do Supabase manda aqui o pedido junto com o
// certificado e a chave (lidos dos segredos de lá); esta ponte não guarda nada e só
// fala com os dois endereços da Sefin.

import https from 'node:https'

const HOSTS = {
  producao: 'sefin.nfse.gov.br',
  homologacao: 'sefin.producaorestrita.nfse.gov.br',
} as const

// Só os caminhos que a função usa: emitir, consultar DPS e consultar nota.
const CAMINHO =
  /^(nfse|dps\/DPS\d{42}|nfse\/\d{50}|nfse\/\d{50}\/eventos|parametros_municipais\/\d{7}\/(\d{6,9}|convenio))$/

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
  const host = HOSTS[p.ambiente]
  if (
    !host ||
    !['GET', 'POST'].includes(p.metodo) ||
    !CAMINHO.test(p.caminho ?? '') ||
    !p.cert?.includes('BEGIN CERTIFICATE') ||
    !p.chave?.includes('PRIVATE KEY')
  ) {
    return json(400, { erro: 'Pedido inválido.' })
  }

  const corpo = p.corpo === undefined ? undefined : JSON.stringify(p.corpo)
  try {
    const r = await new Promise<{ status: number; corpo: string }>((resolver, falhar) => {
      const pedido = https.request(
        {
          host,
          path: `/SefinNacional/${p.caminho}`,
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
      pedido.on('timeout', () => pedido.destroy(new Error('a Sefin não respondeu a tempo')))
      pedido.on('error', falhar)
      pedido.end(corpo)
    })
    return json(200, r)
  } catch (e) {
    return json(502, { erro: `Falha na conexão com a Sefin: ${(e as Error).message}` })
  }
}
