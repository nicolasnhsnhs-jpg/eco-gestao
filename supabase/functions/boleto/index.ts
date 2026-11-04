// Edge Function "boleto": registra o boleto da nota fiscal na API de Cobrança do Sicredi.
// Só Admin e Financeiro chamam.
//
//   testar     confere as credenciais (autentica no ambiente ligado)
//   ensaiar    registra um boleto de teste no sandbox do Sicredi (nada vale, a nota não muda)
//   gerar      registra de verdade, guarda o PDF e liga à nota (vai no e-mail da nota)
//   consultar  atualiza a situação do boleto (em carteira, pago, baixado…)
//   baixar     pede a baixa no Sicredi (o boleto deixa de valer) e o tira da nota
//
// A configuração fica em configuracoes (boleto_*); os segredos, em _shared/sicredi.ts.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

import {
  configuracaoBoleto,
  ensaiarBoletoDaNota,
  gerarBoletoDaNota,
  sicrediDaConfiguracao,
} from '../_shared/boletoNota.ts'
import { boletoPago } from '../_shared/pedidoBoleto.ts'
import { clienteAdmin, conferirFinanceiro, CORS, resposta } from '../_shared/servidor.ts'
import { FalhaSicredi } from '../_shared/sicredi.ts'

type Pedido =
  | { acao: 'testar' }
  | { acao: 'ensaiar'; notaId: string }
  | { acao: 'gerar'; notaId: string }
  | { acao: 'consultar'; notaId: string }
  | { acao: 'baixar'; notaId: string }

async function testar(admin: SupabaseClient) {
  const cfg = await configuracaoBoleto(admin)
  const ambiente = cfg.boleto_ambiente === 'producao' ? 'producao' : 'sandbox'
  let conexao: string
  try {
    await sicrediDaConfiguracao(cfg, ambiente).autenticar()
    conexao = 'ok'
  } catch (e) {
    conexao = (e as Error).message
  }
  return { ambiente: cfg.boleto_ambiente || 'desligado', testado: ambiente, conexao }
}

async function boletoDaNota(admin: SupabaseClient, notaId: string) {
  const { data: nota } = await admin
    .from('notas_fiscais')
    .select('id, boleto_nosso_numero, boleto_situacao, arquivo_boleto_id')
    .eq('id', notaId)
    .single()
  if (!nota?.boleto_nosso_numero) throw new FalhaSicredi('Esta nota não tem boleto do Sicredi.')
  const cfg = await configuracaoBoleto(admin)
  if (cfg.boleto_ambiente !== 'producao')
    throw new FalhaSicredi('O boleto pelo sistema está desligado nas configurações.')
  return { nota, sicredi: sicrediDaConfiguracao(cfg, 'producao') }
}

async function consultar(admin: SupabaseClient, notaId: string) {
  const { nota, sicredi } = await boletoDaNota(admin, notaId)
  const r = await sicredi.consultar(nota.boleto_nosso_numero)
  await admin
    .from('notas_fiscais')
    .update({ boleto_situacao: r.situacao, boleto_consultado_em: new Date().toISOString() })
    .eq('id', notaId)
  return { ...r, pago: boletoPago(r.situacao) }
}

async function baixar(admin: SupabaseClient, notaId: string, usuarioId: string) {
  const { nota, sicredi } = await boletoDaNota(admin, notaId)
  if (boletoPago(nota.boleto_situacao)) throw new FalhaSicredi('Este boleto já foi pago.')
  await sicredi.baixar(nota.boleto_nosso_numero)
  // O boleto baixado sai da nota (o PDF continua nos arquivos do cliente e a auditoria
  // guarda o nosso número): a nota pode ganhar outro.
  const { error } = await admin
    .from('notas_fiscais')
    .update({
      arquivo_boleto_id: null,
      boleto_nosso_numero: null,
      boleto_linha_digitavel: null,
      boleto_codigo_barras: null,
      boleto_pix: null,
      boleto_valor: null,
      boleto_vencimento: null,
      boleto_situacao: null,
      boleto_consultado_em: null,
      boleto_gerado_em: null,
      erro_boleto: null,
      atualizado_por: usuarioId,
    })
    .eq('id', notaId)
  if (error)
    throw new Error(
      `A baixa foi pedida no Sicredi, mas a nota não foi atualizada: ${error.message}`,
    )
  return { baixado: nota.boleto_nosso_numero }
}

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

  try {
    switch (pedido.acao) {
      case 'testar':
        return resposta(200, await testar(admin))
      case 'ensaiar':
        return resposta(200, await ensaiarBoletoDaNota(admin, pedido.notaId))
      case 'gerar':
        return resposta(200, await gerarBoletoDaNota(admin, pedido.notaId, quem.usuarioId))
      case 'consultar':
        return resposta(200, await consultar(admin, pedido.notaId))
      case 'baixar':
        return resposta(200, await baixar(admin, pedido.notaId, quem.usuarioId))
      default:
        return resposta(400, { erro: 'Ação desconhecida.' })
    }
  } catch (e) {
    const falha = e instanceof FalhaSicredi
    if (!falha) console.error(e)
    return resposta(falha ? 400 : 500, { erro: (e as Error).message })
  }
})
