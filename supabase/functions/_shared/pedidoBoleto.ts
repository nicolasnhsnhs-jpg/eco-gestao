// Monta o pedido de cadastro do boleto na API de Cobrança do Sicredi a partir da nota.
// Sem nada do Deno: os testes (Vitest) importam daqui.
//
// Limites do Sicredi (Manual da API da Cobrança): nome e endereço até 40 caracteres,
// cidade até 25, seuNumero até 10, até 5 informativos e 4 mensagens de 80 caracteres.

export type ConfigBoleto = {
  codigoBeneficiario: string
  tipoCobranca: 'HIBRIDO' | 'NORMAL'
  especie: string
  /** % do valor, cobrada uma vez depois do vencimento. */
  multa: number
  /** % ao mês; vai ao Sicredi como valor em reais por dia. */
  jurosMes: number
}

export type DadosBoleto = {
  /** Referência da nota no boleto (seuNumero): o número da NF ou o começo do id. */
  referencia: string
  valor: number
  vencimento: string
  pagador: {
    documento: string
    nome: string
    logradouro: string | null
    numero: string | null
    cidade: string | null
    uf: string | null
    cep: string | null
    email: string | null
  }
  /** Linhas impressas no boleto (ex.: "Referente à NF 4372 – 11/2026"). */
  informativos: string[]
}

/** Sem acento e sem caractere especial, cortado no tamanho que o Sicredi aceita. */
export function textoSicredi(texto: string | null | undefined, tamanho: number): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s.,/()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, tamanho)
    .trim()
}

const centavos = (n: number) => Math.round(n * 100) / 100

export function montarPedidoBoleto(cfg: ConfigBoleto, d: DadosBoleto): Record<string, unknown> {
  const documento = d.pagador.documento.replace(/\D/g, '')
  if (documento.length !== 11 && documento.length !== 14)
    throw new Error('O cliente está sem CPF/CNPJ.')
  if (!(d.valor > 0)) throw new Error('O valor do boleto precisa ser maior que zero.')

  const endereco = [d.pagador.logradouro, d.pagador.numero].filter(Boolean).join(', ')
  const cep = (d.pagador.cep ?? '').replace(/\D/g, '')
  const pagador: Record<string, string> = {
    tipoPessoa: documento.length === 14 ? 'PESSOA_JURIDICA' : 'PESSOA_FISICA',
    documento,
    nome: textoSicredi(d.pagador.nome, 40),
  }
  if (endereco) pagador.endereco = textoSicredi(endereco, 40)
  if (d.pagador.cidade) pagador.cidade = textoSicredi(d.pagador.cidade, 25)
  if (d.pagador.uf) pagador.uf = d.pagador.uf.toUpperCase().slice(0, 2)
  if (cep.length === 8) pagador.cep = cep
  if (d.pagador.email && d.pagador.email.length <= 40) pagador.email = d.pagador.email

  const pedido: Record<string, unknown> = {
    tipoCobranca: cfg.tipoCobranca,
    codigoBeneficiario: cfg.codigoBeneficiario,
    pagador,
    especieDocumento: cfg.especie,
    seuNumero: textoSicredi(d.referencia, 10).replace(/\s/g, ''),
    dataVencimento: d.vencimento,
    valor: centavos(d.valor),
  }
  if (cfg.multa > 0) pedido.multa = cfg.multa
  // Juros "por dia": o mês comercial tem 30 dias. Abaixo de 1 centavo o Sicredi recusa.
  const jurosDia = centavos((d.valor * cfg.jurosMes) / 100 / 30)
  if (jurosDia >= 0.01) {
    pedido.tipoJuros = 'VALOR'
    pedido.juros = jurosDia
  }
  const informativos = d.informativos.map((i) => textoSicredi(i, 80)).filter(Boolean)
  if (informativos.length) pedido.informativos = informativos.slice(0, 5)
  return pedido
}

/**
 * A situação diz que o boleto foi pago: no Sicredi LIQUIDADO, LIQUIDADO PIX…; no Asaas
 * RECEIVED, CONFIRMED ou RECEIVED_IN_CASH.
 */
export const boletoPago = (situacao: string | null | undefined) =>
  /^(LIQUIDADO|RECEIVED|CONFIRMED)/i.test(situacao ?? '')

/** O boleto não vale mais (baixado ou pago): pode-se gerar outro só se baixado. */
export const boletoBaixado = (situacao: string | null | undefined) =>
  /^BAIXADO/i.test(situacao ?? '')
