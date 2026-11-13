// Edge Function "notas": manda o PDF da nota fiscal ao e-mail do cliente (botão Enviar).
// Só Admin e Financeiro chamam. A regra do envio está em ../_shared/enviarNota.ts.

import { enviarNotaPorEmail } from '../_shared/enviarNota.ts'
import { clienteAdmin, conferirFinanceiro, CORS, resposta } from '../_shared/servidor.ts'

type Pedido = { acao: 'enviar'; notaId: string; para?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' })

  const admin = clienteAdmin()
  const quem = await conferirFinanceiro(req, admin)
  if (quem instanceof Response) return quem

  let pedido: Pedido
  try {
    pedido = await req.json()
  } catch {
    return resposta(400, { erro: 'Pedido inválido.' })
  }
  if (pedido.acao !== 'enviar' || !pedido.notaId)
    return resposta(400, { erro: 'Ação desconhecida.' })

  const r = await enviarNotaPorEmail(admin, pedido.notaId, {
    para: pedido.para,
    origem: req.headers.get('origin'),
  })
  if (!r.enviada) return resposta(400, { erro: r.motivo, pendente: true })
  return resposta(200, { ok: true, para: r.para, comBoleto: r.comBoleto, boletos: r.boletos })
})
