// Conversa com a API do Asaas (v3), para o boleto da nota. A autenticação é a chave de API
// da conta, no cabeçalho access_token; contas novas exigem também um User-Agent.
//
// Segredo do projeto (Supabase → Edge Functions → Secrets):
//   ASAAS_API_KEY  chave de API (Asaas → Integrações → Chaves de API). A do sandbox começa
//                  com $aact_hmlg_ e a de produção com $aact_prod_: vale a do ambiente ligado.
//
//   GET    /customers?cpfCnpj=…              acha o cliente pelo CPF/CNPJ
//   POST   /customers                        cadastra o cliente (sem os avisos do Asaas)
//   GET    /payments?externalReference=…     acha a cobrança da nota (nova tentativa)
//   POST   /payments                         cria a cobrança por boleto
//   GET    /payments/{id}/identificationField  linha digitável e código de barras
//   GET    /payments/{id}/pixQrCode          Pix copia e cola (se a conta tem chave Pix)
//   GET    /payments/{id}                    situação e o link do PDF (bankSlipUrl)
//   DELETE /payments/{id}                    cancela a cobrança

import type { DadosBoleto } from './pedidoBoleto.ts'

export type AmbienteAsaas = 'sandbox' | 'producao'

export class FalhaAsaas extends Error {}

const BASE: Record<AmbienteAsaas, string> = {
  producao: 'https://api.asaas.com/v3',
  sandbox: 'https://api-sandbox.asaas.com/v3',
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

/** O que o Asaas explica na recusa: {"errors":[{"code","description"}]}. */
async function motivo(r: Response): Promise<string> {
  const texto = await r.text().catch(() => '')
  try {
    const j = JSON.parse(texto) as { errors?: { description?: string; code?: string }[] }
    const partes = (j.errors ?? []).map((e) => e.description || e.code).filter(Boolean)
    if (partes.length) return partes.join('; ')
  } catch {
    // Não era JSON.
  }
  return texto.slice(0, 200) || r.statusText
}

export type ConfigAsaas = { multa: number; jurosMes: number }

export type CobrancaAsaas = {
  id: string
  nossoNumero: string | null
  linhaDigitavel: string
  codigoBarras: string
  pix: string | null
}

/** Situações do Asaas que querem dizer "pago". */
const PAGO = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']

export class Asaas {
  private readonly chave: string

  constructor(readonly ambiente: AmbienteAsaas) {
    const chave = segredo('ASAAS_API_KEY')
    if (!chave)
      throw new FalhaAsaas('Falta o segredo ASAAS_API_KEY (chave de API da conta no Asaas).')
    // Chave de um ambiente na URL do outro: o Asaas só diz "invalid_environment".
    if (ambiente === 'producao' && chave.includes('_hmlg_'))
      throw new FalhaAsaas(
        'O ASAAS_API_KEY é uma chave de testes (sandbox), mas o Asaas está em "Valendo".',
      )
    if (ambiente === 'sandbox' && chave.includes('_prod_'))
      throw new FalhaAsaas(
        'O ASAAS_API_KEY é uma chave de produção, mas o Asaas está em "Testes". Use a do sandbox.',
      )
    this.chave = chave
  }

  private async chamar(metodo: 'GET' | 'POST' | 'DELETE', caminho: string, corpo?: unknown) {
    const r = await fetch(`${BASE[this.ambiente]}${caminho}`, {
      method: metodo,
      headers: {
        access_token: this.chave,
        'Content-Type': 'application/json',
        'User-Agent': 'EcoGestao/1.0 (boletos das notas fiscais)',
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(30_000),
    })
    if (r.status === 401)
      throw new FalhaAsaas(
        `O Asaas recusou a chave de API (${await motivo(r)}). Confira o segredo ASAAS_API_KEY.`,
      )
    if (r.status === 429)
      throw new FalhaAsaas('O Asaas pediu um tempo (muitas chamadas). Tente em 1 minuto.')
    return r
  }

  private async json<T>(metodo: 'GET' | 'POST' | 'DELETE', caminho: string, corpo?: unknown) {
    const r = await this.chamar(metodo, caminho, corpo)
    if (!r.ok) throw new FalhaAsaas(`Recusado pelo Asaas: ${await motivo(r)}`)
    return (await r.json()) as T
  }

  /** Só confere a chave (lista um cliente). */
  async autenticar() {
    await this.json('GET', '/customers?limit=1')
  }

  /**
   * O cliente do Asaas com este CPF/CNPJ. Se já existe, fica como está (inclusive os avisos
   * que o Asaas manda); o novo é cadastrado sem avisos, porque o sistema já manda o e-mail.
   */
  private async cliente(dados: DadosBoleto, referencia: string): Promise<string> {
    const documento = dados.pagador.documento.replace(/\D/g, '')
    if (documento.length !== 11 && documento.length !== 14)
      throw new FalhaAsaas('O cliente está sem CPF/CNPJ.')
    const achados = await this.json<{ data: { id: string; deleted?: boolean }[] }>(
      'GET',
      `/customers?${new URLSearchParams({ cpfCnpj: documento, limit: '10' })}`,
    )
    const existente = achados.data.find((c) => !c.deleted)
    if (existente) return existente.id

    const cep = (dados.pagador.cep ?? '').replace(/\D/g, '')
    const novo = await this.json<{ id: string }>('POST', '/customers', {
      name: dados.pagador.nome.slice(0, 100),
      cpfCnpj: documento,
      email: dados.pagador.email ?? undefined,
      postalCode: cep.length === 8 ? cep : undefined,
      address: dados.pagador.logradouro ?? undefined,
      addressNumber: dados.pagador.numero ?? undefined,
      externalReference: referencia,
      notificationDisabled: true,
    })
    return novo.id
  }

  private async completar(id: string, nossoNumero: string | null): Promise<CobrancaAsaas> {
    const campo = await this.json<{
      identificationField: string
      barCode: string
      nossoNumero?: string
    }>('GET', `/payments/${encodeURIComponent(id)}/identificationField`)
    // Sem chave Pix na conta o Asaas recusa o QR Code: o boleto vale do mesmo jeito.
    const pix = await this.json<{ payload?: string }>(
      'GET',
      `/payments/${encodeURIComponent(id)}/pixQrCode`,
    ).catch(() => null)
    return {
      id,
      nossoNumero: campo.nossoNumero ?? nossoNumero,
      linhaDigitavel: campo.identificationField.replace(/\D/g, ''),
      codigoBarras: campo.barCode,
      pix: pix?.payload?.trim() || null,
    }
  }

  /**
   * Cria a cobrança por boleto. A cobrança leva o id da nota (externalReference): se uma
   * tentativa anterior criou e não recebeu a resposta, esta acha a mesma e não cria outra.
   */
  async criar(
    cfg: ConfigAsaas,
    dados: DadosBoleto,
    ref: { notaId: string; clienteId: string },
  ): Promise<CobrancaAsaas> {
    if (!(dados.valor > 0)) throw new FalhaAsaas('O valor do boleto precisa ser maior que zero.')
    const ja = await this.json<{ data: { id: string; nossoNumero?: string; deleted?: boolean }[] }>(
      'GET',
      `/payments?${new URLSearchParams({ externalReference: ref.notaId, limit: '10' })}`,
    )
    const anterior = ja.data.find((p) => !p.deleted)
    if (anterior) return this.completar(anterior.id, anterior.nossoNumero ?? null)

    const customer = await this.cliente(dados, ref.clienteId)
    const cobranca = await this.json<{ id: string; nossoNumero?: string }>('POST', '/payments', {
      customer,
      billingType: 'BOLETO',
      value: Math.round(dados.valor * 100) / 100,
      dueDate: dados.vencimento,
      description: dados.informativos.join(' ').slice(0, 500),
      externalReference: ref.notaId,
      fine: cfg.multa > 0 ? { value: cfg.multa, type: 'PERCENTAGE' } : undefined,
      interest: cfg.jurosMes > 0 ? { value: cfg.jurosMes } : undefined,
    })
    return this.completar(cobranca.id, cobranca.nossoNumero ?? null)
  }

  /** O PDF do boleto (pelo link bankSlipUrl da cobrança). */
  async pdf(id: string): Promise<Uint8Array> {
    const c = await this.json<{ bankSlipUrl?: string }>(
      'GET',
      `/payments/${encodeURIComponent(id)}`,
    )
    if (!c.bankSlipUrl) throw new FalhaAsaas('O Asaas não devolveu o link do boleto.')
    const r = await fetch(c.bankSlipUrl, { signal: AbortSignal.timeout(30_000) })
    if (!r.ok) throw new FalhaAsaas(`O Asaas não devolveu o PDF (${r.status}).`)
    const bytes = new Uint8Array(await r.arrayBuffer())
    if (bytes[0] !== 0x25 || bytes[1] !== 0x50)
      throw new FalhaAsaas('O Asaas devolveu algo que não é PDF no lugar do boleto.')
    return bytes
  }

  async consultar(id: string) {
    const c = await this.json<{
      status: string
      paymentDate?: string | null
      clientPaymentDate?: string | null
      value?: number
      deleted?: boolean
    }>('GET', `/payments/${encodeURIComponent(id)}`)
    const pago = PAGO.includes(c.status)
    return {
      situacao: c.deleted ? 'DELETED' : c.status,
      pagoEm: pago ? (c.clientPaymentDate ?? c.paymentDate ?? null) : null,
      valorPago: pago ? (c.value ?? null) : null,
    }
  }

  /** Cancela a cobrança (o boleto deixa de valer). */
  async baixar(id: string) {
    await this.json('DELETE', `/payments/${encodeURIComponent(id)}`)
  }
}
