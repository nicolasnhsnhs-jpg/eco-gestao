import { describe, expect, it } from 'vitest'

import {
  autorizacaoVapid,
  criptografar,
  deBase64Url,
  paraBase64Url,
} from '../../../supabase/functions/_shared/webpush'

const buf = (b: Uint8Array): ArrayBuffer => b.slice().buffer as ArrayBuffer

// Exemplo oficial da RFC 8291, seção 5 (chaves, sal e resultado esperado).
const RFC = {
  texto: 'When I grow up, I want to be a watermelon',
  uaPrivada: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaPublica:
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  asPrivada: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublica:
    'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  resultado:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

/** Decifra como o aparelho faria (RFC 8291), para a ida e volta. */
async function decifrar(
  corpo: Uint8Array,
  uaPrivadaD: Uint8Array,
  uaPublica: Uint8Array,
  auth: Uint8Array,
) {
  const enc = new TextEncoder()
  const salt = corpo.slice(0, 16)
  const tamChave = corpo[20]
  const asPublica = corpo.slice(21, 21 + tamChave)
  const cifrado = corpo.slice(21 + tamChave)

  const privada = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: paraBase64Url(uaPrivadaD),
      x: paraBase64Url(uaPublica.slice(1, 33)),
      y: paraBase64Url(uaPublica.slice(33)),
    },
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  )
  const doServidor = await crypto.subtle.importKey(
    'raw',
    buf(asPublica),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: doServidor }, privada, 256),
  )
  const hkdf = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) => {
    const k = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits'])
    return new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt: buf(s), info: buf(info) },
        k,
        n * 8,
      ),
    )
  }
  const junta = (...p: Uint8Array[]) => Uint8Array.from(p.flatMap((x) => [...x]))
  const ikm = await hkdf(auth, ecdh, junta(enc.encode('WebPush: info\0'), uaPublica, asPublica), 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const chave = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['decrypt'])
  const claro = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(nonce) }, chave, buf(cifrado)),
  )
  expect(claro[claro.length - 1]).toBe(2) // delimitador do último registro
  return new TextDecoder().decode(claro.slice(0, -1))
}

describe('criptografia do Web Push (RFC 8291)', () => {
  it('bate exatamente com o exemplo da RFC', async () => {
    const corpo = await criptografar(
      new TextEncoder().encode(RFC.texto),
      { p256dh: RFC.uaPublica, auth: RFC.auth },
      {
        salt: deBase64Url(RFC.salt),
        efemeraPrivada: deBase64Url(RFC.asPrivada),
        efemeraPublica: deBase64Url(RFC.asPublica),
      },
    )
    expect(paraBase64Url(corpo)).toBe(RFC.resultado)
  })

  it('ida e volta com chaves novas (como em produção)', async () => {
    const aparelho = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair
    const publica = new Uint8Array(await crypto.subtle.exportKey('raw', aparelho.publicKey))
    const d = deBase64Url((await crypto.subtle.exportKey('jwk', aparelho.privateKey)).d!)
    const auth = crypto.getRandomValues(new Uint8Array(16))
    const conteudo = JSON.stringify({ titulo: 'Maria', corpo: 'Olá! Ação às 9h 🙂' })

    const corpo = await criptografar(new TextEncoder().encode(conteudo), {
      p256dh: paraBase64Url(publica),
      auth: paraBase64Url(auth),
    })
    expect(await decifrar(corpo, d, publica, auth)).toBe(conteudo)
  })

  it('recusa inscrição com chaves erradas', async () => {
    await expect(
      criptografar(new Uint8Array([1]), { p256dh: 'abc', auth: RFC.auth }),
    ).rejects.toThrow('Inscrição de push inválida')
  })
})

describe('VAPID (RFC 8292)', () => {
  it('assina um JWT ES256 que confere com a chave pública', async () => {
    const par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair
    const publica = paraBase64Url(
      new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey)),
    )
    const privada = (await crypto.subtle.exportKey('jwk', par.privateKey)).d!
    const agora = Date.parse('2026-11-09T12:00:00Z')

    const cabecalho = await autorizacaoVapid(
      'https://web.push.apple.com/QGuQyavXutnMH...',
      { publica, privada, contato: 'mailto:adm@ecoambientalsc.com.br' },
      agora,
    )
    const [, jwt, k] = cabecalho.match(/^vapid t=([^,]+), k=(.+)$/)!
    expect(k).toBe(publica)

    const [h, p, s] = jwt.split('.')
    expect(JSON.parse(new TextDecoder().decode(deBase64Url(h)))).toEqual({
      typ: 'JWT',
      alg: 'ES256',
    })
    expect(JSON.parse(new TextDecoder().decode(deBase64Url(p)))).toEqual({
      aud: 'https://web.push.apple.com',
      exp: agora / 1000 + 12 * 3600,
      sub: 'mailto:adm@ecoambientalsc.com.br',
    })
    const valida = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      par.publicKey,
      buf(deBase64Url(s)),
      buf(new TextEncoder().encode(`${h}.${p}`)),
    )
    expect(valida).toBe(true)
  })
})
