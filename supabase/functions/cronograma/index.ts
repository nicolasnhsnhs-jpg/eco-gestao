// Edge Function "cronograma": avisa os clientes de uma rota das datas do controle de
// pragas do mês (Serviços > Cronograma), por e-mail, pelo Resend.
//
// - Um e-mail para cada cliente (CNPJ), com as datas de cada unidade dele na rota.
// - Sai do SAC da unidade, com o SAC em cópia oculta; a resposta do cliente vai para o SAC.
// - Vai para o e-mail principal do cliente (o do cadastro; sem ele, o do contato
//   principal). O e-mail do financeiro nunca é usado. Sem nenhum, a unidade fica
//   "pendente de envio" para o SAC avisar por outro meio.
// - Cada envio entra em "E-mails enviados" (Administrativo) e fica marcado na unidade
//   (quando, para quem e quais datas), para a tela mostrar o que mudou depois.
//
// Quem pode: o escritório (quem enxerga o cronograma pela regra do banco).
//
// Segredos do projeto (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY       a mesma chave das notas
//   EMAIL_CRONOGRAMA     (opcional) e-mail do SAC; sem ele, usa o da unidade (só RS por ora)
//   SITE_URL (opcional)  endereço do sistema, para o logo do e-mail

import { createClient } from 'npm:@supabase/supabase-js@2'

import {
  assuntoCronograma,
  documentoFormatado,
  htmlCronograma,
  nomeDoMes,
  textoCronograma,
  type UnidadeCronograma,
} from '../_shared/emailCronograma.ts'
import { enderecosEmail } from '../_shared/enviarNota.ts'
import { registrarEmailEnviado } from '../_shared/registrarEmail.ts'
import { clienteAdmin, CORS, nomeDaEmpresa, resposta } from '../_shared/servidor.ts'

/**
 * SAC de cada unidade (projeto do Supabase). SC ainda não foi configurada: fica sem,
 * e a tela avisa. (Lembrete: definir o e-mail do SAC de SC.)
 */
const SAC_DO_PROJETO: Record<string, string> = {
  pauwepzrvlpdhjqeafkr: 'sac@ecoambientalrs.com.br',
}

/** O Resend aceita 2 pedidos por segundo: uma folga entre um e-mail e outro. */
const PAUSA_MS = 600

type Pedido = {
  acao: 'enviar'
  cronogramaId: string
  /** Unidades a avisar (as escolhidas na prévia). */
  itemIds: string[]
}

type Item = {
  id: string
  cliente_id: string
  ordem: number
  datas: string[] | null
  so_visita: number | null
  incluido: boolean
  horario: string | null
  observacoes: string | null
  cliente: {
    nome: string
    nome_fantasia: string | null
    cpf_cnpj: string | null
    email: string | null
  } | null
  endereco: {
    apelido: string | null
    logradouro: string
    numero: string | null
    bairro: string | null
    cidade: string
    uf: string
  } | null
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

const nomeNoRemetente = (s: string) => s.replace(/["<>\\\r\n]+/g, ' ').trim()
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

function emailDoSac(): string | null {
  const projeto = /https:\/\/([a-z0-9]+)\./.exec(Deno.env.get('SUPABASE_URL') ?? '')?.[1] ?? ''
  return enderecosEmail(segredo('EMAIL_CRONOGRAMA') ?? SAC_DO_PROJETO[projeto])[0] ?? null
}

/** Os dias da unidade: os próprios; senão os da rota (ou só a Nª visita dela). */
function datasDaUnidade(i: Item, daRota: string[]): string[] {
  if (i.datas) return [...i.datas].sort()
  const rota = [...daRota].sort()
  if (i.so_visita) return rota[i.so_visita - 1] ? [rota[i.so_visita - 1]] : []
  return rota
}

function localDaUnidade(e: Item['endereco']): string {
  if (!e) return 'Endereço principal'
  const rua = `${e.logradouro}, ${e.numero || 's/n'}`
  const partes = [rua, e.bairro, `${e.cidade}/${e.uf}`].filter(Boolean).join(' – ')
  return e.apelido?.trim() ? `${e.apelido.trim()} – ${partes}` : partes
}

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
    return resposta(400, { erro: 'Pedido inválido.' })
  }
  if (
    pedido?.acao !== 'enviar' ||
    typeof pedido.cronogramaId !== 'string' ||
    !Array.isArray(pedido.itemIds) ||
    pedido.itemIds.some((i) => typeof i !== 'string')
  )
    return resposta(400, { erro: 'Pedido inválido.' })
  if (pedido.itemIds.length === 0) return resposta(400, { erro: 'Escolha ao menos um cliente.' })
  if (pedido.itemIds.length > 500) return resposta(400, { erro: 'Clientes demais de uma vez.' })

  const sac = emailDoSac()
  if (!sac)
    return resposta(400, {
      erro: 'O envio do cronograma ainda não foi configurado nesta unidade (falta o e-mail do SAC).',
    })
  const chave = segredo('RESEND_API_KEY')
  if (!chave) return resposta(500, { erro: 'O envio de e-mail ainda não foi configurado.' })

  // Quem chama enxerga este cronograma? (a regra do banco, com o login dele)
  const chavePublica = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const comoQuemChama = createClient(Deno.env.get('SUPABASE_URL')!, chavePublica, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: autorizacao } },
  })
  const { data: visivel } = await comoQuemChama
    .from('cronograma_rotas')
    .select('id')
    .eq('id', pedido.cronogramaId)
    .maybeSingle()
  if (!visivel) return resposta(403, { erro: 'Cronograma não encontrado ou sem permissão.' })

  const { data: crono } = await admin
    .from('cronograma_rotas')
    .select('id, mes, datas, horario, rota:os_rotas(nome)')
    .eq('id', pedido.cronogramaId)
    .single()
  if (!crono) return resposta(404, { erro: 'Cronograma não encontrado.' })
  const cronograma = crono as unknown as {
    id: string
    mes: string
    datas: string[]
    horario: string | null
    rota: { nome: string } | null
  }

  const { data: lidos, error: erroItens } = await admin
    .from('cronograma_itens')
    .select(
      'id, cliente_id, ordem, datas, so_visita, incluido, horario, observacoes, cliente:clientes(nome, nome_fantasia, cpf_cnpj, email), endereco:enderecos(apelido, logradouro, numero, bairro, cidade, uf)',
    )
    .eq('cronograma_id', cronograma.id)
    .in('id', pedido.itemIds)
  if (erroItens) return resposta(500, { erro: 'Não foi possível ler as unidades da rota.' })
  const itens = ((lidos ?? []) as unknown as Item[])
    .filter((i) => i.incluido)
    .sort((a, b) => a.ordem - b.ordem)

  // Um e-mail por cliente (CNPJ), na ordem da rota.
  const porCliente = new Map<string, Item[]>()
  for (const i of itens) porCliente.set(i.cliente_id, [...(porCliente.get(i.cliente_id) ?? []), i])

  const empresa = nomeDaEmpresa()
  const site = (segredo('SITE_URL') || req.headers.get('origin') || '').replace(/\/+$/, '')
  const remetente = `"${nomeNoRemetente(`SAC - ${empresa}`)}" <${sac}>`
  const mes = nomeDoMes(cronograma.mes)

  const enviados: { cliente: string; para: string[] }[] = []
  const semEmail: string[] = []
  const falhas: { cliente: string; erro: string }[] = []
  let primeiro = true

  for (const [clienteId, unidades] of porCliente) {
    const c = unidades[0].cliente
    const nomeCliente = c?.nome_fantasia || c?.nome || 'Cliente'
    const datasDe = (i: Item) => datasDaUnidade(i, cronograma.datas)
    const horarioDe = (i: Item) => i.horario?.trim() || cronograma.horario?.trim() || null

    const comDatas = unidades.filter((i) => datasDe(i).length > 0)
    if (comDatas.length === 0) {
      falhas.push({ cliente: nomeCliente, erro: 'sem datas no mês' })
      continue
    }

    // E-mail principal do cadastro; sem ele, o do contato principal. Nunca o do financeiro.
    let para = enderecosEmail(c?.email)
    if (para.length === 0) {
      const { data: contatos } = await admin
        .from('contatos_cliente')
        .select('email')
        .eq('cliente_id', clienteId)
        .not('email', 'is', null)
        .order('principal', { ascending: false })
        .order('criado_em')
        .limit(1)
      para = enderecosEmail(contatos?.[0]?.email)
    }
    if (para.length === 0) {
      semEmail.push(nomeCliente)
      await admin
        .from('cronograma_itens')
        .update({ sem_email_em: new Date().toISOString() })
        .in(
          'id',
          comDatas.map((i) => i.id),
        )
      continue
    }

    const dados = {
      site,
      empresa,
      cliente: nomeCliente,
      mes,
      emailSac: sac,
      unidades: comDatas.map((i): UnidadeCronograma => ({
        local: localDaUnidade(i.endereco),
        cnpj: documentoFormatado(c?.cpf_cnpj ?? null),
        datas: datasDe(i),
        horario: horarioDe(i),
        observacoes: i.observacoes,
      })),
    }
    const copia = [sac].filter((e) => !para.includes(e))
    const assunto = assuntoCronograma(dados)

    if (!primeiro) await esperar(PAUSA_MS)
    primeiro = false
    const corpo = JSON.stringify({
      from: remetente,
      to: para,
      bcc: copia.length ? copia : undefined,
      reply_to: sac,
      subject: assunto,
      html: htmlCronograma(dados),
      text: textoCronograma(dados),
    })
    const mandar = () =>
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
        body: corpo,
      })
    let envio = await mandar()
    if (envio.status === 429) {
      await esperar(1500)
      envio = await mandar()
    }
    if (!envio.ok) {
      const detalhe = await envio.text().catch(() => '')
      console.error('Resend', envio.status, detalhe)
      let explicacao = ''
      try {
        explicacao = String(JSON.parse(detalhe).message ?? '')
      } catch {
        explicacao = detalhe.slice(0, 200)
      }
      falhas.push({
        cliente: nomeCliente,
        erro: `o envio falhou (${envio.status}${explicacao ? `: ${explicacao}` : ''})`,
      })
      continue
    }

    const emailId = await registrarEmailEnviado(admin, {
      setor: 'administrativo',
      tipo: 'cronograma',
      clienteId,
      clienteNome: nomeCliente,
      para,
      copiaOculta: copia,
      remetente,
      assunto,
      descricao: `Cronograma ${mes} · ${cronograma.rota?.nome ?? 'rota'}`,
      anexos: [],
      enviadoPor: quem.user.id,
      respostaResend: await envio.json().catch(() => null),
    })

    const agora = new Date().toISOString()
    for (const i of comDatas) {
      await admin
        .from('cronograma_itens')
        .update({
          enviado_em: agora,
          enviado_para: para.join('; '),
          datas_enviadas: datasDe(i),
          horario_enviado: horarioDe(i),
          email_id: emailId,
          sem_email_em: null,
        })
        .eq('id', i.id)
    }
    enviados.push({ cliente: nomeCliente, para })
  }

  return resposta(200, { ok: true, de: sac, enviados, semEmail, falhas })
})
