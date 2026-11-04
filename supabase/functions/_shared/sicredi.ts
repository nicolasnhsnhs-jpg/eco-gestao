// Conversa com a API de Cobrança do Sicredi (boletos), conforme o Manual da API da
// Cobrança. A autenticação é OAuth2 ("password"): usuário = código do beneficiário +
// cooperativa, senha = Código de Acesso gerado no Internet Banking (Cobrança >> Código de
// Acesso >> Gerar). Toda chamada leva também o x-api-key do app no Portal do Desenvolvedor.
//
// Segredos do projeto (Supabase → Edge Functions → Secrets):
//   SICREDI_API_KEY        token do app no Portal do Desenvolvedor (um para o sandbox,
//                          outro para a produção: vale o do ambiente ligado)
//   SICREDI_CODIGO_ACESSO  Código de Acesso do Internet Banking (só produção)
//
// No sandbox o manual manda usar dados fixos: usuário 123456789, senha teste123,
// cooperativa 6789, posto 03 e beneficiário 12345.
//
//   POST  /auth/openapi/token                      token (dura ~5 min; refresh ~15–30 min)
//   POST  /cobranca/boleto/v1/boletos              cadastra: linha digitável, nosso número, Pix
//   GET   /cobranca/boleto/v1/boletos/pdf          PDF pela linha digitável
//   GET   /cobranca/boleto/v1/boletos              consulta pelo nosso número (situação)
//   PATCH /cobranca/boleto/v1/boletos/{nn}/baixa   pedido de baixa (cancela o boleto)

export type AmbienteBoleto = 'sandbox' | 'producao'

export class FalhaSicredi extends Error {}

const BASE: Record<AmbienteBoleto, string> = {
  producao: 'https://api-parceiro.sicredi.com.br',
  sandbox: 'https://api-parceiro.sicredi.com.br/sb',
}

const SANDBOX = { cooperativa: '6789', posto: '03', beneficiario: '12345' }

export type ContaSicredi = { cooperativa: string; posto: string; beneficiario: string }

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

/** O que o Sicredi explica na recusa (o formato varia entre os recursos). */
async function motivo(r: Response): Promise<string> {
  const texto = await r.text().catch(() => '')
  try {
    const j = JSON.parse(texto)
    const partes = (Array.isArray(j) ? j : [j])
      .map((e) =>
        [e.message ?? e.mensagem ?? e.error_description ?? e.error ?? e.detail, e.parametro]
          .filter(Boolean)
          .join(' — campo '),
      )
      .filter(Boolean)
    if (partes.length) return partes.join('; ')
  } catch {
    // Não era JSON.
  }
  return texto.slice(0, 200) || r.statusText
}

type Token = { acesso: string; venceEm: number; refresh: string; refreshVenceEm: number }

// A função reaproveita a instância entre chamadas: o token fica guardado enquanto vale.
const tokens = new Map<string, Token>()

export class Sicredi {
  readonly conta: ContaSicredi
  private readonly apiKey: string
  private readonly usuario: string
  private readonly senha: string

  constructor(
    readonly ambiente: AmbienteBoleto,
    conta: ContaSicredi,
  ) {
    const apiKey = segredo('SICREDI_API_KEY')
    if (!apiKey)
      throw new FalhaSicredi(
        'Falta o segredo SICREDI_API_KEY (token do app no Portal do Desenvolvedor do Sicredi).',
      )
    this.apiKey = apiKey
    if (ambiente === 'sandbox') {
      this.conta = SANDBOX
      this.usuario = '123456789'
      this.senha = 'teste123'
    } else {
      if (!/^\d{4}$/.test(conta.cooperativa) || !/^\d{2}$/.test(conta.posto))
        throw new FalhaSicredi('Faltam a cooperativa e o posto do Sicredi nas configurações.')
      if (!/^\d{5}$/.test(conta.beneficiario))
        throw new FalhaSicredi('Falta o código do beneficiário do Sicredi nas configurações.')
      const senha = segredo('SICREDI_CODIGO_ACESSO')
      if (!senha)
        throw new FalhaSicredi(
          'Falta o segredo SICREDI_CODIGO_ACESSO (gerado no Internet Banking do Sicredi).',
        )
      this.conta = conta
      this.usuario = conta.beneficiario + conta.cooperativa
      this.senha = senha
    }
  }

  private async pedirToken(campos: Record<string, string>): Promise<Token> {
    const r = await fetch(`${BASE[this.ambiente]}/auth/openapi/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-api-key': this.apiKey,
        context: 'COBRANCA',
      },
      body: new URLSearchParams({ scope: 'cobranca', ...campos }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!r.ok) {
      const m = await motivo(r)
      throw new FalhaSicredi(
        r.status === 401 || /invalid|credentials/i.test(m)
          ? `O Sicredi recusou o acesso (${r.status}: ${m}). Confira o SICREDI_API_KEY, o ` +
              'Código de Acesso e o código do beneficiário/cooperativa.'
          : `O Sicredi recusou a autenticação (${r.status}: ${m}).`,
      )
    }
    const j = (await r.json()) as {
      access_token: string
      expires_in: number | string
      refresh_token: string
      refresh_expires_in: number | string
    }
    const agora = Date.now()
    return {
      acesso: j.access_token,
      // Folga de 30 s para não usar um token que vence no caminho.
      venceEm: agora + (Number(j.expires_in) - 30) * 1000,
      refresh: j.refresh_token,
      refreshVenceEm: agora + (Number(j.refresh_expires_in) - 30) * 1000,
    }
  }

  private async token(): Promise<string> {
    const chave = `${this.ambiente}:${this.usuario}`
    const atual = tokens.get(chave)
    const agora = Date.now()
    if (atual && atual.venceEm > agora) return atual.acesso
    let novo: Token | null = null
    if (atual && atual.refreshVenceEm > agora) {
      novo = await this.pedirToken({
        grant_type: 'refresh_token',
        refresh_token: atual.refresh,
      }).catch(() => null)
    }
    novo ??= await this.pedirToken({
      grant_type: 'password',
      username: this.usuario,
      password: this.senha,
    })
    tokens.set(chave, novo)
    return novo.acesso
  }

  private async chamar(
    metodo: 'GET' | 'POST' | 'PATCH',
    caminho: string,
    { corpo, comConta = true }: { corpo?: unknown; comConta?: boolean } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
      Authorization: `Bearer ${await this.token()}`,
      'Content-Type': 'application/json',
    }
    if (comConta) {
      headers.cooperativa = this.conta.cooperativa
      headers.posto = this.conta.posto
      headers.codigoBeneficiario = this.conta.beneficiario
    }
    const r = await fetch(`${BASE[this.ambiente]}${caminho}`, {
      method: metodo,
      headers,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(30_000),
    })
    if (r.status === 429)
      throw new FalhaSicredi('O Sicredi pediu um tempo (muitas chamadas). Tente em 1 minuto.')
    return r
  }

  /** Só autentica: prova que o x-api-key e o Código de Acesso valem. */
  async autenticar() {
    await this.token()
  }

  /** Cadastra o boleto. O pedido vem de montarPedidoBoleto. */
  async criar(pedido: Record<string, unknown>) {
    const r = await this.chamar('POST', '/cobranca/boleto/v1/boletos', { corpo: pedido })
    if (!r.ok) throw new FalhaSicredi(`Boleto recusado pelo Sicredi: ${await motivo(r)}`)
    const j = (await r.json()) as {
      linhaDigitavel: string
      codigoBarras: string
      nossoNumero: string | number
      qrCode?: string | null
      txid?: string | null
    }
    return {
      linhaDigitavel: String(j.linhaDigitavel),
      codigoBarras: String(j.codigoBarras),
      nossoNumero: String(j.nossoNumero),
      pix: j.qrCode?.trim() || null,
    }
  }

  /** O PDF do boleto, pela linha digitável. */
  async pdf(linhaDigitavel: string): Promise<Uint8Array> {
    const params = new URLSearchParams({ linhaDigitavel })
    const r = await this.chamar('GET', `/cobranca/boleto/v1/boletos/pdf?${params}`, {
      comConta: false,
    })
    if (!r.ok) throw new FalhaSicredi(`O Sicredi não devolveu o PDF: ${await motivo(r)}`)
    const bytes = new Uint8Array(await r.arrayBuffer())
    // "%PDF": às vezes um erro volta com status 200 e corpo JSON.
    if (bytes[0] !== 0x25 || bytes[1] !== 0x50)
      throw new FalhaSicredi('O Sicredi devolveu algo que não é PDF no lugar do boleto.')
    return bytes
  }

  /** Situação atual do boleto (EM CARTEIRA, LIQUIDADO, BAIXADO POR SOLICITACAO…). */
  async consultar(nossoNumero: string) {
    const params = new URLSearchParams({
      codigoBeneficiario: this.conta.beneficiario,
      nossoNumero,
    })
    const r = await this.chamar('GET', `/cobranca/boleto/v1/boletos?${params}`)
    if (!r.ok) throw new FalhaSicredi(`Consulta recusada pelo Sicredi: ${await motivo(r)}`)
    const j = (await r.json()) as {
      situacao?: string
      dataVencimento?: string
      valorNominal?: number
      dadosLiquidacao?: { data?: string; valor?: number } | null
    }
    return {
      situacao: j.situacao ?? null,
      pagoEm: j.dadosLiquidacao?.data?.slice(0, 10) ?? null,
      valorPago: j.dadosLiquidacao?.valor ?? null,
    }
  }

  /** Pede a baixa (o boleto deixa de poder ser pago). */
  async baixar(nossoNumero: string) {
    const r = await this.chamar(
      'PATCH',
      `/cobranca/boleto/v1/boletos/${encodeURIComponent(nossoNumero)}/baixa`,
      { corpo: {} },
    )
    if (!r.ok) throw new FalhaSicredi(`Baixa recusada pelo Sicredi: ${await motivo(r)}`)
  }
}
