// Edge Function "documentos": manda o certificado (e as OS escolhidas) ao e-mail do
// cliente, pelo Resend, saindo do e-mail do ADM (não do financeiro).
//
// Os PDFs são montados na tela (o certificado já assinado, quando marcado) e chegam aqui
// em base64. Só Administrador e ADM, os perfis que emitem certificado, chamam.
//
// Para quem vai: o e-mail digitado na tela ou, vazio, o principal e os extras do cliente
// (ou o do contato principal). NUNCA os e-mails do financeiro: quem separou não quer
// receber nota no e-mail do certificado, nem certificado no do financeiro.
//
// Segredos do projeto (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY            a mesma chave das notas
//   EMAIL_DOCUMENTOS_DE       remetente, ex.: Eco Ambiental RS <adm@ecoambientalrs.com.br>
//   EMAIL_DOCUMENTOS_RESPOSTA (opcional) para onde vão as respostas; sem ele, o próprio remetente
//   SITE_URL (opcional)       endereço do sistema, para o logo do e-mail

import { decodeBase64 } from 'jsr:@std/encoding@1/base64'

import {
  assuntoDocumentos,
  htmlDocumentos,
  textoDocumentos,
  type DadosEmailDocumentos,
} from '../_shared/emailDocumentos.ts'
import { emailDosDocumentos, enderecosEmail } from '../_shared/enviarNota.ts'
import { clienteAdmin, CORS, nomeDaEmpresa, resposta } from '../_shared/servidor.ts'

/** O Resend aceita até 40 MB por e-mail (já em base64); fica uma folga. */
const LIMITE_BASE64 = 35 * 1024 * 1024

type Pedido = {
  acao: 'enviar'
  certificadoId: string
  /** "a@x.com; b@y.com" (vazio usa o cadastro). */
  para?: string
  /** PDF do certificado, em base64. */
  certificado: string
  os?: { id: string; pdf: string }[]
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

/** Começa com "%PDF-" (confere só o começo do base64). */
function pareceePdf(base64: string) {
  try {
    const inicio = new TextDecoder().decode(decodeBase64(base64.slice(0, 12)))
    return inicio.startsWith('%PDF-')
  } catch {
    return false
  }
}

const seguroNoNome = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' })

  const admin = clienteAdmin()

  // Quem chama? Administrador ou ADM ativo.
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
  if (!perfil?.ativo || !['admin', 'administrativo'].includes(perfil.papel)) {
    return resposta(403, { erro: 'Somente quem emite certificados pode enviá-los.' })
  }

  let pedido: Pedido
  try {
    pedido = await req.json()
  } catch {
    return resposta(400, { erro: 'Pedido inválido (os PDFs podem ser grandes demais).' })
  }
  if (
    pedido.acao !== 'enviar' ||
    typeof pedido.certificadoId !== 'string' ||
    typeof pedido.certificado !== 'string'
  )
    return resposta(400, { erro: 'Pedido inválido.' })
  const ordensPedidas = Array.isArray(pedido.os) ? pedido.os : []
  if (ordensPedidas.some((o) => typeof o?.id !== 'string' || typeof o?.pdf !== 'string'))
    return resposta(400, { erro: 'Pedido inválido.' })

  const { data: cert } = await admin
    .from('certificados')
    .select(
      'id, numero, cliente_id, titulo, data_execucao, validade, cancelado_em, cliente:clientes(nome, nome_fantasia), tipo:tipos_servico(nome), endereco:enderecos(apelido, logradouro, numero, cidade, uf)',
    )
    .eq('id', pedido.certificadoId)
    .single()
  if (!cert) return resposta(404, { erro: 'Certificado não encontrado.' })
  if (cert.cancelado_em) return resposta(400, { erro: 'Certificado cancelado não é enviado.' })

  async function falhar(motivo: string, status = 400) {
    await admin.from('certificados').update({ erro_envio: motivo }).eq('id', cert!.id)
    return resposta(status, { erro: motivo })
  }

  // As OS precisam ser do mesmo cliente do certificado.
  const idsOs = [...new Set(ordensPedidas.map((o) => o.id))]
  let ordens: { id: string; numero: string }[] = []
  if (idsOs.length) {
    const { data } = await admin
      .from('ordens_servico')
      .select('id, numero, cliente_id')
      .in('id', idsOs)
    if ((data ?? []).length !== idsOs.length || data!.some((o) => o.cliente_id !== cert.cliente_id))
      return resposta(400, { erro: 'Só dá para juntar OS do mesmo cliente do certificado.' })
    ordens = data!
  }

  const tamanho = pedido.certificado.length + ordensPedidas.reduce((t, o) => t + o.pdf.length, 0)
  if (tamanho > LIMITE_BASE64)
    return falhar('Os PDFs passam do tamanho que o e-mail aceita. Mande menos OS de cada vez.')
  if (!pareceePdf(pedido.certificado) || ordensPedidas.some((o) => !pareceePdf(o.pdf)))
    return resposta(400, { erro: 'Arquivo inválido: só PDF.' })

  let para = enderecosEmail(pedido.para)
  if (para.length === 0) para = await emailDosDocumentos(admin, cert.cliente_id)
  if (para.length === 0) return falhar('Cliente sem e-mail cadastrado: envie à mão.')

  const chave = segredo('RESEND_API_KEY')
  const de = segredo('EMAIL_DOCUMENTOS_DE')
  if (!chave || !de) return falhar('O e-mail do ADM para envio ainda não foi configurado.')

  const cliente = cert.cliente as unknown as { nome: string; nome_fantasia: string | null } | null
  const tipo = cert.tipo as unknown as { nome: string } | null
  const end = cert.endereco as unknown as {
    apelido: string | null
    logradouro: string
    numero: string | null
    cidade: string
    uf: string
  } | null
  const numeroDa = (id: string) => ordens.find((o) => o.id === id)?.numero ?? id.slice(0, 8)
  const numerosOs = ordensPedidas.map((o) => numeroDa(o.id))

  const dados: DadosEmailDocumentos = {
    site: (segredo('SITE_URL') || req.headers.get('origin') || '').replace(/\/+$/, ''),
    empresa: nomeDaEmpresa(),
    cliente: cliente?.nome_fantasia || cliente?.nome || '',
    certificado: cert.numero,
    servico: tipo?.nome || cert.titulo || 'Serviço',
    dataServico: cert.data_execucao,
    validade: cert.validade,
    local: end
      ? end.apelido || `${end.logradouro}, ${end.numero ?? 's/n'} · ${end.cidade}/${end.uf}`
      : null,
    ordens: numerosOs,
  }

  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: de,
      to: para,
      reply_to: segredo('EMAIL_DOCUMENTOS_RESPOSTA') || undefined,
      subject: assuntoDocumentos(dados),
      html: htmlDocumentos(dados),
      text: textoDocumentos(dados),
      attachments: [
        { filename: `Certificado ${seguroNoNome(cert.numero)}.pdf`, content: pedido.certificado },
        ...ordensPedidas.map((o) => ({
          filename: `Ordem de Serviço ${seguroNoNome(numeroDa(o.id))}.pdf`,
          content: o.pdf,
        })),
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
    return falhar(
      `O envio do e-mail falhou (${envio.status}${explicacao ? `: ${explicacao}` : ''}). ` +
        'Tente de novo ou envie à mão.',
    )
  }

  await admin
    .from('certificados')
    .update({
      enviado_em: new Date().toISOString(),
      enviado_para: para.join(', '),
      enviado_por: quem.user.id,
      enviado_com_os: numerosOs.join(', ') || null,
      erro_envio: null,
    })
    .eq('id', cert.id)
  return resposta(200, { ok: true, para, os: numerosOs })
})
