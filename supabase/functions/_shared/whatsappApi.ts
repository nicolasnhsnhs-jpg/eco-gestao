// Conversa com a Graph API da Meta (WhatsApp Cloud API). Só roda no servidor:
// o token fica nos segredos das Edge Functions e nunca vai para o navegador.
//
// Segredos (Supabase → Edge Functions → Secrets):
//   WHATSAPP_TOKEN          token permanente do Usuário do Sistema
//   WHATSAPP_APP_SECRET     chave secreta do app (confere a assinatura do webhook)
//   WHATSAPP_VERIFY_TOKEN   texto combinado com a Meta para ativar o webhook
//   WHATSAPP_GRAPH_VERSION  versão da Graph API (opcional; padrão abaixo)

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

import { explicarErroMeta, extensaoDoMime } from './whatsapp.ts'

const VERSAO = Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v23.0'
const GRAPH = `https://graph.facebook.com/${VERSAO}`

export class FalhaMeta extends Error {
  constructor(
    mensagem: string,
    readonly codigo?: number,
  ) {
    super(mensagem)
  }
}

function token(): string {
  const t = Deno.env.get('WHATSAPP_TOKEN')
  if (!t) throw new FalhaMeta('O WhatsApp ainda não foi configurado (falta o token da Meta).')
  return t
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  let resp: Response
  try {
    resp = await fetch(`${GRAPH}/${caminho}`, {
      ...init,
      headers: { Authorization: `Bearer ${token()}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    if (e instanceof FalhaMeta) throw e
    throw new FalhaMeta('Sem conexão com a Meta agora. Tente de novo em instantes.')
  }
  const corpo = (await resp.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number; error_data?: { details?: string } }
  }
  if (!resp.ok || corpo.error) {
    const e = corpo.error ?? {}
    const detalhe = e.error_data?.details ?? e.message ?? `HTTP ${resp.status}`
    throw new FalhaMeta(explicarErroMeta(e.code, detalhe), e.code)
  }
  return corpo as T
}

type RespostaEnvio = { messages?: { id: string }[] }

async function enviar(phoneNumberId: string, corpo: Record<string, unknown>): Promise<string> {
  const r = await chamar<RespostaEnvio>(`${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...corpo }),
  })
  const id = r.messages?.[0]?.id
  if (!id) throw new FalhaMeta('A Meta não devolveu o número da mensagem.')
  return id
}

const contexto = (respondeWamid?: string | null) =>
  respondeWamid ? { context: { message_id: respondeWamid } } : {}

export function enviarTexto(
  phoneNumberId: string,
  para: string,
  texto: string,
  respondeWamid?: string | null,
) {
  return enviar(phoneNumberId, {
    to: para,
    type: 'text',
    text: { body: texto, preview_url: true },
    ...contexto(respondeWamid),
  })
}

/** Sobe o arquivo para a Meta e manda a mensagem com ele. */
export async function enviarArquivo(
  phoneNumberId: string,
  para: string,
  tipo: 'image' | 'video' | 'audio' | 'document',
  arquivo: Blob,
  mime: string,
  nome: string,
  legenda?: string | null,
  respondeWamid?: string | null,
) {
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', mime)
  form.append('file', new Blob([arquivo], { type: mime }), nome)
  const { id } = await chamar<{ id: string }>(`${phoneNumberId}/media`, {
    method: 'POST',
    body: form,
  })

  const midia: Record<string, unknown> = { id }
  // O áudio não tem legenda; o documento leva o nome do arquivo.
  if (legenda && tipo !== 'audio') midia.caption = legenda
  if (tipo === 'document') midia.filename = nome
  return enviar(phoneNumberId, { to: para, type: tipo, [tipo]: midia, ...contexto(respondeWamid) })
}

/** Avisa o cliente que a mensagem foi lida (os dois tracinhos azuis). */
export async function marcarComoLida(phoneNumberId: string, wamid: string) {
  await chamar(`${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: wamid }),
  })
}

/**
 * Copia a mídia recebida da Meta para o nosso Storage. O endereço que a Meta dá vale
 * poucos minutos e pede o token, então o navegador não consegue abrir direto.
 * Devolve o caminho no bucket "whatsapp".
 */
export async function guardarMidiaRecebida(
  admin: SupabaseClient,
  mensagem: {
    id: string
    conversa_id: string
    midia_id: string
    midia_mime: string | null
    midia_nome: string | null
  },
): Promise<string> {
  const info = await chamar<{ url: string; mime_type?: string; file_size?: number }>(
    mensagem.midia_id,
  )
  let resp: Response
  try {
    resp = await fetch(info.url, {
      headers: { Authorization: `Bearer ${token()}` },
      signal: AbortSignal.timeout(60_000),
    })
  } catch {
    throw new FalhaMeta('Sem conexão com a Meta para baixar o arquivo.')
  }
  if (!resp.ok) throw new FalhaMeta(`A Meta não entregou o arquivo (HTTP ${resp.status}).`)
  const mime = info.mime_type ?? mensagem.midia_mime ?? 'application/octet-stream'
  const arquivo = await resp.blob()
  const caminho = `recebidas/${mensagem.conversa_id}/${mensagem.id}.${extensaoDoMime(mime, mensagem.midia_nome)}`

  const { error } = await admin.storage
    .from('whatsapp')
    .upload(caminho, arquivo, { contentType: mime.split(';')[0], upsert: true })
  if (error) throw new Error(`Não consegui guardar o arquivo: ${error.message}`)

  const { error: erroMsg } = await admin
    .from('wa_mensagens')
    .update({ midia_caminho: caminho, midia_mime: mime, midia_tamanho: arquivo.size })
    .eq('id', mensagem.id)
  if (erroMsg) throw new Error(erroMsg.message)
  return caminho
}
