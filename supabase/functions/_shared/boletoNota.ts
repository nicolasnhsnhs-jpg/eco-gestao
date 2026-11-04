// Boleto da nota fiscal registrado no Sicredi: usado pela função "boleto" (botão Gerar
// boleto) e pela "nfse" (logo depois de emitir uma nota paga por boleto, antes do e-mail).
//
// A configuração fica em configuracoes (boleto_*); boleto_ambiente diz se está desligado,
// em testes (sandbox, nada vale) ou valendo (producao). Os segredos estão em sicredi.ts.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

import { emailDoCliente, totalRetido } from './enviarNota.ts'
import { montarPedidoBoleto, type ConfigBoleto, type DadosBoleto } from './pedidoBoleto.ts'
import { FalhaSicredi, Sicredi, type AmbienteBoleto } from './sicredi.ts'

export async function configuracaoBoleto(admin: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await admin
    .from('configuracoes')
    .select('chave, valor')
    .like('chave', 'boleto_%')
  return Object.fromEntries((data ?? []).map((c) => [c.chave, (c.valor ?? '').trim()]))
}

export function sicrediDaConfiguracao(cfg: Record<string, string>, ambiente: AmbienteBoleto) {
  return new Sicredi(ambiente, {
    cooperativa: cfg.boleto_cooperativa ?? '',
    posto: cfg.boleto_posto ?? '',
    beneficiario: cfg.boleto_codigo_beneficiario ?? '',
  })
}

function configDoPedido(cfg: Record<string, string>, beneficiario: string): ConfigBoleto {
  const pct = (v: string | undefined, padrao: number) => {
    const n = Number(String(v ?? '').replace(',', '.'))
    return v != null && v !== '' && Number.isFinite(n) ? n : padrao
  }
  return {
    codigoBeneficiario: beneficiario,
    tipoCobranca: cfg.boleto_tipo_cobranca === 'NORMAL' ? 'NORMAL' : 'HIBRIDO',
    especie: cfg.boleto_especie || 'DUPLICATA_SERVICO_INDICACAO',
    multa: pct(cfg.boleto_multa, 0),
    jurosMes: pct(cfg.boleto_juros_mes, 0),
  }
}

const hojeBrasilia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

const dataBr = (iso: string) => iso.split('-').reverse().join('/')

/** Junta o que o boleto precisa: valor a pagar (sem as retenções), vencimento e o pagador. */
async function dadosDaNota(admin: SupabaseClient, nota: Record<string, any>): Promise<DadosBoleto> {
  const vencimento: string | null = nota.vencimento ?? nota.lancamento?.vencimento ?? null
  if (!vencimento) throw new FalhaSicredi('A nota está sem vencimento: preencha antes do boleto.')
  if (vencimento < hojeBrasilia())
    throw new FalhaSicredi(
      `O vencimento (${dataBr(vencimento)}) já passou: ajuste o vencimento da nota.`,
    )

  let e: Record<string, string | null> | null = null
  if (nota.contrato?.endereco_id) {
    const { data } = await admin
      .from('enderecos')
      .select('*')
      .eq('id', nota.contrato.endereco_id)
      .maybeSingle()
    e = data
  }
  if (!e) {
    const { data } = await admin
      .from('enderecos')
      .select('*')
      .eq('cliente_id', nota.cliente_id)
      .eq('ativo', true)
      .order('principal', { ascending: false })
      .order('criado_em')
      .limit(1)
    e = data?.[0] ?? null
  }
  const [email] = await emailDoCliente(admin, nota.cliente_id)

  const competencia = String(nota.competencia).slice(0, 7).split('-').reverse().join('/')
  const nf = nota.numero ? `NF ${nota.numero}` : 'nota fiscal de servico'
  return {
    referencia: nota.numero ? `NF${nota.numero}` : String(nota.id).slice(0, 8),
    valor:
      Math.round(
        (Number(nota.valor_servico) - totalRetido(nota as Parameters<typeof totalRetido>[0])) * 100,
      ) / 100,
    vencimento,
    pagador: {
      documento: nota.cliente?.cpf_cnpj ?? '',
      nome: nota.cliente?.nome ?? '',
      logradouro: e?.logradouro ?? null,
      numero: e?.numero ?? null,
      cidade: e?.cidade ?? null,
      uf: e?.uf ?? null,
      cep: e?.cep ?? null,
      email: email ?? null,
    },
    informativos: [`Referente a ${nf} - competencia ${competencia}`],
  }
}

const SELECAO_NOTA =
  '*, cliente:clientes(nome, cpf_cnpj), contrato:contratos(endereco_id), lancamento:lancamentos(vencimento)'

async function notaParaBoleto(admin: SupabaseClient, notaId: string) {
  const { data: nota } = await admin
    .from('notas_fiscais')
    .select(SELECAO_NOTA)
    .eq('id', notaId)
    .single()
  if (!nota) throw new FalhaSicredi('Nota não encontrada.')
  return nota
}

/** Guarda o PDF do Sicredi nos arquivos do cliente e liga à nota (como o anexado à mão). */
async function guardarPdf(
  admin: SupabaseClient,
  nota: Record<string, any>,
  usuarioId: string,
  pdf: Uint8Array,
) {
  const id = crypto.randomUUID()
  const nome = `Boleto ${nota.numero ? `NF ${nota.numero}` : nota.boleto_nosso_numero}.pdf`
  const caminho = `clientes/${nota.cliente_id}/${id}-${nome.replace(/\s+/g, '-')}`
  const envio = await admin.storage
    .from('arquivos')
    .upload(caminho, pdf, { contentType: 'application/pdf' })
  if (envio.error) throw new Error(`Não foi possível guardar o boleto: ${envio.error.message}`)
  const { error } = await admin.from('arquivos').insert({
    id,
    caminho_storage: caminho,
    nome_original: nome,
    tipo_mime: 'application/pdf',
    tamanho_bytes: pdf.byteLength,
    categoria: 'boleto',
    cliente_id: nota.cliente_id,
    lancamento_id: nota.lancamento_id,
    descricao: nota.numero ? `Boleto da NF ${nota.numero}` : 'Boleto',
    enviado_por: usuarioId,
  })
  if (error) {
    await admin.storage.from('arquivos').remove([caminho])
    throw new Error(`Não foi possível registrar o boleto: ${error.message}`)
  }
  const { error: erroNota } = await admin
    .from('notas_fiscais')
    .update({ arquivo_boleto_id: id, gerando_boleto_em: null, erro_boleto: null })
    .eq('id', nota.id)
  if (erroNota) throw new Error(`Não foi possível ligar o boleto à nota: ${erroNota.message}`)
}

export type BoletoGerado = {
  nossoNumero: string
  linhaDigitavel: string
  valor: number
  vencimento: string
}

/**
 * Registra o boleto da nota no Sicredi (produção), guarda o PDF e liga à nota. Se o
 * boleto já foi registrado mas o PDF não ficou guardado, só busca o PDF de novo.
 */
export async function gerarBoletoDaNota(
  admin: SupabaseClient,
  notaId: string,
  usuarioId: string,
): Promise<BoletoGerado> {
  const cfg = await configuracaoBoleto(admin)
  if (cfg.boleto_ambiente !== 'producao')
    throw new FalhaSicredi('O boleto pelo sistema ainda não está ligado (configuração do boleto).')
  const sicredi = sicrediDaConfiguracao(cfg, 'producao')

  let nota = await notaParaBoleto(admin, notaId)
  if (nota.status === 'cancelada') throw new FalhaSicredi('Nota cancelada.')

  // Nova tentativa: o boleto já existe no Sicredi, falta só o PDF.
  if (nota.boleto_nosso_numero) {
    if (nota.arquivo_boleto_id) throw new FalhaSicredi('Esta nota já tem boleto do Sicredi.')
    await guardarPdf(admin, nota, usuarioId, await sicredi.pdf(nota.boleto_linha_digitavel))
    return {
      nossoNumero: nota.boleto_nosso_numero,
      linhaDigitavel: nota.boleto_linha_digitavel,
      valor: Number(nota.boleto_valor),
      vencimento: nota.boleto_vencimento,
    }
  }

  const { data: pegou } = await admin.rpc('travar_boleto_nota', { p_nota_id: notaId })
  if (!pegou) throw new FalhaSicredi('O boleto desta nota já está sendo gerado. Aguarde.')
  const soltar = (erro: string) =>
    admin
      .from('notas_fiscais')
      .update({ gerando_boleto_em: null, erro_boleto: erro })
      .eq('id', notaId)

  let gerado: Awaited<ReturnType<Sicredi['criar']>>
  let dados: DadosBoleto
  try {
    dados = await dadosDaNota(admin, nota)
    const pedido = montarPedidoBoleto(configDoPedido(cfg, sicredi.conta.beneficiario), dados)
    gerado = await sicredi.criar(pedido)
  } catch (e) {
    const msg =
      e instanceof DOMException && e.name === 'TimeoutError'
        ? 'O Sicredi não respondeu a tempo. Antes de gerar de novo, confira no Internet ' +
          'Banking se o boleto não foi registrado (para não cobrar duas vezes).'
        : (e as Error).message
    await soltar(msg)
    throw new FalhaSicredi(msg)
  }

  // O boleto existe no Sicredi: grava antes de qualquer outra coisa, para não se perder.
  const { error } = await admin
    .from('notas_fiscais')
    .update({
      boleto_nosso_numero: gerado.nossoNumero,
      boleto_linha_digitavel: gerado.linhaDigitavel,
      boleto_codigo_barras: gerado.codigoBarras,
      boleto_pix: gerado.pix,
      boleto_valor: dados.valor,
      boleto_vencimento: dados.vencimento,
      boleto_situacao: 'EM CARTEIRA',
      boleto_gerado_em: new Date().toISOString(),
    })
    .eq('id', notaId)
  if (error) {
    console.error('Boleto registrado mas não gravado', notaId, gerado, error)
    await soltar(`Boleto ${gerado.nossoNumero} registrado no Sicredi, mas não gravado.`)
    throw new Error(
      `O boleto foi registrado no Sicredi (nosso número ${gerado.nossoNumero}, linha ` +
        `${gerado.linhaDigitavel}), mas não consegui gravar no sistema: ${error.message}. ` +
        'Não gere outro: anexe o PDF à mão pelo Internet Banking.',
    )
  }

  nota = await notaParaBoleto(admin, notaId)
  try {
    await guardarPdf(admin, nota, usuarioId, await sicredi.pdf(gerado.linhaDigitavel))
  } catch (e) {
    await soltar(`Boleto registrado, PDF não guardado: ${(e as Error).message}`)
    throw new FalhaSicredi(
      `O boleto ${gerado.nossoNumero} foi registrado no Sicredi, mas não consegui guardar o ` +
        `PDF (${(e as Error).message}). Clique em "Gerar boleto" de novo: o sistema só ` +
        'busca o PDF deste mesmo boleto.',
    )
  }
  return {
    nossoNumero: gerado.nossoNumero,
    linhaDigitavel: gerado.linhaDigitavel,
    valor: dados.valor,
    vencimento: dados.vencimento,
  }
}

/** Ensaio no sandbox do Sicredi: registra um boleto de teste e devolve o PDF. A nota não muda. */
export async function ensaiarBoletoDaNota(admin: SupabaseClient, notaId: string) {
  const cfg = await configuracaoBoleto(admin)
  const sicredi = sicrediDaConfiguracao(cfg, 'sandbox')
  const nota = await notaParaBoleto(admin, notaId)
  const dados = await dadosDaNota(admin, nota)
  const pedido = montarPedidoBoleto(configDoPedido(cfg, sicredi.conta.beneficiario), dados)
  const gerado = await sicredi.criar(pedido)
  let pdfBase64: string | null = null
  let erroPdf: string | null = null
  try {
    const pdf = await sicredi.pdf(gerado.linhaDigitavel)
    pdfBase64 = btoa(Array.from(pdf, (b) => String.fromCharCode(b)).join(''))
  } catch (e) {
    erroPdf = (e as Error).message
  }
  return { ...gerado, valor: dados.valor, vencimento: dados.vencimento, pedido, pdfBase64, erroPdf }
}

/** A nota paga por boleto que acabou de ser emitida ganha o boleto antes do e-mail? */
export function deveGerarAoEmitir(cfg: Record<string, string>, nota: Record<string, any>) {
  return (
    cfg.boleto_ambiente === 'producao' &&
    cfg.boleto_ao_emitir !== 'nao' &&
    nota.forma_pagamento === 'boleto' &&
    !nota.arquivo_boleto_id
  )
}
