// Edge Function "boleto": registra o boleto da nota fiscal no Sicredi (API de Cobrança) ou
// no Asaas. Só Admin e Financeiro chamam.
//
//   testar     confere as credenciais de cada banco ligado (ou em testes)
//   ensaiar    registra um boleto de teste no sandbox do banco (nada vale, a nota não muda)
//   gerar      registra de verdade, guarda o PDF e liga à nota (vai no e-mail da nota)
//   consultar  atualiza a situação do boleto (aguardando, pago, vencido…)
//   baixar     cancela o boleto no banco e o tira da nota
//
// A configuração fica em configuracoes (boleto_*); os segredos, em _shared/sicredi.ts e
// _shared/asaas.ts.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

import {
  ambienteDoBanco,
  configuracaoBoleto,
  contaDoBanco,
  ehFalhaDeBoleto,
  ensaiarBoletoDaNota,
  FalhaBoleto,
  gerarBoletoDaNota,
  NOME_BANCO,
  type Banco,
} from '../_shared/boletoNota.ts'
import { boletoPago } from '../_shared/pedidoBoleto.ts'
import { FalhaSicredi } from '../_shared/sicredi.ts'
import { clienteAdmin, conferirFinanceiro, CORS, resposta } from '../_shared/servidor.ts'

type Pedido =
  | { acao: 'testar' }
  | { acao: 'ensaiar'; notaId: string; banco: Banco }
  | { acao: 'gerar'; notaId: string; banco?: Banco }
  | { acao: 'consultar'; notaId: string }
  | { acao: 'baixar'; notaId: string }

const BANCOS: Banco[] = ['asaas', 'sicredi']

const bancoValido = (b: unknown): b is Banco => b === 'asaas' || b === 'sicredi'

/** Cada banco que não está desligado; o Sicredi desligado é testado no sandbox. */
async function testar(admin: SupabaseClient) {
  const cfg = await configuracaoBoleto(admin)
  const resultados = []
  for (const banco of BANCOS) {
    const ambiente = ambienteDoBanco(cfg, banco)
    if (banco === 'asaas' && ambiente === 'desligado') continue
    const testado = ambiente === 'producao' ? 'producao' : 'sandbox'
    let conexao: string
    let detalhe: Record<string, unknown> | undefined
    try {
      await contaDoBanco(cfg, banco, testado).autenticar()
      conexao = 'ok'
    } catch (e) {
      conexao = (e as Error).message
      if (e instanceof FalhaSicredi) detalhe = e.detalhe
    }
    resultados.push({ banco, ambiente, testado, conexao, detalhe })
  }
  return { resultados }
}

async function boletoDaNota(admin: SupabaseClient, notaId: string) {
  const { data: nota } = await admin
    .from('notas_fiscais')
    .select('id, boleto_banco, boleto_cobranca_id, boleto_situacao, arquivo_boleto_id')
    .eq('id', notaId)
    .single()
  if (!nota?.boleto_cobranca_id || !bancoValido(nota.boleto_banco))
    throw new FalhaBoleto('Esta nota não tem boleto registrado em banco.')
  const banco = nota.boleto_banco
  const cfg = await configuracaoBoleto(admin)
  if (ambienteDoBanco(cfg, banco) !== 'producao')
    throw new FalhaBoleto(`O boleto pelo ${NOME_BANCO[banco]} está desligado nas configurações.`)
  return { nota, banco, conta: contaDoBanco(cfg, banco, 'producao') }
}

async function consultar(admin: SupabaseClient, notaId: string) {
  const { nota, conta } = await boletoDaNota(admin, notaId)
  const r = await conta.consultar(nota.boleto_cobranca_id)
  await admin
    .from('notas_fiscais')
    .update({ boleto_situacao: r.situacao, boleto_consultado_em: new Date().toISOString() })
    .eq('id', notaId)
  return { ...r, pago: boletoPago(r.situacao) }
}

async function baixar(admin: SupabaseClient, notaId: string, usuarioId: string) {
  const { nota, banco, conta } = await boletoDaNota(admin, notaId)
  if (boletoPago(nota.boleto_situacao)) throw new FalhaBoleto('Este boleto já foi pago.')
  await conta.baixar(nota.boleto_cobranca_id)
  // O boleto cancelado sai da nota (o PDF continua nos arquivos do cliente e a auditoria
  // guarda o id da cobrança): a nota pode ganhar outro, pelo mesmo banco ou pelo outro.
  const { error } = await admin
    .from('notas_fiscais')
    .update({
      arquivo_boleto_id: null,
      boleto_cobranca_id: null,
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
      `O boleto foi cancelado no ${NOME_BANCO[banco]}, mas a nota não foi atualizada: ${error.message}`,
    )
  return { baixado: nota.boleto_cobranca_id, banco }
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
        if (!bancoValido(pedido.banco)) return resposta(400, { erro: 'Banco inválido.' })
        return resposta(200, await ensaiarBoletoDaNota(admin, pedido.notaId, pedido.banco))
      case 'gerar':
        if (pedido.banco !== undefined && !bancoValido(pedido.banco))
          return resposta(400, { erro: 'Banco inválido.' })
        return resposta(
          200,
          await gerarBoletoDaNota(admin, pedido.notaId, quem.usuarioId, pedido.banco),
        )
      case 'consultar':
        return resposta(200, await consultar(admin, pedido.notaId))
      case 'baixar':
        return resposta(200, await baixar(admin, pedido.notaId, quem.usuarioId))
      default:
        return resposta(400, { erro: 'Ação desconhecida.' })
    }
  } catch (e) {
    const falha = ehFalhaDeBoleto(e)
    if (!falha) console.error(e)
    return resposta(falha ? 400 : 500, { erro: (e as Error).message })
  }
})
