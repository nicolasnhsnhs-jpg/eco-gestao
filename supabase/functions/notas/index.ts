// Edge Function "notas": manda o PDF da nota fiscal ao e-mail do cliente, pelo Resend.
// Só Admin e Financeiro chamam. Se o cliente não tem e-mail, ou o envio falha, o erro
// fica gravado na nota e o banco cria o aviso de "envio pendente" para o financeiro.
//
// Segredos do projeto (Supabase → Edge Functions → Secrets), um conjunto por unidade:
//   RESEND_API_KEY     chave do Resend com permissão de envio no domínio da unidade
//   EMAIL_NOTAS_DE     remetente, ex.: Eco Ambiental RS <financeiro@ecoambientalrs.com.br>
//   EMAIL_NOTAS_RESPOSTA (opcional) para onde vão as respostas do cliente

import { createClient } from 'npm:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'

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

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const data = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const mes = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`
const reais = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const escapar = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

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
      '*, cliente:clientes(nome, nome_fantasia), pdf:arquivos!arquivo_pdf_id(caminho_storage, nome_original)',
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
  const cliente = nota.cliente?.nome_fantasia || nota.cliente?.nome || ''
  const assunto = `Nota fiscal ${nota.numero ?? ''} – ${mes(nota.competencia)}`.replace(/\s+/g, ' ')
  const linhas = [
    `Olá${cliente ? `, ${escapar(cliente)}` : ''}.`,
    `Segue em anexo a nota fiscal${nota.numero ? ` nº ${escapar(nota.numero)}` : ''}, referente a ${mes(nota.competencia)}, no valor de ${reais(nota.valor_servico)}${nota.vencimento ? `, com vencimento em ${data(nota.vencimento)}` : ''}.`,
    'Qualquer dúvida, é só responder este e-mail.',
    'Obrigado!',
  ]
  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: de,
      to: para,
      reply_to: Deno.env.get('EMAIL_NOTAS_RESPOSTA') || undefined,
      subject: assunto,
      html: linhas.map((l) => `<p>${l}</p>`).join(''),
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
