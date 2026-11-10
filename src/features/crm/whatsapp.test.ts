import { describe, expect, it } from 'vitest'

import {
  assinaturaValida,
  comoEnviar,
  extensaoDoMime,
  janelaAberta,
  lerWebhook,
} from '../../../supabase/functions/_shared/whatsapp'

const SEGREDO = 'segredo-de-teste'
/** Assina como a Meta: HMAC-SHA256 do corpo com o App Secret. */
async function assinar(corpo: string) {
  const enc = new TextEncoder()
  const chave = await crypto.subtle.importKey(
    'raw',
    enc.encode(SEGREDO),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', chave, enc.encode(corpo)))
  return 'sha256=' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('assinatura do webhook', () => {
  const corpo = '{"object":"whatsapp_business_account","entry":[]}'

  it('aceita a assinatura certa', async () => {
    expect(await assinaturaValida(corpo, await assinar(corpo), SEGREDO)).toBe(true)
  })

  it('recusa corpo alterado, assinatura errada, sem cabeçalho ou sem segredo', async () => {
    expect(await assinaturaValida(corpo + ' ', await assinar(corpo), SEGREDO)).toBe(false)
    expect(await assinaturaValida(corpo, 'sha256=' + '0'.repeat(64), SEGREDO)).toBe(false)
    expect(await assinaturaValida(corpo, null, SEGREDO)).toBe(false)
    expect(await assinaturaValida(corpo, await assinar(corpo), '')).toBe(false)
    expect(await assinaturaValida(corpo, 'sha1=abc', SEGREDO)).toBe(false)
  })
})

const webhook = (value: object) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: 'WABA', changes: [{ field: 'messages', value }] }],
})

describe('lerWebhook', () => {
  const metadata = { display_phone_number: '5548988608723', phone_number_id: '123456' }

  it('lê texto com o nome do perfil e a citação', () => {
    const { mensagens, status } = lerWebhook(
      webhook({
        messaging_product: 'whatsapp',
        metadata,
        contacts: [{ profile: { name: 'Maria' }, wa_id: '5548999990000' }],
        messages: [
          {
            from: '5548999990000',
            id: 'wamid.A',
            timestamp: '1762700000',
            type: 'text',
            text: { body: 'Bom dia' },
            context: { id: 'wamid.ANTERIOR' },
          },
        ],
      }),
    )
    expect(status).toEqual([])
    expect(mensagens).toEqual([
      {
        phoneNumberId: '123456',
        waId: '5548999990000',
        nomePerfil: 'Maria',
        wamid: 'wamid.A',
        tipo: 'texto',
        texto: 'Bom dia',
        midiaId: null,
        midiaMime: null,
        midiaNome: null,
        respondeWamid: 'wamid.ANTERIOR',
        enviadaEm: new Date(1762700000 * 1000).toISOString(),
      },
    ])
  })

  it('lê documento, imagem com legenda, áudio e tipo desconhecido', () => {
    const { mensagens } = lerWebhook(
      webhook({
        metadata,
        messages: [
          {
            from: '1',
            id: 'd',
            timestamp: '1',
            type: 'document',
            document: { id: 'M1', mime_type: 'application/pdf', filename: 'contrato.pdf' },
          },
          {
            from: '1',
            id: 'i',
            timestamp: '1',
            type: 'image',
            image: { id: 'M2', mime_type: 'image/jpeg', caption: 'a pia' },
          },
          {
            from: '1',
            id: 'a',
            timestamp: '1',
            type: 'audio',
            audio: { id: 'M3', mime_type: 'audio/ogg; codecs=opus', voice: true },
          },
          { from: '1', id: 'u', timestamp: '1', type: 'unsupported' },
        ],
      }),
    )
    expect(mensagens.map((m) => [m.tipo, m.midiaId, m.midiaNome, m.texto])).toEqual([
      ['documento', 'M1', 'contrato.pdf', null],
      ['imagem', 'M2', null, 'a pia'],
      ['audio', 'M3', null, null],
      ['outro', null, null, '[Mensagem do tipo "unsupported" que o sistema ainda não mostra]'],
    ])
  })

  it('lê status, inclusive a falha com o código', () => {
    const { status } = lerWebhook(
      webhook({
        metadata,
        statuses: [
          { id: 'w1', status: 'delivered', timestamp: '10', recipient_id: '1' },
          {
            id: 'w2',
            status: 'failed',
            timestamp: '11',
            errors: [
              { code: 131047, title: 'Re-engagement message', error_data: { details: 'janela' } },
            ],
          },
          { id: 'w3', status: 'qualquer' },
        ],
      }),
    )
    expect(status).toEqual([
      { wamid: 'w1', status: 'entregue', em: new Date(10_000).toISOString(), erro: null },
      { wamid: 'w2', status: 'falhou', em: new Date(11_000).toISOString(), erro: '131047: janela' },
    ])
  })

  it('ignora o que não é do WhatsApp', () => {
    expect(lerWebhook({ object: 'page' })).toEqual({ mensagens: [], status: [] })
    expect(lerWebhook(null)).toEqual({ mensagens: [], status: [] })
  })
})

describe('envio de arquivos', () => {
  const MB = 1024 * 1024
  it('escolhe o tipo e manda como documento o que não cabe', () => {
    expect(comoEnviar('image/jpeg', 1 * MB)).toBe('image')
    expect(comoEnviar('image/jpeg', 6 * MB)).toBe('document')
    expect(comoEnviar('image/heic', 1 * MB)).toBe('document')
    expect(comoEnviar('video/mp4', 10 * MB)).toBe('video')
    expect(comoEnviar('video/quicktime', 10 * MB)).toBe('document')
    expect(comoEnviar('audio/mp4', 1 * MB)).toBe('audio')
    expect(comoEnviar('application/pdf', 99 * MB)).toBe('document')
    expect(comoEnviar('application/pdf', 101 * MB)).toBeNull()
  })

  it('extensão para guardar', () => {
    expect(extensaoDoMime('audio/ogg; codecs=opus', null)).toBe('ogg')
    expect(extensaoDoMime('application/pdf', 'Contrato.PDF')).toBe('pdf')
    expect(extensaoDoMime('application/x-qualquer', null)).toBe('bin')
  })
})

describe('janela de 24 horas', () => {
  const agora = Date.parse('2026-11-09T12:00:00Z')
  it('aberta até 24h depois da última mensagem do cliente', () => {
    expect(janelaAberta('2026-11-08T12:00:01Z', agora)).toBe(true)
    expect(janelaAberta('2026-11-08T12:00:00Z', agora)).toBe(false)
    expect(janelaAberta(null, agora)).toBe(false)
  })
})
