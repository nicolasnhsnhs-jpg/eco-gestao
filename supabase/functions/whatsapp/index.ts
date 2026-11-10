// Edge Function "whatsapp": o webhook que a Meta chama a cada mensagem recebida e a
// cada mudança de status (enviada, entregue, lida, falhou) das mensagens enviadas.
//
//   GET   ativação do webhook no painel da Meta (hub.verify_token / hub.challenge)
//   POST  eventos, com a assinatura X-Hub-Signature-256 conferida antes de tudo
//
// Confiabilidade: o corpo bruto é gravado primeiro (wa_eventos, com o SHA-256 como
// chave, então um reenvio não duplica). Se o processamento falhar, a função responde
// 500 e a Meta reenvia o mesmo evento mais tarde (ela tenta por vários dias); o que
// já foi gravado não se repete porque cada mensagem tem o id da Meta como chave única.
// Depois de responder, as mídias são copiadas para o Storage em segundo plano.

import { clienteAdmin } from '../_shared/servidor.ts'
import { assinaturaValida, lerWebhook, sha256 } from '../_shared/whatsapp.ts'
import { notificarMensagem } from '../_shared/pushCrm.ts'
import { guardarMidiaRecebida } from '../_shared/whatsappApi.ts'

declare const EdgeRuntime: { waitUntil(promessa: Promise<unknown>): void }

const texto = (status: number, corpo = '') => new Response(corpo, { status })

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const combinado = Deno.env.get('WHATSAPP_VERIFY_TOKEN')
    if (
      combinado &&
      url.searchParams.get('hub.mode') === 'subscribe' &&
      url.searchParams.get('hub.verify_token') === combinado
    ) {
      return texto(200, url.searchParams.get('hub.challenge') ?? '')
    }
    return texto(403)
  }
  if (req.method !== 'POST') return texto(405)

  const bruto = await req.text()
  const segredo = Deno.env.get('WHATSAPP_APP_SECRET') ?? ''
  if (!(await assinaturaValida(bruto, req.headers.get('X-Hub-Signature-256'), segredo))) {
    console.warn('Webhook do WhatsApp com assinatura inválida: ignorado.')
    return texto(401)
  }

  let corpo: unknown
  try {
    corpo = JSON.parse(bruto)
  } catch {
    return texto(400)
  }

  const admin = clienteAdmin()
  const hash = await sha256(bruto)

  // 1. Guarda o evento como chegou (ou acha o mesmo, se for reenvio).
  const { error: erroGravar } = await admin
    .from('wa_eventos')
    .upsert({ hash, corpo }, { onConflict: 'hash', ignoreDuplicates: true })
  if (erroGravar) {
    console.error('Não consegui gravar o evento do WhatsApp:', erroGravar.message)
    return texto(500)
  }
  const { data: evento, error: erroLer } = await admin
    .from('wa_eventos')
    .select('id, processado_em, tentativas')
    .eq('hash', hash)
    .single()
  if (erroLer || !evento) return texto(500)
  if (evento.processado_em) return texto(200)

  // 2. Processa: mensagens e status.
  const { mensagens, status } = lerWebhook(corpo)
  const comMidia: string[] = []
  const avisos: string[] = []
  // Uma notificação por conversa: a da última mensagem nova (reação não notifica).
  const notificar = new Map<string, string>()
  try {
    for (const m of mensagens) {
      const { data, error } = await admin.rpc('crm_receber_mensagem', {
        p_phone_number_id: m.phoneNumberId,
        p_wa_id: m.waId,
        p_nome_perfil: m.nomePerfil,
        p_wamid: m.wamid,
        p_tipo: m.tipo,
        p_texto: m.texto,
        p_midia_id: m.midiaId,
        p_midia_mime: m.midiaMime,
        p_midia_nome: m.midiaNome,
        p_responde_wamid: m.respondeWamid,
        p_enviada_em: m.enviadaEm,
      })
      if (error?.code === 'P0002') {
        // Número da Meta que não está em wa_numeros: reenviar não resolve. Fica anotado
        // no evento (e no log) e não trava os outros.
        avisos.push(error.message)
        continue
      }
      if (error) throw new Error(error.message)
      const linha = (data as { conversa_id: string; mensagem_id: string; nova: boolean }[] | null)?.[0]
      if (linha?.nova && m.midiaId) comMidia.push(linha.mensagem_id)
      if (linha?.nova && m.tipo !== 'reacao') notificar.set(linha.conversa_id, linha.mensagem_id)
    }
    for (const s of status) {
      const { error } = await admin.rpc('crm_atualizar_status', {
        p_wamid: s.wamid,
        p_status: s.status,
        p_em: s.em,
        p_erro: s.erro,
      })
      if (error) throw new Error(error.message)
    }
  } catch (e) {
    const erro = (e as Error).message
    console.error('Falha ao processar o evento do WhatsApp:', erro)
    await admin
      .from('wa_eventos')
      .update({ erro, tentativas: evento.tentativas + 1 })
      .eq('id', evento.id)
    return texto(500)
  }

  await admin
    .from('wa_eventos')
    .update({
      processado_em: new Date().toISOString(),
      erro: avisos.length ? avisos.join(' | ') : null,
      tentativas: evento.tentativas + 1,
    })
    .eq('id', evento.id)

  // 3. Depois de responder: notifica a equipe e copia as mídias. Se a cópia falhar, a
  // tela tenta de novo ao abrir a mensagem (ação "midia" da função "crm").
  if (notificar.size) EdgeRuntime.waitUntil(enviarNotificacoes(notificar))
  if (comMidia.length) EdgeRuntime.waitUntil(copiarMidias(comMidia))
  return texto(200)
})

async function copiarMidias(ids: string[]) {
  const admin = clienteAdmin()
  const { data } = await admin
    .from('wa_mensagens')
    .select('id, conversa_id, midia_id, midia_mime, midia_nome')
    .in('id', ids)
    .is('midia_caminho', null)
  for (const m of data ?? []) {
    try {
      await guardarMidiaRecebida(admin, m)
    } catch (e) {
      console.error(`Mídia da mensagem ${m.id} não copiada:`, (e as Error).message)
    }
  }
}

async function enviarNotificacoes(porConversa: Map<string, string>) {
  const admin = clienteAdmin()
  for (const [conversaId, mensagemId] of porConversa) {
    try {
      await notificarMensagem(admin, conversaId, mensagemId)
    } catch (e) {
      console.error(`Notificação da conversa ${conversaId} não enviada:`, (e as Error).message)
    }
  }
}
