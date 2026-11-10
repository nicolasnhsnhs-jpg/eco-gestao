// Edge Function "crm": o que a equipe faz no WhatsApp pelo sistema. O navegador manda
// o pedido com o login; esta função confere se a pessoa enxerga a conversa (com as
// mesmas regras do banco, RLS) e fala com a Meta usando o token, que fica só aqui.
//
//   enviar   texto ou arquivo (já enviado ao Storage em enviadas/<conversa>/…)
//   lida     zera as não lidas e manda a confirmação de leitura ao cliente
//   midia    copia de novo uma mídia recebida que não foi copiada pelo webhook
//
// A janela de 24 horas é conferida antes de chamar a Meta: fora dela, só template
// aprovado (fica para a próxima etapa).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

import { clienteAdmin, CORS, resposta } from '../_shared/servidor.ts'
import { comoEnviar, janelaAberta, TIPO_DO_ENVIO } from '../_shared/whatsapp.ts'
import {
  enviarArquivo,
  enviarTexto,
  FalhaMeta,
  guardarMidiaRecebida,
  marcarComoLida,
} from '../_shared/whatsappApi.ts'

type Arquivo = { caminho: string; mime: string; nome: string; tamanho: number }

type Pedido =
  | {
      acao: 'enviar'
      conversaId: string
      texto?: string
      arquivo?: Arquivo
      respondeWamid?: string
    }
  | { acao: 'lida'; conversaId: string }
  | { acao: 'midia'; mensagemId: string }

const LIMITE_TEXTO = 4096

function chavePublica(): string {
  const novas = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  if (novas) {
    const chaves = JSON.parse(novas) as Record<string, string>
    if (chaves.default) return chaves.default
  }
  const antiga = Deno.env.get('SUPABASE_ANON_KEY')
  if (!antiga) throw new Error('Chave pública do Supabase não configurada.')
  return antiga
}

/** Cliente com o login de quem chamou: o banco aplica as regras de acesso (RLS). */
function clienteDoUsuario(token: string): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, chavePublica(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

type Conversa = {
  id: string
  ultima_entrada_em: string | null
  contato: { wa_id: string }
  numero: { phone_number_id: string }
}

/** A conversa, se quem chamou consegue ver (senão, null). */
async function conversaVisivel(usuario: SupabaseClient, id: string): Promise<Conversa | null> {
  const { data } = await usuario
    .from('wa_conversas')
    .select('id, ultima_entrada_em, contato:wa_contatos(wa_id), numero:wa_numeros(phone_number_id)')
    .eq('id', id)
    .maybeSingle()
  return (data as Conversa | null) ?? null
}

async function enviar(
  admin: SupabaseClient,
  usuario: SupabaseClient,
  usuarioId: string,
  pedido: Extract<Pedido, { acao: 'enviar' }>,
) {
  const texto = pedido.texto?.trim() || null
  const arquivo = pedido.arquivo
  if (!texto && !arquivo)
    return resposta(400, { erro: 'Escreva a mensagem ou escolha um arquivo.' })
  if (texto && texto.length > LIMITE_TEXTO) {
    return resposta(400, { erro: `A mensagem passa de ${LIMITE_TEXTO} caracteres.` })
  }

  const conversa = await conversaVisivel(usuario, pedido.conversaId)
  if (!conversa) return resposta(404, { erro: 'Conversa não encontrada.' })
  if (!janelaAberta(conversa.ultima_entrada_em)) {
    return resposta(409, {
      erro: 'Passaram 24 horas da última mensagem do cliente. Pela regra da Meta, agora só dá para mandar um modelo (template) aprovado.',
      codigo: 'janela_fechada',
    })
  }

  let tipoEnvio: ReturnType<typeof comoEnviar> = null
  if (arquivo) {
    // O arquivo tem que estar na pasta desta conversa (a regra do Storage já confere quem enviou).
    if (!arquivo.caminho.startsWith(`enviadas/${conversa.id}/`)) {
      return resposta(400, { erro: 'Arquivo fora da pasta da conversa.' })
    }
    tipoEnvio = comoEnviar(arquivo.mime, arquivo.tamanho)
    if (!tipoEnvio)
      return resposta(400, { erro: 'O arquivo passa de 100 MB, o limite do WhatsApp.' })
  }

  // Grava antes de mandar: se a conexão cair, a mensagem fica como "falhou" na tela.
  const { data: mensagemId, error: erroGravar } = await admin.rpc('crm_registrar_envio', {
    p_conversa: conversa.id,
    p_usuario: usuarioId,
    p_tipo: tipoEnvio ? TIPO_DO_ENVIO[tipoEnvio] : 'texto',
    p_texto: texto,
    p_midia_caminho: arquivo?.caminho ?? null,
    p_midia_mime: arquivo?.mime ?? null,
    p_midia_nome: arquivo?.nome ?? null,
    p_midia_tamanho: arquivo?.tamanho ?? null,
  })
  if (erroGravar) return resposta(500, { erro: erroGravar.message })

  try {
    let wamid: string
    const { phone_number_id } = conversa.numero
    const para = conversa.contato.wa_id
    if (arquivo && tipoEnvio) {
      const { data: blob, error } = await admin.storage.from('whatsapp').download(arquivo.caminho)
      if (error || !blob) throw new Error('Não encontrei o arquivo enviado. Tente anexar de novo.')
      wamid = await enviarArquivo(
        phone_number_id,
        para,
        tipoEnvio,
        blob,
        arquivo.mime,
        arquivo.nome,
        texto,
        pedido.respondeWamid,
      )
    } else {
      wamid = await enviarTexto(phone_number_id, para, texto!, pedido.respondeWamid)
    }
    await admin
      .from('wa_mensagens')
      .update({ wamid, status: 'enviada', status_em: new Date().toISOString() })
      .eq('id', mensagemId)
    return resposta(200, { mensagemId, wamid })
  } catch (e) {
    const erro = (e as Error).message
    await admin
      .from('wa_mensagens')
      .update({ status: 'falhou', erro, status_em: new Date().toISOString() })
      .eq('id', mensagemId)
    return resposta(e instanceof FalhaMeta ? 502 : 500, { erro, mensagemId })
  }
}

async function marcarLida(admin: SupabaseClient, usuario: SupabaseClient, conversaId: string) {
  const conversa = await conversaVisivel(usuario, conversaId)
  if (!conversa) return resposta(404, { erro: 'Conversa não encontrada.' })
  const { error } = await usuario.rpc('crm_marcar_lida', { conversa: conversaId })
  if (error) return resposta(400, { erro: error.message })

  // Confirmação de leitura: marcar a última mensagem do cliente marca as anteriores também.
  const { data: ultima } = await admin
    .from('wa_mensagens')
    .select('wamid')
    .eq('conversa_id', conversaId)
    .eq('direcao', 'entrada')
    .not('wamid', 'is', null)
    .order('enviada_em', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (ultima?.wamid) {
    try {
      await marcarComoLida(conversa.numero.phone_number_id, ultima.wamid)
    } catch (e) {
      // Não é grave: o contador da equipe já foi zerado.
      console.warn('Confirmação de leitura não enviada:', (e as Error).message)
    }
  }
  return resposta(200, { ok: true })
}

async function copiarMidia(admin: SupabaseClient, usuario: SupabaseClient, mensagemId: string) {
  // Pelo login de quem pede: só copia mídia de conversa que a pessoa vê.
  const { data: m } = await usuario
    .from('wa_mensagens')
    .select('id, conversa_id, midia_id, midia_mime, midia_nome, midia_caminho')
    .eq('id', mensagemId)
    .maybeSingle()
  if (!m) return resposta(404, { erro: 'Mensagem não encontrada.' })
  if (m.midia_caminho) return resposta(200, { caminho: m.midia_caminho })
  if (!m.midia_id) return resposta(400, { erro: 'Esta mensagem não tem arquivo.' })
  try {
    const caminho = await guardarMidiaRecebida(admin, m)
    return resposta(200, { caminho })
  } catch (e) {
    return resposta(502, { erro: (e as Error).message })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' })

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return resposta(401, { erro: 'Faça login novamente.' })
  const admin = clienteAdmin()
  const { data: quem, error } = await admin.auth.getUser(token)
  if (error || !quem.user) return resposta(401, { erro: 'Sessão expirada. Faça login novamente.' })

  const usuario = clienteDoUsuario(token)
  let pedido: Pedido
  try {
    pedido = (await req.json()) as Pedido
  } catch {
    return resposta(400, { erro: 'Pedido inválido.' })
  }

  try {
    switch (pedido.acao) {
      case 'enviar':
        return await enviar(admin, usuario, quem.user.id, pedido)
      case 'lida':
        return await marcarLida(admin, usuario, pedido.conversaId)
      case 'midia':
        return await copiarMidia(admin, usuario, pedido.mensagemId)
      default:
        return resposta(400, { erro: 'Ação desconhecida.' })
    }
  } catch (e) {
    console.error('Erro na função crm:', e)
    return resposta(500, { erro: (e as Error).message })
  }
})
