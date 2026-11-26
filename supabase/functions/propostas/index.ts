// Edge Function "propostas": manda a proposta comercial (PDF) ao cliente por e-mail, pelo
// Resend, saindo do e-mail do VENDEDOR da proposta (o cadastrado no usuário dele), com
// ele mesmo em cópia oculta, como o ADM no certificado e o financeiro nas notas.
//
// O PDF é montado na tela e chega aqui em base64, junto com o início do texto do e-mail,
// que quem envia pode mudar (proposta nova, certificado vencendo…).
//
// Quem pode: quem enxerga a proposta (a mesma regra da tela: admin, ou o vendedor dela /
// do cliente). A conferência é feita com o login de quem chama, pela regra do banco.
//
// O e-mail do vendedor precisa ser do domínio verificado no Resend (o mesmo do adm@);
// um e-mail pessoal (gmail etc.) é recusado pelo Resend e a tela explica.
//
// Segredos do projeto (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY          a mesma chave das notas
//   EMAIL_PROPOSTAS_COPIA   (opcional) mais alguém em cópia oculta de toda proposta
//   SITE_URL (opcional)     endereço do sistema, para o logo do e-mail

import { createClient } from 'npm:@supabase/supabase-js@2'
import { decodeBase64 } from 'jsr:@std/encoding@1/base64'

import { assuntoProposta, htmlProposta, textoProposta } from '../_shared/emailProposta.ts'
import { emailDosDocumentos, enderecosEmail } from '../_shared/enviarNota.ts'
import { registrarEmailEnviado } from '../_shared/registrarEmail.ts'
import { clienteAdmin, CORS, nomeDaEmpresa, resposta } from '../_shared/servidor.ts'

/** O Resend aceita até 40 MB por e-mail (já em base64); fica uma folga. */
const LIMITE_BASE64 = 35 * 1024 * 1024

type Pedido = {
  acao: 'enviar'
  propostaId: string
  /** "a@x.com; b@y.com" (vazio usa o A/C da proposta ou o cadastro do cliente). */
  para?: string
  /** Início do texto do e-mail, escrito na tela. */
  mensagem: string
  /** Nome depois do "Olá," (corrigido na tela, ex.: "Sr. Paulo"); sem ele, usa o A/C. */
  saudacao?: string
  /** PDF da proposta, em base64. */
  pdf: string
}

function segredo(nome: string): string | undefined {
  return (
    Deno.env
      .get(nome)
      ?.trim()
      .replace(/^(['"])(.*)\1$/, '$2')
      .trim() || undefined
  )
}

function pareceePdf(base64: string) {
  try {
    return new TextDecoder().decode(decodeBase64(base64.slice(0, 12))).startsWith('%PDF-')
  } catch {
    return false
  }
}

const seguroNoNome = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim()
/** Nome no "De:" sem caracteres que quebram o cabeçalho. */
const nomeNoRemetente = (s: string) => s.replace(/["<>\\\r\n]+/g, ' ').trim()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' })

  const admin = clienteAdmin()
  const autorizacao = req.headers.get('Authorization') ?? ''
  const token = autorizacao.replace(/^Bearer\s+/i, '')
  if (!token) return resposta(401, { erro: 'Faça login novamente.' })
  const { data: quem, error: erroToken } = await admin.auth.getUser(token)
  if (erroToken || !quem.user)
    return resposta(401, { erro: 'Sessão expirada. Faça login novamente.' })

  let pedido: Pedido
  try {
    pedido = await req.json()
  } catch {
    return resposta(400, { erro: 'Pedido inválido (o PDF pode ser grande demais).' })
  }
  if (
    pedido?.acao !== 'enviar' ||
    typeof pedido.propostaId !== 'string' ||
    typeof pedido.pdf !== 'string' ||
    typeof pedido.mensagem !== 'string'
  )
    return resposta(400, { erro: 'Pedido inválido.' })
  const mensagem = pedido.mensagem.trim()
  if (mensagem.length < 5) return resposta(400, { erro: 'Escreva o texto do e-mail.' })
  if (mensagem.length > 4000) return resposta(400, { erro: 'O texto do e-mail está longo demais.' })
  if (pedido.pdf.length > LIMITE_BASE64)
    return resposta(400, { erro: 'O PDF passa do tamanho que o e-mail aceita.' })
  if (!pareceePdf(pedido.pdf)) return resposta(400, { erro: 'Arquivo inválido: só PDF.' })

  // Quem chama enxerga esta proposta? (a regra do banco, com o login dele)
  const chavePublica = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const comoQuemChama = createClient(Deno.env.get('SUPABASE_URL')!, chavePublica, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: autorizacao } },
  })
  const { data: visivel } = await comoQuemChama
    .from('propostas')
    .select('id')
    .eq('id', pedido.propostaId)
    .maybeSingle()
  if (!visivel) return resposta(403, { erro: 'Proposta não encontrada ou sem permissão.' })

  const { data: p } = await admin
    .from('propostas')
    .select(
      'id, numero, cliente_id, validade, valor_total, contato_nome, contato_email, vendedor:perfis!propostas_vendedor_id_fkey(nome, email, telefone, ativo), cliente:clientes(nome, nome_fantasia), endereco:enderecos(apelido, logradouro, numero, cidade, uf), itens:proposta_itens(titulo, descricao, ordem)',
    )
    .eq('id', pedido.propostaId)
    .single()
  if (!p) return resposta(404, { erro: 'Proposta não encontrada.' })
  const proposta = p as unknown as {
    id: string
    numero: string
    cliente_id: string
    validade: string | null
    valor_total: number
    contato_nome: string | null
    contato_email: string | null
    vendedor: { nome: string; email: string; telefone: string | null; ativo: boolean } | null
    cliente: { nome: string; nome_fantasia: string | null } | null
    endereco: {
      apelido: string | null
      logradouro: string
      numero: string | null
      cidade: string
      uf: string
    } | null
    itens: { titulo: string | null; descricao: string; ordem: number }[]
  }

  const vendedor = proposta.vendedor
  const emailVendedor = enderecosEmail(vendedor?.email)[0]
  if (!vendedor || !emailVendedor)
    return resposta(400, { erro: 'O vendedor desta proposta está sem e-mail cadastrado.' })

  let para = enderecosEmail(pedido.para)
  if (para.length === 0) para = enderecosEmail(proposta.contato_email)
  if (para.length === 0) para = await emailDosDocumentos(admin, proposta.cliente_id)
  if (para.length === 0) return resposta(400, { erro: 'Cliente sem e-mail: digite o e-mail.' })

  const chave = segredo('RESEND_API_KEY')
  if (!chave) return resposta(500, { erro: 'O envio de e-mail ainda não foi configurado.' })

  const empresa = nomeDaEmpresa()
  const end = proposta.endereco
  const dados = {
    site: (segredo('SITE_URL') || req.headers.get('origin') || '').replace(/\/+$/, ''),
    empresa,
    cliente:
      (typeof pedido.saudacao === 'string' ? pedido.saudacao.trim().slice(0, 120) : '') ||
      proposta.contato_nome?.trim() ||
      proposta.cliente?.nome_fantasia ||
      proposta.cliente?.nome ||
      '',
    numero: proposta.numero,
    servicos: [...proposta.itens]
      .sort((a, b) => a.ordem - b.ordem)
      .map((i) => (i.titulo || i.descricao).trim())
      .filter((s, i, todos) => s && todos.indexOf(s) === i),
    validade: proposta.validade,
    local: end
      ? end.apelido || `${end.logradouro}, ${end.numero ?? 's/n'} · ${end.cidade}/${end.uf}`
      : null,
    mensagem,
    vendedor: { nome: vendedor.nome, telefone: vendedor.telefone, email: emailVendedor },
  }

  // Cópia oculta para o próprio vendedor (e quem estiver no segredo). Quem já está no
  // "Para" não recebe duas vezes.
  const copia = [
    ...new Set([emailVendedor, ...enderecosEmail(segredo('EMAIL_PROPOSTAS_COPIA'))]),
  ].filter((e) => !para.includes(e))

  const nomeCliente = proposta.cliente?.nome_fantasia || proposta.cliente?.nome || 'cliente'
  const nomeAnexo = `Proposta ${seguroNoNome(proposta.numero)} - ${seguroNoNome(nomeCliente)}.pdf`
  const assunto = assuntoProposta(dados)
  const remetente = `"${nomeNoRemetente(`${vendedor.nome} - ${empresa}`)}" <${emailVendedor}>`
  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: remetente,
      to: para,
      bcc: copia.length ? copia : undefined,
      reply_to: emailVendedor,
      subject: assunto,
      html: htmlProposta(dados),
      text: textoProposta(dados),
      attachments: [
        {
          filename: nomeAnexo,
          content: pedido.pdf,
        },
      ],
    }),
  })
  if (!envio.ok) {
    const detalhe = await envio.text().catch(() => '')
    console.error('Resend', envio.status, detalhe)
    let explicacao = ''
    try {
      explicacao = String(JSON.parse(detalhe).message ?? '')
    } catch {
      explicacao = detalhe.slice(0, 200)
    }
    if (/domain/i.test(explicacao) && /verif/i.test(explicacao))
      return resposta(400, {
        erro:
          `O e-mail do vendedor (${emailVendedor}) não é de um domínio liberado para envio. ` +
          'Cadastre no usuário dele o e-mail da empresa ou peça para liberar o domínio no Resend.',
      })
    return resposta(502, {
      erro: `O envio do e-mail falhou (${envio.status}${explicacao ? `: ${explicacao}` : ''}). Tente de novo.`,
    })
  }

  await registrarEmailEnviado(admin, {
    setor: 'comercial',
    tipo: 'proposta',
    clienteId: proposta.cliente_id,
    clienteNome: proposta.cliente?.nome_fantasia || proposta.cliente?.nome || '',
    para,
    copiaOculta: copia,
    remetente,
    assunto,
    descricao: `Proposta ${proposta.numero}`,
    valor: Number(proposta.valor_total),
    anexos: [nomeAnexo],
    propostaId: proposta.id,
    enviadoPor: quem.user.id,
    respostaResend: await envio.json().catch(() => null),
  })
  return resposta(200, { ok: true, para, de: emailVendedor, copia })
})
