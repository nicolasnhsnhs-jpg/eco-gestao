// Edge Function "assinatura": assina digitalmente o PDF do certificado de serviço com um
// certificado A1 (ICP-Brasil). Alguns clientes pedem o certificado assinado; antes isso
// era feito à mão no Adobe.
//
// Usa o mesmo certificado da NFS-e (e-CNPJ da empresa), dos segredos do projeto:
//   NFSE_CERTIFICADO / NFSE_SENHA
// Se um dia a assinatura precisar de outro certificado (ex.: e-CPF da responsável
// técnica), basta cadastrar ASSINATURA_CERTIFICADO / ASSINATURA_SENHA: eles têm preferência.
// O .pfx nunca vai para o navegador.
//
// Ações (só Administrador e ADM, os perfis que emitem certificado):
//   - situacao: diz se o certificado está cadastrado, de quem é e até quando vale;
//   - assinar:  recebe o PDF montado na tela e devolve o mesmo PDF assinado. Só assina
//               o PDF de um certificado marcado "assinatura digital", não cancelado, e
//               cujo título do PDF começa pelo número dele.

import { decodeBase64, encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { PDFDocument } from 'npm:pdf-lib@1.17.1'

import { assinarPdf } from '../_shared/assinarPdf.ts'
import { lerCertificado, type Certificado } from '../_shared/certificadoA1.ts'
import { clienteAdmin, CORS, resposta } from '../_shared/servidor.ts'

const PROPRIO = { arquivo: 'ASSINATURA_CERTIFICADO', senha: 'ASSINATURA_SENHA' }
const DA_NOTA = { arquivo: 'NFSE_CERTIFICADO', senha: 'NFSE_SENHA' }
/** PDF do certificado tem poucas centenas de KB; isto é só um teto. */
const LIMITE_PDF = 15 * 1024 * 1024

type Pedido = { acao: 'situacao' } | { acao: 'assinar'; certificadoId: string; pdf: string }

let emCache: Certificado | null = null

function certificado(): Certificado {
  if (emCache) return emCache
  const segredos = Deno.env.get(PROPRIO.arquivo) ? PROPRIO : DA_NOTA
  const pfx = Deno.env.get(segredos.arquivo)
  const senha = Deno.env.get(segredos.senha)
  if (!pfx || senha == null) {
    throw new Error(
      `O certificado digital ainda não foi cadastrado nos segredos (${DA_NOTA.arquivo} e ${DA_NOTA.senha}, os mesmos da nota fiscal).`,
    )
  }
  emCache = lerCertificado(pfx, senha, segredos)
  return emCache
}

/** "ECO AMBIENTAL LTDA:07125516000101" → "ECO AMBIENTAL LTDA" (vale para e-CPF também). */
const nomeDoTitular = (cn: string) => cn.replace(/:\d{11,14}$/, '').trim()

const dataBr = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' })

  try {
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
      return resposta(403, { erro: 'Somente quem emite certificados pode assinar.' })
    }

    let pedido: Pedido
    try {
      pedido = await req.json()
    } catch {
      return resposta(400, { erro: 'Pedido inválido.' })
    }

    if (pedido.acao === 'situacao') {
      try {
        const c = certificado()
        return resposta(200, {
          configurado: true,
          titular: nomeDoTitular(c.titular),
          validoAte: c.validoAte.toISOString(),
          vencido: c.validoAte.getTime() < Date.now(),
        })
      } catch (e) {
        return resposta(200, { configurado: false, erro: (e as Error).message })
      }
    }

    if (pedido.acao !== 'assinar') return resposta(400, { erro: 'Ação desconhecida.' })
    if (typeof pedido.certificadoId !== 'string' || typeof pedido.pdf !== 'string')
      return resposta(400, { erro: 'Pedido inválido.' })

    const { data: cert, error } = await admin
      .from('certificados')
      .select('numero, assinatura_digital, cancelado_em')
      .eq('id', pedido.certificadoId)
      .maybeSingle()
    if (error) throw error
    if (!cert) return resposta(404, { erro: 'Certificado não encontrado.' })
    if (cert.cancelado_em)
      return resposta(400, { erro: 'Certificado cancelado não recebe assinatura digital.' })
    if (!cert.assinatura_digital)
      return resposta(400, {
        erro: 'Marque "Assinatura digital" no certificado e salve antes de assinar.',
      })

    const a1 = certificado()
    if (a1.validoAte.getTime() < Date.now()) {
      return resposta(400, {
        erro: `O certificado digital venceu em ${dataBr(a1.validoAte)}. Cadastre o novo nos segredos.`,
      })
    }

    let bytes: Uint8Array
    try {
      bytes = decodeBase64(pedido.pdf)
    } catch {
      return resposta(400, { erro: 'O PDF não chegou inteiro. Tente de novo.' })
    }
    if (bytes.length > LIMITE_PDF) return resposta(400, { erro: 'O PDF é grande demais.' })

    let pdf: PDFDocument
    try {
      pdf = await PDFDocument.load(bytes)
    } catch {
      return resposta(400, { erro: 'O arquivo enviado não é um PDF válido.' })
    }
    // O PDF montado na tela tem o título "CERT-2026-0001 - …".
    if (!(pdf.getTitle() ?? '').startsWith(cert.numero))
      return resposta(400, { erro: 'Este PDF não é do certificado escolhido.' })

    const assinado = await assinarPdf(pdf, a1, { motivo: `Certificado ${cert.numero}` })
    return resposta(200, { pdf: encodeBase64(assinado) })
  } catch (e) {
    console.error(e)
    return resposta(500, { erro: (e as Error).message ?? 'Erro ao assinar o PDF.' })
  }
})
