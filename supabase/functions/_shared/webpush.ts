// Web Push padrão (o mesmo do iPhone, Android e computador), feito só com WebCrypto:
//   - RFC 8291: criptografa o conteúdo para o aparelho (aes128gcm). Nem o serviço de push
//     da Apple/Google consegue ler a mensagem.
//   - RFC 8292 (VAPID): assina o pedido com a chave do servidor, para o serviço de push
//     saber que é o nosso sistema.
// Sem nada do Deno aqui, para os testes (Vitest) rodarem no Node.

export type Inscricao = { endpoint: string; p256dh: string; auth: string }

export type ChavesVapid = {
  /** Chave pública, 65 bytes (ponto não comprimido), em base64url. Vai para o navegador. */
  publica: string
  /** Chave privada (o "d", 32 bytes), em base64url. Só no servidor. */
  privada: string
  /** Contato que o serviço de push usa se houver problema (mailto: ou https:). */
  contato: string
}

const enc = new TextEncoder()

export function paraBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function deBase64Url(texto: string): Uint8Array {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function juntar(...partes: Uint8Array[]): Uint8Array {
  const total = new Uint8Array(partes.reduce((n, p) => n + p.length, 0))
  let i = 0
  for (const p of partes) {
    total.set(p, i)
    i += p.length
  }
  return total
}

// ArrayBuffer "puro" (o WebCrypto do TypeScript não aceita Uint8Array de SharedArrayBuffer).
const buf = (b: Uint8Array): ArrayBuffer => b.slice().buffer as ArrayBuffer

/** Chave privada P-256 a partir do "d" e da pública (65 bytes). */
function jwkPrivada(d: Uint8Array, publica: Uint8Array): JsonWebKey {
  return {
    kty: 'EC',
    crv: 'P-256',
    d: paraBase64Url(d),
    x: paraBase64Url(publica.slice(1, 33)),
    y: paraBase64Url(publica.slice(33, 65)),
    ext: true,
  }
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const chave = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(info) },
    chave,
    bytes * 8,
  )
  return new Uint8Array(bits)
}

/** Só para os testes: fixa o sal e a chave temporária (para conferir com a RFC). */
export type Fixos = { salt: Uint8Array; efemeraPrivada: Uint8Array; efemeraPublica: Uint8Array }

/** Criptografa o conteúdo para o aparelho (RFC 8291, um registro só). */
export async function criptografar(
  conteudo: Uint8Array,
  inscricao: Pick<Inscricao, 'p256dh' | 'auth'>,
  fixos?: Fixos,
): Promise<Uint8Array> {
  const uaPublica = deBase64Url(inscricao.p256dh)
  const segredoAuth = deBase64Url(inscricao.auth)
  if (uaPublica.length !== 65 || segredoAuth.length !== 16) {
    throw new Error('Inscrição de push inválida (chaves do aparelho).')
  }

  let efemera: CryptoKeyPair | { privateKey: CryptoKey }
  let asPublica: Uint8Array
  if (fixos) {
    efemera = {
      privateKey: await crypto.subtle.importKey(
        'jwk',
        jwkPrivada(fixos.efemeraPrivada, fixos.efemeraPublica),
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        ['deriveBits'],
      ),
    }
    asPublica = fixos.efemeraPublica
  } else {
    const par = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair
    efemera = par
    asPublica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey))
  }

  const chaveDoAparelho = await crypto.subtle.importKey(
    'raw',
    buf(uaPublica),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const segredoEcdh = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: chaveDoAparelho },
      efemera.privateKey,
      256,
    ),
  )

  const infoChave = juntar(enc.encode('WebPush: info\0'), uaPublica, asPublica)
  const ikm = await hkdf(segredoAuth, segredoEcdh, infoChave, 32)
  const salt = fixos?.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  // Último (e único) registro: conteúdo + delimitador 0x02, sem enchimento.
  const claro = juntar(conteudo, new Uint8Array([2]))
  const chaveAes = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['encrypt'])
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce) }, chaveAes, buf(claro)),
  )

  // Cabeçalho: sal (16) | tamanho do registro (4, big-endian) | tamanho da chave (1) | chave
  const rs = 4096
  const cabecalho = juntar(
    salt,
    new Uint8Array([(rs >>> 24) & 255, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255]),
    new Uint8Array([asPublica.length]),
    asPublica,
  )
  return juntar(cabecalho, cifrado)
}

/** Cabeçalho Authorization do VAPID (JWT ES256 com validade de 12 horas). */
export async function autorizacaoVapid(
  endpoint: string,
  chaves: ChavesVapid,
  agora = Date.now(),
): Promise<string> {
  const publica = deBase64Url(chaves.publica)
  const privada = await crypto.subtle.importKey(
    'jwk',
    jwkPrivada(deBase64Url(chaves.privada), publica),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const cabecalho = paraBase64Url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const dados = paraBase64Url(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(agora / 1000) + 12 * 60 * 60,
        sub: chaves.contato,
      }),
    ),
  )
  const assinatura = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privada,
      buf(enc.encode(`${cabecalho}.${dados}`)),
    ),
  )
  return `vapid t=${cabecalho}.${dados}.${paraBase64Url(assinatura)}, k=${chaves.publica}`
}

export type ResultadoPush = {
  /** true: o serviço de push aceitou. */
  ok: boolean
  status: number
  /** true: o aparelho cancelou a inscrição (404/410): apagar do banco. */
  expirada: boolean
  erro: string | null
}

/**
 * Manda uma notificação. `topico` substitui uma notificação ainda não entregue com o
 * mesmo tópico (ex.: várias mensagens da mesma conversa com o celular sem sinal).
 */
export async function enviarPush(
  inscricao: Inscricao,
  conteudo: unknown,
  chaves: ChavesVapid,
  opcoes: { ttlSegundos?: number; topico?: string; urgencia?: 'normal' | 'high' } = {},
): Promise<ResultadoPush> {
  const corpo = await criptografar(enc.encode(JSON.stringify(conteudo)), inscricao)
  const cabecalhos: Record<string, string> = {
    Authorization: await autorizacaoVapid(inscricao.endpoint, chaves),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(opcoes.ttlSegundos ?? 24 * 60 * 60),
    Urgency: opcoes.urgencia ?? 'high',
  }
  if (opcoes.topico) cabecalhos.Topic = opcoes.topico.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)

  let resp: Response
  try {
    resp = await fetch(inscricao.endpoint, {
      method: 'POST',
      headers: cabecalhos,
      body: buf(corpo),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (e) {
    return { ok: false, status: 0, expirada: false, erro: `Sem conexão: ${(e as Error).message}` }
  }
  const ok = resp.status >= 200 && resp.status < 300
  const texto = ok ? '' : (await resp.text().catch(() => '')).slice(0, 300)
  return {
    ok,
    status: resp.status,
    expirada: resp.status === 404 || resp.status === 410,
    erro: ok ? null : `HTTP ${resp.status}${texto ? `: ${texto}` : ''}`,
  }
}
