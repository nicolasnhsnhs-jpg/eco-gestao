// Boleto da nota fiscal registrado no Sicredi ou no Asaas: usado pela função "boleto"
// (botão Gerar boleto) e pela "nfse" (logo depois de emitir uma nota paga por boleto,
// antes do e-mail).
//
// A configuração fica em configuracoes (boleto_*): boleto_ambiente é o do Sicredi e
// boleto_asaas_ambiente o do Asaas (desligado, sandbox ou producao). boleto_ao_emitir diz
// por qual banco sai o boleto quando a nota não escolheu. Os segredos estão em sicredi.ts
// e asaas.ts.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

import { Asaas, FalhaAsaas } from './asaas.ts'
import { emailDoCliente, totalRetido } from './enviarNota.ts'
import { montarPedidoBoleto, type DadosBoleto } from './pedidoBoleto.ts'
import { FalhaSicredi, Sicredi, type AmbienteBoleto } from './sicredi.ts'

export type Banco = 'sicredi' | 'asaas'

export const NOME_BANCO: Record<Banco, string> = { sicredi: 'Sicredi', asaas: 'Asaas' }

export class FalhaBoleto extends Error {}

/** Recusa que o financeiro resolve (dado da nota, configuração, banco): resposta 400. */
export const ehFalhaDeBoleto = (e: unknown) =>
  e instanceof FalhaBoleto || e instanceof FalhaSicredi || e instanceof FalhaAsaas

export async function configuracaoBoleto(admin: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await admin
    .from('configuracoes')
    .select('chave, valor')
    .like('chave', 'boleto_%')
  return Object.fromEntries((data ?? []).map((c) => [c.chave, (c.valor ?? '').trim()]))
}

/** desligado | sandbox | producao, do banco. */
export function ambienteDoBanco(cfg: Record<string, string>, banco: Banco): string {
  return (banco === 'asaas' ? cfg.boleto_asaas_ambiente : cfg.boleto_ambiente) || 'desligado'
}

const numero = (v: string | undefined, padrao: number) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return v != null && v !== '' && Number.isFinite(n) ? n : padrao
}

type Registro = {
  cobrancaId: string
  nossoNumero: string | null
  linhaDigitavel: string
  codigoBarras: string
  pix: string | null
}

/** O que muda de um banco para o outro; o resto do fluxo é o mesmo. */
type ContaBoleto = {
  banco: Banco
  autenticar(): Promise<void>
  registrar(dados: DadosBoleto, nota: Record<string, any>): Promise<Registro>
  pdf(r: { cobrancaId: string; linhaDigitavel: string }): Promise<Uint8Array>
  consultar(
    cobrancaId: string,
  ): Promise<{ situacao: string | null; pagoEm: string | null; valorPago: number | null }>
  baixar(cobrancaId: string): Promise<void>
  /** Mensagem quando o banco não respondeu a tempo. */
  semResposta: string
}

export function contaDoBanco(
  cfg: Record<string, string>,
  banco: Banco,
  ambiente: AmbienteBoleto,
): ContaBoleto {
  const multa = numero(cfg.boleto_multa, 0)
  const jurosMes = numero(cfg.boleto_juros_mes, 0)

  if (banco === 'asaas') {
    const asaas = new Asaas(ambiente)
    return {
      banco,
      autenticar: () => asaas.autenticar(),
      async registrar(dados, nota) {
        const c = await asaas.criar({ multa, jurosMes }, dados, {
          notaId: nota.id,
          clienteId: nota.cliente_id,
        })
        return { cobrancaId: c.id, ...c }
      },
      pdf: (r) => asaas.pdf(r.cobrancaId),
      consultar: (id) => asaas.consultar(id),
      baixar: (id) => asaas.baixar(id),
      // A nova tentativa acha a cobrança pelo id da nota: não duplica.
      semResposta: 'O Asaas não respondeu a tempo. Tente de novo: o sistema acha a mesma cobrança.',
    }
  }

  const sicredi = new Sicredi(ambiente, {
    cooperativa: cfg.boleto_cooperativa ?? '',
    posto: cfg.boleto_posto ?? '',
    beneficiario: cfg.boleto_codigo_beneficiario ?? '',
  })
  return {
    banco,
    autenticar: () => sicredi.autenticar(),
    async registrar(dados) {
      const pedido = montarPedidoBoleto(
        {
          codigoBeneficiario: sicredi.conta.beneficiario,
          tipoCobranca: cfg.boleto_tipo_cobranca === 'NORMAL' ? 'NORMAL' : 'HIBRIDO',
          especie: cfg.boleto_especie || 'DUPLICATA_SERVICO_INDICACAO',
          multa,
          jurosMes,
        },
        dados,
      )
      const c = await sicredi.criar(pedido)
      return { cobrancaId: c.nossoNumero, ...c }
    },
    pdf: (r) => sicredi.pdf(r.linhaDigitavel),
    consultar: (id) => sicredi.consultar(id),
    baixar: (id) => sicredi.baixar(id),
    semResposta:
      'O Sicredi não respondeu a tempo. Antes de gerar de novo, confira no Internet ' +
      'Banking se o boleto não foi registrado (para não cobrar duas vezes).',
  }
}

/** Valor a pagar: o da nota menos as retenções. */
export function valorDoBoleto(nota: Record<string, any>): number {
  return (
    Math.round(
      (Number(nota.valor_servico) - totalRetido(nota as Parameters<typeof totalRetido>[0])) * 100,
    ) / 100
  )
}

const hojeBrasilia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

const dataBr = (iso: string) => iso.split('-').reverse().join('/')

/** Junta o que o boleto precisa: valor a pagar (sem as retenções), vencimento e o pagador. */
async function dadosDaNota(admin: SupabaseClient, nota: Record<string, any>): Promise<DadosBoleto> {
  const vencimento: string | null = nota.vencimento ?? nota.lancamento?.vencimento ?? null
  if (!vencimento) throw new FalhaBoleto('A nota está sem vencimento: preencha antes do boleto.')
  if (vencimento < hojeBrasilia())
    throw new FalhaBoleto(
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
    valor: valorDoBoleto(nota),
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
  if (!nota) throw new FalhaBoleto('Nota não encontrada.')
  return nota
}

/** Guarda o PDF do banco nos arquivos do cliente e liga à nota (como o anexado à mão). */
async function guardarPdf(
  admin: SupabaseClient,
  nota: Record<string, any>,
  usuarioId: string,
  pdf: Uint8Array,
) {
  const id = crypto.randomUUID()
  const nome = `Boleto ${nota.numero ? `NF ${nota.numero}` : nota.boleto_cobranca_id}.pdf`
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

/**
 * Por qual banco sai o boleto da nota: o escolhido na nota; senão a regra da configuração
 * (um banco fixo, ou por valor: até o limite pelo Asaas, acima pelo Sicredi). null = nenhum.
 */
export function bancoDaNota(cfg: Record<string, string>, nota: Record<string, any>): Banco | null {
  if (nota.boleto_banco === 'sicredi' || nota.boleto_banco === 'asaas') return nota.boleto_banco
  const regra = cfg.boleto_ao_emitir
  if (regra === 'sicredi' || regra === 'asaas') return regra
  if (regra === 'valor') {
    const limite = numero(cfg.boleto_limite_asaas, NaN)
    if (!Number.isFinite(limite)) return null
    return valorDoBoleto(nota) <= limite ? 'asaas' : 'sicredi'
  }
  return null
}

export type BoletoGerado = {
  banco: Banco
  cobrancaId: string
  linhaDigitavel: string
  valor: number
  vencimento: string
}

/**
 * Registra o boleto da nota no banco (produção), guarda o PDF e liga à nota. Se o boleto
 * já foi registrado mas o PDF não ficou guardado, só busca o PDF de novo.
 */
export async function gerarBoletoDaNota(
  admin: SupabaseClient,
  notaId: string,
  usuarioId: string,
  bancoPedido?: Banco,
): Promise<BoletoGerado> {
  const cfg = await configuracaoBoleto(admin)
  let nota = await notaParaBoleto(admin, notaId)
  if (nota.status === 'cancelada') throw new FalhaBoleto('Nota cancelada.')

  // Nova tentativa: o boleto já existe no banco, falta só o PDF.
  if (nota.boleto_cobranca_id) {
    if (nota.arquivo_boleto_id) throw new FalhaBoleto('Esta nota já tem boleto registrado.')
    const banco = nota.boleto_banco as Banco
    if (ambienteDoBanco(cfg, banco) !== 'producao')
      throw new FalhaBoleto(`O boleto pelo ${NOME_BANCO[banco]} está desligado nas configurações.`)
    const conta = contaDoBanco(cfg, banco, 'producao')
    await guardarPdf(
      admin,
      nota,
      usuarioId,
      await conta.pdf({
        cobrancaId: nota.boleto_cobranca_id,
        linhaDigitavel: nota.boleto_linha_digitavel,
      }),
    )
    return {
      banco,
      cobrancaId: nota.boleto_cobranca_id,
      linhaDigitavel: nota.boleto_linha_digitavel,
      valor: Number(nota.boleto_valor),
      vencimento: nota.boleto_vencimento,
    }
  }

  const banco = bancoPedido ?? bancoDaNota(cfg, nota)
  if (!banco) throw new FalhaBoleto('Escolha por qual banco sai o boleto (Asaas ou Sicredi).')
  if (ambienteDoBanco(cfg, banco) !== 'producao')
    throw new FalhaBoleto(
      `O boleto pelo ${NOME_BANCO[banco]} ainda não está ligado (Financeiro → Cadastros).`,
    )
  const conta = contaDoBanco(cfg, banco, 'producao')

  const { data: pegou } = await admin.rpc('travar_boleto_nota', { p_nota_id: notaId })
  if (!pegou) throw new FalhaBoleto('O boleto desta nota já está sendo gerado. Aguarde.')
  const soltar = (erro: string) =>
    admin
      .from('notas_fiscais')
      .update({ gerando_boleto_em: null, erro_boleto: erro })
      .eq('id', notaId)

  let gerado: Registro
  let dados: DadosBoleto
  try {
    dados = await dadosDaNota(admin, nota)
    gerado = await conta.registrar(dados, nota)
  } catch (e) {
    const msg =
      e instanceof DOMException && e.name === 'TimeoutError'
        ? conta.semResposta
        : (e as Error).message
    await soltar(msg)
    throw new FalhaBoleto(msg)
  }

  // O boleto existe no banco: grava antes de qualquer outra coisa, para não se perder.
  const { error } = await admin
    .from('notas_fiscais')
    .update({
      boleto_banco: banco,
      boleto_cobranca_id: gerado.cobrancaId,
      boleto_nosso_numero: gerado.nossoNumero,
      boleto_linha_digitavel: gerado.linhaDigitavel,
      boleto_codigo_barras: gerado.codigoBarras,
      boleto_pix: gerado.pix,
      boleto_valor: dados.valor,
      boleto_vencimento: dados.vencimento,
      boleto_situacao: banco === 'asaas' ? 'PENDING' : 'EM CARTEIRA',
      boleto_gerado_em: new Date().toISOString(),
    })
    .eq('id', notaId)
  if (error) {
    console.error('Boleto registrado mas não gravado', notaId, banco, gerado, error)
    await soltar(`Boleto ${gerado.cobrancaId} registrado no ${NOME_BANCO[banco]}, mas não gravado.`)
    throw new Error(
      `O boleto foi registrado no ${NOME_BANCO[banco]} (${gerado.cobrancaId}, linha ` +
        `${gerado.linhaDigitavel}), mas não consegui gravar no sistema: ${error.message}. ` +
        'Não gere outro: anexe o PDF à mão.',
    )
  }

  nota = await notaParaBoleto(admin, notaId)
  try {
    await guardarPdf(admin, nota, usuarioId, await conta.pdf(gerado))
  } catch (e) {
    await soltar(`Boleto registrado, PDF não guardado: ${(e as Error).message}`)
    throw new FalhaBoleto(
      `O boleto foi registrado no ${NOME_BANCO[banco]}, mas não consegui guardar o PDF ` +
        `(${(e as Error).message}). Clique em "Gerar boleto" de novo: o sistema só busca o ` +
        'PDF deste mesmo boleto.',
    )
  }
  return {
    banco,
    cobrancaId: gerado.cobrancaId,
    linhaDigitavel: gerado.linhaDigitavel,
    valor: dados.valor,
    vencimento: dados.vencimento,
  }
}

/** Ensaio no sandbox do banco: registra um boleto de teste e devolve o PDF. A nota não muda. */
export async function ensaiarBoletoDaNota(admin: SupabaseClient, notaId: string, banco: Banco) {
  const cfg = await configuracaoBoleto(admin)
  // A chave do Asaas é de um ambiente só: o teste só vale com o Asaas em "Testes".
  if (banco === 'asaas' && ambienteDoBanco(cfg, banco) !== 'sandbox')
    throw new FalhaBoleto('Para testar o Asaas, coloque-o em "Testes" com a chave do sandbox.')
  const conta = contaDoBanco(cfg, banco, 'sandbox')
  const nota = await notaParaBoleto(admin, notaId)
  const dados = await dadosDaNota(admin, nota)
  // No Asaas o teste usa uma referência própria, para não achar o ensaio anterior.
  const gerado = await conta.registrar(
    dados,
    banco === 'asaas' ? { ...nota, id: `teste-${nota.id}-${Date.now()}` } : nota,
  )
  let pdfBase64: string | null = null
  let erroPdf: string | null = null
  try {
    const pdf = await conta.pdf(gerado)
    pdfBase64 = btoa(Array.from(pdf, (b) => String.fromCharCode(b)).join(''))
  } catch (e) {
    erroPdf = (e as Error).message
  }
  return {
    banco,
    ...gerado,
    valor: dados.valor,
    vencimento: dados.vencimento,
    pdfBase64,
    erroPdf,
  }
}

/**
 * A nota paga por boleto que acabou de ser emitida ganha o boleto antes do e-mail? Devolve
 * o banco, ou null quando não há o que gerar.
 */
export function bancoAoEmitir(cfg: Record<string, string>, nota: Record<string, any>) {
  if (
    nota.forma_pagamento !== 'boleto' ||
    !nota.boleto_na_emissao ||
    nota.arquivo_boleto_id ||
    nota.boleto_cobranca_id
  )
    return null
  // Banco desligado: a nota sai como antes (sem boleto do sistema), sem prender o e-mail.
  const banco = bancoDaNota(cfg, nota)
  return banco && ambienteDoBanco(cfg, banco) === 'producao' ? banco : null
}
