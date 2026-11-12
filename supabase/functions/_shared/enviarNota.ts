// Manda o PDF da nota fiscal emitida (e o boleto, se anexado) ao e-mail do cliente, pelo
// Resend. Usado pela função "notas" (botão Enviar) e pela "nfse" (logo depois de emitir).
//
// Segredos do projeto (Supabase → Edge Functions → Secrets), um conjunto por unidade:
//   RESEND_API_KEY     chave do Resend com permissão de envio no domínio da unidade
//   EMAIL_NOTAS_DE     remetente, ex.: Eco Ambiental RS <financeiro@ecoambientalrs.com.br>
//   EMAIL_NOTAS_RESPOSTA (opcional) para onde vão as respostas do cliente
//   SITE_URL (opcional) endereço do sistema, para o logo do e-mail; sem ele, vale o
//            endereço de onde o financeiro clicou
//
// Se o cliente não tem e-mail, ou o envio falha, o motivo fica em erro_envio e o banco
// cria o aviso de "envio pendente" para o financeiro.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'

import { assuntoNota, htmlNota, textoNota, type DadosEmailNota } from './emailNota.ts'
import { nomeDaEmpresa } from './servidor.ts'

const FORMAS: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  transferencia: 'Transferência',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro',
  debito_automatico: 'Débito automático',
  outro: 'Outro',
}

/** [PIS, COFINS, CSLL] retidos por tipo (tpRetPisCofins); igual a RETENCOES_PISCOFINS do app. */
const RETIDOS: Record<number, [boolean, boolean, boolean]> = {
  1: [true, true, false],
  3: [true, true, true],
  4: [true, true, false],
  5: [true, false, false],
  6: [false, true, false],
  7: [false, true, true],
  8: [false, false, true],
  9: [true, false, true],
}

/** Igual a totalRetido em src/features/financeiro/notas.ts. */
export function totalRetido(n: {
  iss_retido: boolean
  aliquota_iss: number | null
  valor_servico: number
  pis_cofins_retidos: boolean
  tp_ret_piscofins: number | null
  valor_pis: number | null
  valor_cofins: number | null
  valor_csll: number | null
  valor_irrf: number | null
  valor_inss: number | null
}): number {
  const iss = n.iss_retido
    ? Math.round(Number(n.valor_servico) * Number(n.aliquota_iss ?? 0)) / 100
    : 0
  const tipo =
    n.tp_ret_piscofins ?? (n.pis_cofins_retidos ? (Number(n.valor_csll ?? 0) > 0 ? 3 : 1) : 0)
  const [pis, cofins, csll] = RETIDOS[tipo] ?? []
  const federais =
    (pis ? Number(n.valor_pis ?? 0) : 0) +
    (cofins ? Number(n.valor_cofins ?? 0) : 0) +
    (csll ? Number(n.valor_csll ?? 0) : 0)
  const total = iss + federais + Number(n.valor_irrf ?? 0) + Number(n.valor_inss ?? 0)
  return Math.round(total * 100) / 100
}

/** "a@x.com; b@y.com" → ["a@x.com", "b@y.com"] (só os que parecem e-mail). */
export function enderecosEmail(texto: string | null | undefined): string[] {
  return (texto ?? '')
    .split(/[;,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
}

/**
 * Para onde vão a nota e o boleto: os e-mails do financeiro, quando o cliente separou;
 * senão todos os e-mails do cliente (o principal e os outros) ou, sem nenhum, o do
 * contato principal (igual a privado.email_do_cliente).
 */
export async function emailDoCliente(admin: SupabaseClient, clienteId: string): Promise<string[]> {
  const { data: c } = await admin
    .from('clientes')
    .select('email, emails_extras, emails_financeiro')
    .eq('id', clienteId)
    .single()
  const financeiro = [...new Set((c?.emails_financeiro ?? []).flatMap((e) => enderecosEmail(e)))]
  if (financeiro.length) return financeiro
  return emailDosDocumentos(admin, clienteId, c)
}

/**
 * Para onde vão o certificado e a OS: o e-mail principal e os outros ou, sem nenhum, o
 * do contato principal. Nunca os e-mails do financeiro.
 */
export async function emailDosDocumentos(
  admin: SupabaseClient,
  clienteId: string,
  jaLido?: { email: string | null; emails_extras: string[] | null } | null,
): Promise<string[]> {
  const c =
    jaLido ??
    (await admin.from('clientes').select('email, emails_extras').eq('id', clienteId).single()).data
  const doCliente = [
    ...new Set([c?.email, ...(c?.emails_extras ?? [])].flatMap((e) => enderecosEmail(e))),
  ]
  if (doCliente.length) return doCliente
  const { data: contatos } = await admin
    .from('contatos_cliente')
    .select('email')
    .eq('cliente_id', clienteId)
    .not('email', 'is', null)
    .order('principal', { ascending: false })
    .order('criado_em')
    .limit(1)
  return enderecosEmail(contatos?.[0]?.email)
}

/** O segredo sem aspas nem espaços em volta (como às vezes é colado no painel). */
function segredo(nome: string): string | undefined {
  return (
    Deno.env
      .get(nome)
      ?.trim()
      .replace(/^(['"])(.*)\1$/, '$2')
      .trim() || undefined
  )
}

export type ResultadoEnvio = { enviada: true; para: string[] } | { enviada: false; motivo: string }

export async function enviarNotaPorEmail(
  admin: SupabaseClient,
  notaId: string,
  { para: paraPedido, origem }: { para?: string; origem?: string | null },
): Promise<ResultadoEnvio> {
  const { data: nota } = await admin
    .from('notas_fiscais')
    .select(
      '*, cliente:clientes(nome, nome_fantasia), contrato:contratos(descricao), pdf:arquivos!arquivo_pdf_id(caminho_storage, nome_original), boleto:arquivos!arquivo_boleto_id(caminho_storage)',
    )
    .eq('id', notaId)
    .single()
  if (!nota) return { enviada: false, motivo: 'Nota não encontrada.' }
  if (nota.status !== 'emitida') return { enviada: false, motivo: 'Só a nota emitida é enviada.' }
  if (!nota.pdf) return { enviada: false, motivo: 'Anexe o PDF da nota antes de enviar.' }

  async function falhar(motivo: string): Promise<ResultadoEnvio> {
    await admin.from('notas_fiscais').update({ erro_envio: motivo }).eq('id', notaId)
    return { enviada: false, motivo }
  }

  let para = enderecosEmail(paraPedido)
  if (para.length === 0) para = await emailDoCliente(admin, nota.cliente_id)
  if (para.length === 0) return falhar('Cliente sem e-mail cadastrado: envie à mão.')

  const chave = segredo('RESEND_API_KEY')
  const de = segredo('EMAIL_NOTAS_DE')
  if (!chave || !de) return falhar('O e-mail de envio das notas ainda não foi configurado.')

  const { data: arquivo, error: erroArquivo } = await admin.storage
    .from('arquivos')
    .download(nota.pdf.caminho_storage)
  if (erroArquivo || !arquivo) return falhar('Não foi possível abrir o PDF da nota.')
  let boleto: Blob | null = null
  if (nota.boleto) {
    const r = await admin.storage.from('arquivos').download(nota.boleto.caminho_storage)
    if (r.error || !r.data) return falhar('Não foi possível abrir o PDF do boleto.')
    boleto = r.data
  }
  const nomeNota = nota.numero ?? nota.id.slice(0, 8)

  const dados: DadosEmailNota = {
    site: (Deno.env.get('SITE_URL') || origem || '').replace(/\/+$/, ''),
    empresa: nomeDaEmpresa(),
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
    comBoleto: !!boleto,
  }
  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: de,
      to: para,
      reply_to: segredo('EMAIL_NOTAS_RESPOSTA') || undefined,
      subject: assuntoNota(dados),
      html: htmlNota(dados),
      text: textoNota(dados),
      attachments: [
        {
          filename: `NF ${nomeNota}.pdf`,
          content: encodeBase64(new Uint8Array(await arquivo.arrayBuffer())),
        },
        ...(boleto
          ? [
              {
                filename: `Boleto NF ${nomeNota}.pdf`,
                content: encodeBase64(new Uint8Array(await boleto.arrayBuffer())),
              },
            ]
          : []),
      ],
    }),
  })
  if (!envio.ok) {
    const detalhe = await envio.text().catch(() => '')
    console.error('Resend', envio.status, detalhe)
    // O Resend explica a recusa (remetente inválido, domínio não verificado…): mostra.
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
    .from('notas_fiscais')
    .update({
      enviada_em: new Date().toISOString(),
      enviada_para: para.join(', '),
      erro_envio: null,
    })
    .eq('id', notaId)
  return { enviada: true, para }
}
