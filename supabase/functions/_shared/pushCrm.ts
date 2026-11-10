// Notificações push do CRM: avisa no celular (e no computador) quando o cliente manda
// mensagem. Usado pelo webhook (função "whatsapp") e pelo teste da tela de diagnóstico
// (função "push").
//
// Segredos (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLICA   chave pública (base64url, 65 bytes)
//   VAPID_PRIVADA   chave privada (base64url, 32 bytes)
//   VAPID_CONTATO   mailto: de contato para os serviços de push (opcional)

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

import { enviarPush, type ChavesVapid, type ResultadoPush } from './webpush.ts'

export function chavesVapid(): ChavesVapid | null {
  const publica = Deno.env.get('VAPID_PUBLICA')
  const privada = Deno.env.get('VAPID_PRIVADA')
  if (!publica || !privada) return null
  return {
    publica,
    privada,
    contato: Deno.env.get('VAPID_CONTATO') ?? 'mailto:adm@ecoambientalsc.com.br',
  }
}

/** O que o Service Worker recebe (service-worker/sw.js, evento "push"). */
export type ConteudoPush = {
  titulo: string
  corpo: string
  /** Tela que abre ao tocar na notificação. */
  url: string
  /** Notificações com a mesma etiqueta se substituem (usamos uma por mensagem). */
  tag: string
  /** Conversa da notificação: o app limpa as notificações dela quando ela é aberta. */
  conversaId?: string
  /** Total de não lidas da pessoa, para o número no ícone do app. */
  naoLidas?: number
}

const ROTULO_TIPO: Record<string, string> = {
  imagem: '📷 Foto',
  audio: '🎤 Áudio',
  video: '🎥 Vídeo',
  documento: '📄 Documento',
  figurinha: 'Figurinha',
  localizacao: '📍 Localização',
  contato: '👤 Contato',
}

function telefone(waId: string) {
  const n = waId.replace(/\D/g, '')
  if (!/^55\d{10,11}$/.test(n)) return `+${n}`
  const l = n.slice(2)
  return l.length === 11
    ? `(${l.slice(0, 2)}) ${l.slice(2, 7)}-${l.slice(7)}`
    : `(${l.slice(0, 2)}) ${l.slice(2, 6)}-${l.slice(6)}`
}

type Envio = { inscricaoId: string; resultado: ResultadoPush }

/** Manda e cuida do resultado: apaga o aparelho que cancelou e anota o erro. */
async function enviarERegistrar(
  admin: SupabaseClient,
  chaves: ChavesVapid,
  destino: { inscricao_id: string; endpoint: string; p256dh: string; auth: string },
  conteudo: ConteudoPush,
): Promise<Envio> {
  const resultado = await enviarPush(destino, conteudo, chaves, {
    // Com o aparelho sem sinal, o serviço de push guarda só a última de cada conversa.
    topico: (conteudo.conversaId ?? conteudo.tag).replace(/-/g, ''),
  })
  if (resultado.expirada) {
    await admin.from('push_inscricoes').delete().eq('id', destino.inscricao_id)
  } else {
    await admin
      .from('push_inscricoes')
      .update(
        resultado.ok
          ? { ultimo_envio_em: new Date().toISOString(), ultimo_erro: null }
          : { ultimo_erro: resultado.erro },
      )
      .eq('id', destino.inscricao_id)
  }
  return { inscricaoId: destino.inscricao_id, resultado }
}

/**
 * Notifica quem deve saber de uma mensagem nova do cliente. Cada aparelho recebe cada
 * mensagem uma vez só (push_enviados), mesmo que o webhook chegue repetido.
 */
export async function notificarMensagem(
  admin: SupabaseClient,
  conversaId: string,
  mensagemId: string,
): Promise<void> {
  const chaves = chavesVapid()
  if (!chaves) {
    console.warn('Push: chaves VAPID não configuradas; notificação não enviada.')
    return
  }

  const { data: destinos, error } = await admin.rpc('crm_destinatarios_push', {
    p_conversa: conversaId,
  })
  if (error) throw new Error(`Push: ${error.message}`)
  const lista = (destinos ?? []) as {
    inscricao_id: string
    endpoint: string
    p256dh: string
    auth: string
    mostrar_previa: boolean
    nao_lidas_total: number
  }[]
  if (!lista.length) return

  // Só os aparelhos que ainda não receberam esta mensagem.
  const { data: novos, error: erroDedup } = await admin
    .from('push_enviados')
    .upsert(
      lista.map((d) => ({ mensagem_id: mensagemId, inscricao_id: d.inscricao_id })),
      { onConflict: 'mensagem_id,inscricao_id', ignoreDuplicates: true },
    )
    .select('inscricao_id')
  if (erroDedup) throw new Error(`Push: ${erroDedup.message}`)
  const enviar = new Set((novos ?? []).map((n: { inscricao_id: string }) => n.inscricao_id))
  if (!enviar.size) return

  const [{ data: conversa }, { data: mensagem }] = await Promise.all([
    admin
      .from('wa_conversas')
      .select('contato:wa_contatos (wa_id, nome_perfil, cliente:clientes (nome, nome_fantasia))')
      .eq('id', conversaId)
      .single(),
    admin.from('wa_mensagens').select('tipo, texto, midia_nome').eq('id', mensagemId).single(),
  ])
  const contato = (
    conversa as unknown as {
      contato: {
        wa_id: string
        nome_perfil: string | null
        cliente: { nome: string; nome_fantasia: string | null } | null
      }
    } | null
  )?.contato
  const nome =
    contato?.cliente?.nome_fantasia ||
    contato?.cliente?.nome ||
    contato?.nome_perfil ||
    (contato ? telefone(contato.wa_id) : 'Cliente')
  const previa =
    mensagem?.texto?.trim() ||
    (mensagem?.tipo === 'documento' && mensagem.midia_nome
      ? `📄 ${mensagem.midia_nome}`
      : (ROTULO_TIPO[mensagem?.tipo ?? ''] ?? 'Nova mensagem'))

  const envios = lista
    .filter((d) => enviar.has(d.inscricao_id))
    .map((d) =>
      enviarERegistrar(admin, chaves, d, {
        titulo: d.mostrar_previa ? nome : 'WhatsApp · Eco Ambiental',
        corpo: d.mostrar_previa ? previa.slice(0, 180) : 'Nova mensagem de cliente',
        url: `/crm/${conversaId}`,
        tag: `crm-${mensagemId}`,
        conversaId,
        naoLidas: Number(d.nao_lidas_total),
      }),
    )
  const resultados = await Promise.all(envios)
  const falhas = resultados.filter((r) => !r.resultado.ok)
  if (falhas.length) {
    console.warn(
      `Push: ${falhas.length} de ${resultados.length} não entregues ao serviço de push:`,
      falhas.map((f) => f.resultado.erro).join(' | '),
    )
  }
}

/** Notificação de teste para todos os aparelhos de uma pessoa (tela de diagnóstico). */
export async function enviarTeste(admin: SupabaseClient, usuarioId: string) {
  const chaves = chavesVapid()
  if (!chaves) {
    return {
      configurado: false,
      resultados: [] as { dispositivo: string | null; ok: boolean; erro: string | null }[],
    }
  }
  const { data } = await admin
    .from('push_inscricoes')
    .select('id, endpoint, p256dh, auth, dispositivo')
    .eq('usuario_id', usuarioId)
  const resultados = await Promise.all(
    (data ?? []).map(async (i) => {
      const { resultado } = await enviarERegistrar(
        admin,
        chaves,
        { inscricao_id: i.id, endpoint: i.endpoint, p256dh: i.p256dh, auth: i.auth },
        {
          titulo: 'Teste do Eco Gestão',
          corpo:
            'Se você está vendo isto, as notificações do atendimento funcionam neste aparelho.',
          url: '/crm/notificacoes',
          tag: 'crm-teste',
        },
      )
      return {
        dispositivo: i.dispositivo,
        ok: resultado.ok,
        erro: resultado.expirada
          ? 'Este aparelho cancelou as notificações; ative de novo nele.'
          : resultado.erro,
      }
    }),
  )
  return { configurado: true, resultados }
}
