// Edge Function "push": apoio da tela de notificações do CRM.
//
//   chave   devolve a chave pública VAPID (o navegador precisa dela para se inscrever)
//   teste   manda uma notificação de teste para todos os aparelhos de quem chamou
//
// As notificações de mensagem nova saem do webhook (função "whatsapp").

import { clienteAdmin, CORS, resposta } from '../_shared/servidor.ts'
import { chavesVapid, enviarTeste } from '../_shared/pushCrm.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' })

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return resposta(401, { erro: 'Faça login novamente.' })
  const admin = clienteAdmin()
  const { data: quem, error } = await admin.auth.getUser(token)
  if (error || !quem.user) return resposta(401, { erro: 'Sessão expirada. Faça login novamente.' })

  const pedido = (await req.json().catch(() => ({}))) as { acao?: string }
  switch (pedido.acao) {
    case 'chave': {
      const chaves = chavesVapid()
      if (!chaves) {
        return resposta(503, {
          erro: 'As notificações ainda não foram configuradas no servidor (chaves VAPID).',
        })
      }
      return resposta(200, { chavePublica: chaves.publica })
    }
    case 'teste':
      return resposta(200, await enviarTeste(admin, quem.user.id))
    default:
      return resposta(400, { erro: 'Ação desconhecida.' })
  }
})
