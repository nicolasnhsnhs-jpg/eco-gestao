// Edge Function "notas": manda o PDF da nota fiscal ao e-mail do cliente, pelo Resend.
// Só Admin e Financeiro chamam. Se o cliente não tem e-mail, ou o envio falha, o erro
// fica gravado na nota e o banco cria o aviso de "envio pendente" para o financeiro.
//
// Segredos do projeto (Supabase → Edge Functions → Secrets), um conjunto por unidade:
//   RESEND_API_KEY     chave do Resend com permissão de envio no domínio da unidade
//   EMAIL_NOTAS_DE     remetente, ex.: Eco Ambiental RS <financeiro@ecoambientalrs.com.br>
//   EMAIL_NOTAS_RESPOSTA (opcional) para onde vão as respostas do cliente
//   SITE_URL (opcional) endereço do sistema, para o logo do e-mail; sem ele, vale o
//            endereço de onde o financeiro clicou em "Enviar"

import { createClient } from 'npm:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'

import { assuntoNota, htmlNota, textoNota, type DadosEmailNota } from './email.ts'

type Pedido = { acao: 'enviar'; notaId: string; para?: string }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function chaveSecreta(): string {
  // Projetos novos usam SUPABASE_SECRET_KEYS (JSON); os antigos, SUPABASE_SERVICE_ROLE_KEY.
  const novas = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (novas) {
    const chaves = JSON.parse(novas) as Record<string, string>
    if (chaves.default) return chaves.default
  }
  const antiga = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!antiga) throw new Error('Chave secreta do Supabase não configurada.')
  return antiga
}

const FORMAS: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
  debito_automatico: 'Débito automático',
  outro: 'Outro',
}

/** Igual a totalRetido em src/features/financeiro/notas.ts. */
function totalRetido(n: {
  iss_retido: boolean
  aliquota_iss: number | null
  valor_servico: number
  pis_cofins_retidos: boolean
  valor_pis: number | null
  valor_cofins: number | null
  valor_csll: number | null
  valor_irrf: number | null
  valor_inss: number | null
}): number {
  const iss = n.iss_retido ? (Number(n.valor_servico) * Number(n.aliquota_iss ?? 0)) / 100 : 0
  const pisCofins = n.pis_cofins_retidos
    ? Number(n.valor_pis ?? 0) + Number(n.valor_cofins ?? 0) + Number(n.valor_csll ?? 0)
    : 0
  const total = iss + pisCofins + Number(n.valor_irrf ?? 0) + Number(n.valor_inss ?? 0)
  return Math.round(total * 100) / 100
}

/** "a@x.com; b@y.com" → ["a@x.com", "b@y.com"] (só os que parecem e-mail). */
function enderecos(texto: string | null | undefined): string[] {
  return (texto ?? '')
    .split(/[;,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Quem está chamando? Precisa ser Admin ou Financeiro, ativo.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return resposta(401, { erro: 'Faça login novamente.' })
  const { data: quem, error: erroToken } = await admin.auth.getUser(token)
  if (erroToken || !quem.user)
    return resposta(401, { erro: 'Sessão expirada. Faça login novamente.' })
  const { data: perfil } = await admin
    .from('perfis')
    .select('papel, ativo')
    .eq('id', quem.user.id)
    .single()
  if (!perfil?.ativo || !['admin', 'financeiro'].includes(perfil.papel)) {
    return resposta(403, { erro: 'Somente o financeiro envia notas fiscais.' })
  }

  let pedido: Pedido
  try {
    pedido = await req.json()
  } catch {
    return resposta(400, { erro: 'Pedido inválido.' })
  }
  if (pedido.acao !== 'enviar' || !pedido.notaId)
    return resposta(400, { erro: 'Ação desconhecida.' })

  // 2. A nota, o cliente e o PDF.
  const { data: nota } = await admin
    .from('notas_fiscais')
    .select(
      '*, cliente:clientes(nome, nome_fantasia), contrato:contratos(descricao), pdf:arquivos!arquivo_pdf_id(caminho_storage, nome_original)',
    )
    .eq('id', pedido.notaId)
    .single()
  if (!nota) return resposta(404, { erro: 'Nota não encontrada.' })
  if (nota.status !== 'emitida') return resposta(400, { erro: 'Só a nota emitida é enviada.' })
  if (!nota.pdf) return resposta(400, { erro: 'Anexe o PDF da nota antes de enviar.' })

  // Falha que o financeiro precisa resolver: fica na nota (e vira aviso).
  async function falhar(motivo: string) {
    await admin.from('notas_fiscais').update({ erro_envio: motivo }).eq('id', nota!.id)
    return resposta(400, { erro: motivo, pendente: true })
  }

  let para = enderecos(pedido.para)
  if (para.length === 0) {
    // Igual a privado.email_do_cliente: o do cliente ou, sem ele, o do contato principal.
    const { data: c } = await admin
      .from('clientes')
      .select('email')
      .eq('id', nota.cliente_id)
      .single()
    para = enderecos(c?.email)
    if (para.length === 0) {
      const { data: contatos } = await admin
        .from('contatos_cliente')
        .select('email')
        .eq('cliente_id', nota.cliente_id)
        .not('email', 'is', null)
        .order('principal', { ascending: false })
        .order('criado_em')
        .limit(1)
      para = enderecos(contatos?.[0]?.email)
    }
  }
  if (para.length === 0) return falhar('Cliente sem e-mail cadastrado: envie à mão.')

  const chave = Deno.env.get('RESEND_API_KEY')
  const de = Deno.env.get('EMAIL_NOTAS_DE')
  if (!chave || !de) return falhar('O e-mail de envio das notas ainda não foi configurado.')

  const { data: arquivo, error: erroArquivo } = await admin.storage
    .from('arquivos')
    .download(nota.pdf.caminho_storage)
  if (erroArquivo || !arquivo) return falhar('Não foi possível abrir o PDF da nota.')

  // 3. O e-mail.
  const dados: DadosEmailNota = {
    site: (Deno.env.get('SITE_URL') || req.headers.get('origin') || '').replace(/\/+$/, ''),
    empresa: de.split('<')[0].replace(/"/g, '').trim() || 'Eco Ambiental',
    cliente: nota.cliente?.nome_fantasia || nota.cliente?.nome || '',
    numero: nota.numero,
    competencia: nota.competencia,
    // A descrição curta do contrato; na avulsa, o começo da descrição da nota.
    servico:
      nota.contrato?.descricao ||
      (nota.descricao.length > 120 ? `${nota.descricao.slice(0, 117)}…` : nota.descricao),
    valor: Number(nota.valor_servico),
    retido: totalRetido(nota),
    vencimento: nota.vencimento,
    formaPagamento: nota.forma_pagamento ? (FORMAS[nota.forma_pagamento] ?? null) : null,
  }
  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: de,
      to: para,
      reply_to: Deno.env.get('EMAIL_NOTAS_RESPOSTA') || undefined,
      subject: assuntoNota(dados),
      html: htmlNota(dados),
      text: textoNota(dados),
      attachments: [
        {
          filename: `NF ${nota.numero ?? nota.id.slice(0, 8)}.pdf`,
          content: encodeBase64(new Uint8Array(await arquivo.arrayBuffer())),
        },
      ],
    }),
  })
  if (!envio.ok) {
    const detalhe = await envio.text().catch(() => '')
    console.error('Resend', envio.status, detalhe)
    return falhar(`O envio do e-mail falhou (${envio.status}). Tente de novo ou envie à mão.`)
  }

  await admin
    .from('notas_fiscais')
    .update({
      enviada_em: new Date().toISOString(),
      enviada_para: para.join(', '),
      erro_envio: null,
    })
    .eq('id', nota.id)
  return resposta(200, { ok: true, para })
})
