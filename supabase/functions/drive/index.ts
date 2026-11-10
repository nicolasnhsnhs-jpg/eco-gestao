// Edge Function "drive": cópia dos PDFs do sistema no Google Drive da unidade.
//
//   processar    (pg_cron, a cada minuto, com o cabeçalho x-drive-segredo) manda o que
//                estiver na drive_fila: nota fiscal e boleto em FINANCEIRO, PDF da OS em GERAL
//   certificado  (navegador, Administrador/ADM) recebe o PDF do certificado montado na
//                tela e manda para ADM
//   agenda       (navegador) recebe a imagem da agenda do dia e guarda em
//                ADM / AGENDA / ano / mês / dd-mm-aaaa.png
//   proposta     (navegador) recebe o PDF da proposta e guarda em
//                VENDAS / ano / vendedor / cliente / Proposta <número> - <data de envio>.pdf
//   situacao     (Administrador) confere a conta Google conectada e as pastas dos setores
//
// Caminho no Drive: <SETOR> / <ano> / <Cliente - CNPJ> / <arquivo>.pdf
// Veja docs/CONFIGURACAO-DRIVE.md.

import { decodeBase64 } from 'jsr:@std/encoding@1/base64'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

import { configuracaoDrive, Drive, nomeSeguro } from '../_shared/googleDrive.ts'
import { clienteAdmin, CORS, resposta } from '../_shared/servidor.ts'

const SETORES = ['ADM', 'GERAL', 'FINANCEIRO', 'VENDAS'] as const
type Setor = (typeof SETORES)[number]

const SETOR_DA_CATEGORIA: Record<string, Setor> = {
  nota_fiscal: 'FINANCEIRO',
  boleto: 'FINANCEIRO',
  relatorio: 'GERAL',
  certificado: 'ADM',
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const LIMITE_PDF = 15 * 1024 * 1024
/** A função tem ~150 s; para de pegar lotes novos antes disso. */
const TEMPO_MAXIMO = 100_000

type Cliente = { id: string; nome: string; cpf_cnpj: string | null }

/** "12345678000190" → "12.345.678-0001-90" (sem "/", que o Windows não aceita em pasta). */
export function documentoFormatado(doc: string | null) {
  if (!doc) return ''
  if (/^\d{11}$/.test(doc)) return doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (/^[0-9A-Z]{12}\d{2}$/.test(doc))
    return doc.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3-$4-$5')
  return doc
}

export function nomePastaCliente(c: Cliente) {
  const doc = documentoFormatado(c.cpf_cnpj)
  return nomeSeguro(doc ? `${c.nome.trim()} - ${doc}` : c.nome.trim())
}

/**
 * Id de uma pasta já achada/criada (drive_pastas); senão acha no Drive ou cria, e guarda.
 * Duas cópias ao mesmo tempo (ex.: a página manda a proposta duas vezes) podem criar a
 * mesma pasta duas vezes: quem gravar primeiro no banco vale, e a pasta do outro vai para
 * a lixeira (ainda vazia, porque o arquivo só sobe depois).
 */
async function lembrar(
  admin: SupabaseClient,
  drive: Drive,
  chave: string,
  achar: () => Promise<string | null>,
  criar?: () => Promise<string>,
) {
  const gravada = async () => {
    const { data } = await admin
      .from('drive_pastas')
      .select('pasta_id')
      .eq('chave', chave)
      .maybeSingle()
    return (data?.pasta_id as string | undefined) ?? null
  }
  const ja = await gravada()
  if (ja) return ja
  let id = await achar()
  const criada = !id
  if (!id) {
    if (!criar) throw new Error('Pasta não encontrada.')
    id = await criar()
  }
  await admin
    .from('drive_pastas')
    .upsert({ chave, pasta_id: id }, { onConflict: 'chave', ignoreDuplicates: true })
  const vale = (await gravada()) ?? id
  if (criada && vale !== id) await drive.lixeira(id).catch(() => {})
  return vale
}

async function pastaDoSetor(admin: SupabaseClient, drive: Drive, raiz: string, setor: Setor) {
  return await lembrar(admin, drive, `setor:${setor}`, async () => {
    const id = await drive.acharPasta(setor, raiz)
    if (!id)
      throw new Error(
        `A pasta ${setor} não foi encontrada no Drive (confira o nome e se está na raiz do Meu Drive).`,
      )
    return id
  })
}

/** Subpasta com este nome (cria se não houver). */
async function subpasta(
  admin: SupabaseClient,
  drive: Drive,
  chave: string,
  nome: string,
  pai: string,
) {
  return await lembrar(
    admin,
    drive,
    chave,
    () => drive.acharPasta(nome, pai),
    () => drive.criarPasta(nome, pai),
  )
}

/** Pasta do cliente dentro de `pai` (etiquetada com o id do cliente). */
async function pastaDoClienteEm(
  admin: SupabaseClient,
  drive: Drive,
  chave: string,
  pai: string,
  cliente: Cliente,
) {
  const etiqueta = { eco_cliente: cliente.id }
  return await lembrar(
    admin,
    drive,
    chave,
    async () => {
      const marcada = await drive.acharPastaEtiquetada('eco_cliente', cliente.id, pai)
      if (marcada) return marcada
      // Pasta criada à mão com o mesmo nome: passa a ser a do cliente.
      const mesmoNome = await drive.acharPasta(nomePastaCliente(cliente), pai)
      if (mesmoNome) await drive.etiquetar(mesmoNome, etiqueta)
      return mesmoNome
    },
    () => drive.criarPasta(nomePastaCliente(cliente), pai, etiqueta),
  )
}

/** Acha (ou cria) SETOR / ano / cliente, lembrando no banco o id de cada pasta. */
async function pastaDoCliente(
  admin: SupabaseClient,
  drive: Drive,
  raiz: string,
  setor: Setor,
  ano: string,
  cliente: Cliente,
) {
  const pastaSetor = await pastaDoSetor(admin, drive, raiz, setor)
  const pastaAno = await subpasta(admin, drive, `ano:${setor}:${ano}`, ano, pastaSetor)
  return await pastaDoClienteEm(
    admin,
    drive,
    `cliente:${setor}:${ano}:${cliente.id}`,
    pastaAno,
    cliente,
  )
}

async function buscarCliente(admin: SupabaseClient, id: string): Promise<Cliente> {
  const { data, error } = await admin
    .from('clientes')
    .select('id, nome, cpf_cnpj')
    .eq('id', id)
    .single()
  if (error || !data) throw new Error('Cliente não encontrado.')
  return data as Cliente
}

/** "2026-11-10" → "10-11-2026" (sem "/", que o Windows não aceita em nome de arquivo). */
export function dataNoNome(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${m}-${a}`
}

/** Data (aaaa-mm-dd) de um instante, no horário de Brasília. */
function diaEmSaoPaulo(quando: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(quando),
  )
}

class AindaNaoLigado extends Error {}

/**
 * Nome do arquivo no Drive e a data do documento (que também escolhe a pasta do ano).
 * Usa a data do PRÓPRIO documento, não a de quando o PDF foi gerado: assim, gerar o PDF
 * de novo dá o mesmo nome e troca o arquivo em vez de duplicar.
 *   Nota Fiscal 123 - 10-11-2026.pdf          (emissão)
 *   Boleto NF 123 - venc 10-12-2026.pdf       (vencimento)
 *   Ordem de Serviço OS-2026-0003 - 10-11-2026.pdf   (dia agendado)
 */
async function nomeNoDrive(
  admin: SupabaseClient,
  arquivoId: string,
  arq: { categoria: string; nome_original: string; criado_em: string; os_id: string | null },
  tentativas: number,
): Promise<{ nome: string; data: string }> {
  const generico = () => {
    const data = diaEmSaoPaulo(arq.criado_em)
    const base = arq.nome_original.replace(/\.pdf$/i, '')
    return { nome: `${base} - ${dataNoNome(data)}.pdf`, data }
  }
  if (arq.categoria === 'nota_fiscal' || arq.categoria === 'boleto') {
    const coluna = arq.categoria === 'boleto' ? 'arquivo_boleto_id' : 'arquivo_pdf_id'
    const { data: nota } = await admin
      .from('notas_fiscais')
      .select('numero, data_emissao, vencimento, boleto_vencimento')
      .eq(coluna, arquivoId)
      .maybeSingle()
    if (!nota) {
      // A nota é ligada ao PDF logo depois de guardá-lo: espera um pouco e tenta de novo.
      if (tentativas < 3) throw new AindaNaoLigado('O PDF ainda não foi ligado à nota.')
      return generico()
    }
    const numero = nota.numero ? ` ${nota.numero}` : ''
    if (arq.categoria === 'nota_fiscal') {
      return {
        nome: `Nota Fiscal${numero} - ${dataNoNome(nota.data_emissao)}.pdf`,
        data: nota.data_emissao,
      }
    }
    const vence = nota.boleto_vencimento ?? nota.vencimento
    return {
      nome: vence
        ? `Boleto NF${numero} - venc ${dataNoNome(vence)}.pdf`
        : `Boleto NF${numero} - ${dataNoNome(nota.data_emissao)}.pdf`,
      data: nota.data_emissao,
    }
  }
  if (arq.categoria === 'relatorio' && arq.os_id) {
    const { data: os } = await admin
      .from('ordens_servico')
      .select('numero, data_agendada')
      .eq('id', arq.os_id)
      .maybeSingle()
    if (os) {
      return {
        nome: `Ordem de Serviço ${os.numero} - ${dataNoNome(os.data_agendada)}.pdf`,
        data: os.data_agendada,
      }
    }
  }
  return generico()
}

/** Manda um item da fila. Devolve o id do arquivo no Drive. */
async function enviarDaFila(
  admin: SupabaseClient,
  drive: Drive,
  raiz: string,
  arquivoId: string,
  tentativas: number,
) {
  const { data: arq, error } = await admin
    .from('arquivos')
    .select('caminho_storage, nome_original, tipo_mime, categoria, cliente_id, criado_em, os_id')
    .eq('id', arquivoId)
    .single()
  if (error || !arq) throw new Error('Arquivo não encontrado.')
  const setor = SETOR_DA_CATEGORIA[arq.categoria]
  if (!setor) throw new Error(`A categoria ${arq.categoria} não vai para o Drive.`)
  const { nome, data } = await nomeNoDrive(admin, arquivoId, arq, tentativas)
  const baixado = await admin.storage.from('arquivos').download(arq.caminho_storage)
  if (baixado.error) throw new Error(`Não foi possível ler o arquivo: ${baixado.error.message}`)
  const conteudo = new Uint8Array(await baixado.data.arrayBuffer())
  const cliente = await buscarCliente(admin, arq.cliente_id)
  const pasta = await pastaDoCliente(admin, drive, raiz, setor, data.slice(0, 4), cliente)
  return await drive.enviar(pasta, nomeSeguro(nome), arq.tipo_mime ?? 'application/pdf', conteudo)
}

async function processar(admin: SupabaseClient, drive: Drive, raiz: string) {
  const inicio = Date.now()
  let enviados = 0
  let erros = 0
  while (Date.now() - inicio < TEMPO_MAXIMO) {
    const { data: lote, error } = await admin.rpc('drive_pegar_fila', { p_limite: 10 })
    if (error) throw new Error(error.message)
    if (!lote?.length) break
    for (const item of lote as { arquivo_id: string; tentativas: number }[]) {
      try {
        const id = await enviarDaFila(admin, drive, raiz, item.arquivo_id, item.tentativas)
        await admin
          .from('drive_fila')
          .update({
            enviado_em: new Date().toISOString(),
            drive_arquivo_id: id,
            ultimo_erro: null,
            travado_ate: null,
          })
          .eq('arquivo_id', item.arquivo_id)
        enviados++
      } catch (e) {
        erros++
        // Espera mais a cada falha: 2, 4, 8… minutos (no máximo 6 horas).
        const espera =
          e instanceof AindaNaoLigado ? 60_000 : Math.min(2 ** item.tentativas, 360) * 60_000
        // Se a pasta lembrada foi apagada no Drive, procura de novo na próxima vez.
        if (/not found|File not found/i.test(String(e))) {
          await admin.from('drive_pastas').delete().neq('chave', '')
        }
        await admin
          .from('drive_fila')
          .update({
            ultimo_erro: e instanceof Error ? e.message : String(e),
            proxima_tentativa: new Date(Date.now() + espera).toISOString(),
            travado_ate: null,
          })
          .eq('arquivo_id', item.arquivo_id)
        console.error('Drive: falha ao enviar', item.arquivo_id, e)
      }
    }
  }
  return { enviados, erros }
}

/** Quem chama pelo navegador, se tiver um dos papéis. */
async function conferirPapel(req: Request, admin: SupabaseClient, papeis: string[]) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return resposta(401, { erro: 'Faça login novamente.' })
  const { data: quem, error } = await admin.auth.getUser(token)
  if (error || !quem.user) return resposta(401, { erro: 'Sessão expirada. Faça login novamente.' })
  const { data: perfil } = await admin
    .from('perfis')
    .select('papel, ativo')
    .eq('id', quem.user.id)
    .single()
  if (!perfil?.ativo || !papeis.includes(perfil.papel)) {
    return resposta(403, { erro: 'Seu usuário não pode fazer isso.' })
  }
  return null
}

type Pedido =
  | { acao: 'processar' }
  | { acao: 'situacao' }
  | { acao: 'certificado'; certificadoId: string; pdf: string }
  | { acao: 'agenda'; data: string; imagem: string }
  | { acao: 'proposta'; propostaId: string; pdf: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' })

  let pedido: Pedido
  try {
    pedido = await req.json()
  } catch {
    return resposta(400, { erro: 'Pedido inválido.' })
  }

  try {
    const admin = clienteAdmin()
    const config = configuracaoDrive()

    if (pedido.acao === 'processar') {
      const segredo = Deno.env.get('DRIVE_SEGREDO')
      if (!segredo || req.headers.get('x-drive-segredo') !== segredo) {
        return resposta(401, { erro: 'Não autorizado.' })
      }
      if (!config) return resposta(503, { erro: 'Drive não configurado.' })
      return resposta(200, await processar(admin, new Drive(config.conta), config.raiz))
    }

    if (pedido.acao === 'situacao') {
      const negado = await conferirPapel(req, admin, ['admin'])
      if (negado) return negado
      if (!config)
        return resposta(200, {
          configurado: false,
          erro: 'Falta o segredo GOOGLE_DRIVE_CONTA.',
        })
      const drive = new Drive(config.conta)
      const pastas: Record<string, boolean> = {}
      for (const s of SETORES) pastas[s] = !!(await drive.acharPasta(s, config.raiz))
      const { data: fila } = await admin
        .from('drive_fila')
        .select('arquivo_id, tentativas, ultimo_erro')
        .is('enviado_em', null)
        .limit(20)
      return resposta(200, {
        configurado: true,
        conta: await drive.emailDaConta(),
        pastas,
        pendentes: fila,
      })
    }

    if (pedido.acao === 'certificado') {
      const negado = await conferirPapel(req, admin, ['admin', 'administrativo'])
      if (negado) return negado
      if (!config) return resposta(200, { enviado: false, motivo: 'Drive não configurado.' })
      const pdf = decodeBase64(pedido.pdf ?? '')
      if (pdf.byteLength > LIMITE_PDF) return resposta(413, { erro: 'PDF grande demais.' })
      if (new TextDecoder().decode(pdf.subarray(0, 5)) !== '%PDF-') {
        return resposta(400, { erro: 'O arquivo enviado não é um PDF.' })
      }
      const { data: cert } = await admin
        .from('certificados')
        .select('numero, cliente_id, data_execucao')
        .eq('id', pedido.certificadoId)
        .maybeSingle()
      if (!cert) return resposta(404, { erro: 'Certificado não encontrado.' })
      const drive = new Drive(config.conta)
      const cliente = await buscarCliente(admin, cert.cliente_id)
      const pasta = await pastaDoCliente(
        admin,
        drive,
        config.raiz,
        'ADM',
        cert.data_execucao.slice(0, 4),
        cliente,
      )
      const id = await drive.enviar(
        pasta,
        nomeSeguro(`Certificado ${cert.numero} - ${dataNoNome(cert.data_execucao)}.pdf`),
        'application/pdf',
        pdf,
      )
      return resposta(200, { enviado: true, id })
    }

    if (pedido.acao === 'agenda') {
      // Quem gera a imagem da agenda (todos menos o operador).
      const negado = await conferirPapel(req, admin, [
        'admin',
        'administrativo',
        'financeiro',
        'vendedor',
      ])
      if (negado) return negado
      if (!config) return resposta(200, { enviado: false, motivo: 'Drive não configurado.' })
      if (!/^\d{4}-\d{2}-\d{2}$/.test(pedido.data ?? ''))
        return resposta(400, { erro: 'Data inválida.' })
      const png = decodeBase64(pedido.imagem ?? '')
      if (png.byteLength > LIMITE_PDF) return resposta(413, { erro: 'Imagem grande demais.' })
      if (png[0] !== 0x89 || png[1] !== 0x50) return resposta(400, { erro: 'A imagem não é PNG.' })
      // ADM / AGENDA / 2026 / 11 - Novembro / 10-11-2026.png
      const [ano, mes] = pedido.data.split('-')
      const drive = new Drive(config.conta)
      const adm = await pastaDoSetor(admin, drive, config.raiz, 'ADM')
      const agenda = await subpasta(admin, drive, 'agenda', 'AGENDA', adm)
      const pastaAno = await subpasta(admin, drive, `agenda:${ano}`, ano, agenda)
      const nomeMes = `${mes} - ${MESES[Number(mes) - 1]}`
      const pastaMes = await subpasta(admin, drive, `agenda:${ano}:${mes}`, nomeMes, pastaAno)
      const id = await drive.enviar(pastaMes, `${dataNoNome(pedido.data)}.png`, 'image/png', png)
      return resposta(200, { enviado: true, id })
    }

    if (pedido.acao === 'proposta') {
      // VENDAS / ano / vendedor / cliente / Proposta 2026-0012 - dd-mm-aaaa.pdf
      const negado = await conferirPapel(req, admin, [
        'admin',
        'administrativo',
        'financeiro',
        'vendedor',
      ])
      if (negado) return negado
      if (!config) return resposta(200, { enviado: false, motivo: 'Drive não configurado.' })
      const pdf = decodeBase64(pedido.pdf ?? '')
      if (pdf.byteLength > LIMITE_PDF) return resposta(413, { erro: 'PDF grande demais.' })
      if (new TextDecoder().decode(pdf.subarray(0, 5)) !== '%PDF-') {
        return resposta(400, { erro: 'O arquivo enviado não é um PDF.' })
      }
      const { data: prop } = await admin
        .from('propostas')
        .select('numero, cliente_id, vendedor_id, data_envio')
        .eq('id', pedido.propostaId)
        .maybeSingle()
      if (!prop) return resposta(404, { erro: 'Proposta não encontrada.' })
      const { data: vendedor } = await admin
        .from('perfis')
        .select('nome')
        .eq('id', prop.vendedor_id)
        .maybeSingle()
      const ano = String(prop.data_envio).slice(0, 4)
      const drive = new Drive(config.conta)
      const vendas = await pastaDoSetor(admin, drive, config.raiz, 'VENDAS')
      const pastaAno = await subpasta(admin, drive, `ano:VENDAS:${ano}`, ano, vendas)
      const pastaVendedor = await subpasta(
        admin,
        drive,
        `vendedor:${ano}:${prop.vendedor_id}`,
        nomeSeguro(vendedor?.nome?.trim() || 'Sem vendedor'),
        pastaAno,
      )
      const cliente = await buscarCliente(admin, prop.cliente_id)
      const pasta = await pastaDoClienteEm(
        admin,
        drive,
        `cliente:VENDAS:${ano}:${prop.vendedor_id}:${cliente.id}`,
        pastaVendedor,
        cliente,
      )
      const nome = nomeSeguro(`Proposta ${prop.numero} - ${dataNoNome(prop.data_envio)}.pdf`)
      const id = await drive.enviar(pasta, nome, 'application/pdf', pdf)
      return resposta(200, { enviado: true, id })
    }

    return resposta(400, { erro: 'Ação desconhecida.' })
  } catch (e) {
    console.error('Drive', e)
    return resposta(500, { erro: e instanceof Error ? e.message : 'Falha no Drive.' })
  }
})
