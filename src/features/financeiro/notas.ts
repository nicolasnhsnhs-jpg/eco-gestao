import { formatarData, somarMeses } from '@/lib/datas'

/* Contas das notas fiscais, sem acesso ao banco (testadas em notas.test.ts). */

const MESES = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
]

/**
 * A nota do mês seguinte, como o financeiro faz à mão: mesma descrição, com o
 * vencimento e o mês de referência um mês para a frente.
 * "BOLETO COM VENCIMENTO EM 10/12/2026" → "… 10/01/2027";
 * "MÊS REFERÊNCIA NOVEMBRO/2026" → "… DEZEMBRO/2026".
 * `vencimentoNovo` (o da mensalidade, que segue a regra do contrato) tem prioridade.
 */
export function proximaNota(
  ultima: { competencia: string; vencimento: string | null; descricao: string },
  vencimentoNovo?: string | null,
): { competencia: string; vencimento: string | null; descricao: string } {
  const competencia = somarMeses(ultima.competencia, 1)
  const vencimento = vencimentoNovo || (ultima.vencimento ? somarMeses(ultima.vencimento, 1) : null)
  let descricao = ultima.descricao
  if (ultima.vencimento && vencimento)
    descricao = descricao.replaceAll(formatarData(ultima.vencimento), formatarData(vencimento))
  const mesAntigo = `${MESES[Number(ultima.competencia.slice(5, 7)) - 1]}/${ultima.competencia.slice(0, 4)}`
  const mesNovo = `${MESES[Number(competencia.slice(5, 7)) - 1]}/${competencia.slice(0, 4)}`
  descricao = descricao.replace(new RegExp(mesAntigo, 'gi'), mesNovo)
  return { competencia, vencimento, descricao }
}

/**
 * Vencimento da mensalidade de um mês pela regra do contrato (como
 * privado.vencimento_contrato). Cobrança por dia útil depende dos feriados: null.
 */
export function vencimentoDoContrato(
  competencia: string,
  k: { dia_vencimento: number | null; vence_mes_seguinte: boolean },
): string | null {
  if (k.dia_vencimento == null) return null
  const mes = somarMeses(`${competencia.slice(0, 7)}-01`, k.vence_mes_seguinte ? 1 : 0)
  const ultimoDia = new Date(
    Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0),
  ).getUTCDate()
  return `${mes.slice(0, 8)}${String(Math.min(k.dia_vencimento, ultimoDia)).padStart(2, '0')}`
}

/**
 * A primeira nota de um contrato (sem nota anterior para copiar): valor e descrição do
 * contrato e, no boleto, "BOLETO COM VENCIMENTO EM dd/mm/aaaa" no fim, como nas outras.
 */
export function notaDoContrato(
  k: { descricao: string; valor_mensal: number; forma_pagamento: string | null },
  vencimento: string | null,
): { valor: number; descricao: string; forma_pagamento: string } {
  const forma = k.forma_pagamento ?? 'boleto'
  const descricao =
    forma === 'boleto' && vencimento
      ? `${k.descricao.trim()} - BOLETO COM VENCIMENTO EM ${formatarData(vencimento)}`
      : k.descricao.trim()
  return { valor: Number(k.valor_mensal), descricao, forma_pagamento: forma }
}

/**
 * Tipos de retenção de PIS/COFINS/CSLL do Sistema Nacional (tpRetPisCofins): quais das
 * três o tomador retém, na ordem [PIS, COFINS, CSLL]. 0 e 2 = nenhuma retida.
 */
export const RETENCOES_PISCOFINS: Record<
  number,
  { rotulo: string; retidos: [boolean, boolean, boolean] }
> = {
  0: { rotulo: 'PIS/COFINS/CSLL não retidos', retidos: [false, false, false] },
  1: { rotulo: 'PIS/COFINS retidos', retidos: [true, true, false] },
  2: { rotulo: 'PIS/COFINS não retidos', retidos: [false, false, false] },
  3: { rotulo: 'PIS/COFINS/CSLL retidos', retidos: [true, true, true] },
  4: { rotulo: 'PIS/COFINS retidos, CSLL não retido', retidos: [true, true, false] },
  5: { rotulo: 'PIS retido, COFINS/CSLL não retidos', retidos: [true, false, false] },
  6: { rotulo: 'COFINS retido, PIS/CSLL não retidos', retidos: [false, true, false] },
  7: { rotulo: 'PIS não retido, COFINS/CSLL retidos', retidos: [false, true, true] },
  8: { rotulo: 'PIS/COFINS não retidos, CSLL retido', retidos: [false, false, true] },
  9: { rotulo: 'COFINS não retido, PIS/CSLL retidos', retidos: [true, false, true] },
}

/** O tipo de retenção da nota; nas antigas (sem tipo), o que a emissão já usava. */
export function tipoRetencaoPisCofins(n: {
  tp_ret_piscofins: number | null
  pis_cofins_retidos: boolean
  valor_csll: number | null
}): number {
  if (n.tp_ret_piscofins != null) return n.tp_ret_piscofins
  if (!n.pis_cofins_retidos) return 0
  return Number(n.valor_csll ?? 0) > 0 ? 3 : 1
}

/**
 * Tipo de retenção e CSLL de uma nota do Sistema Nacional. No leiaute antigo (tipos 1 e 2)
 * o vRetCSLL é só a CSLL; no novo (3 a 9) é a soma das contribuições que o tipo retém,
 * então a CSLL é o que sobra tirando PIS e COFINS.
 */
export function retencaoDaNotaDoAdn(n: {
  tp_ret_piscofins: number | null
  valor_pis: number | null
  valor_cofins: number | null
  valor_ret_csll: number | null
}): { tipo: number; csll: number } {
  const tipo = n.tp_ret_piscofins ?? 0
  const ret = Number(n.valor_ret_csll ?? 0)
  if (tipo === 1 || tipo === 2) {
    if (ret <= 0) return { tipo, csll: 0 }
    return { tipo: tipo === 1 ? 3 : 8, csll: ret }
  }
  const [pis, cofins, csll] = RETENCOES_PISCOFINS[tipo]?.retidos ?? []
  if (!csll) return { tipo, csll: 0 }
  const resto =
    ret - (pis ? Number(n.valor_pis ?? 0) : 0) - (cofins ? Number(n.valor_cofins ?? 0) : 0)
  return { tipo, csll: Math.max(0, Math.round(resto * 100) / 100) }
}

/** Retido = algum dos três sai do valor (tipos 0 e 2 não retêm nada). */
export const retemPisCofins = (tipo: number) =>
  RETENCOES_PISCOFINS[tipo]?.retidos.some(Boolean) ?? false

/** Valor de uma retenção por alíquota: base × alíquota, nos centavos (como a Sefin). */
export function valorPorAliquota(base: number, aliquota: number | null): number | null {
  return aliquota != null && base > 0 ? Math.round(base * aliquota) / 100 : null
}

type DadosRetencao = {
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
}

export type Retencoes = {
  iss: number
  pis: number
  cofins: number
  csll: number
  irrf: number
  inss: number
}

/**
 * Quanto sai do valor em cada tributo (0 = não retido), na conta do Sistema Nacional:
 * CP + IRRF + os PIS/COFINS/CSLL que o tipo de retenção diz retidos + ISS retido.
 */
export function retencoes(n: DadosRetencao): Retencoes {
  const [pis, cofins, csll] = RETENCOES_PISCOFINS[tipoRetencaoPisCofins(n)]?.retidos ?? []
  return {
    iss: n.iss_retido ? (valorPorAliquota(Number(n.valor_servico), n.aliquota_iss) ?? 0) : 0,
    pis: pis ? Number(n.valor_pis ?? 0) : 0,
    cofins: cofins ? Number(n.valor_cofins ?? 0) : 0,
    csll: csll ? Number(n.valor_csll ?? 0) : 0,
    irrf: Number(n.valor_irrf ?? 0),
    inss: Number(n.valor_inss ?? 0),
  }
}

/** Soma das retenções, nos centavos. */
export function somaRetencoes(r: Retencoes): number {
  const total = r.iss + r.pis + r.cofins + r.csll + r.irrf + r.inss
  return Math.round(total * 100) / 100
}

/** Total retido pelo tomador (o que sai do valor do serviço). */
export function totalRetido(n: DadosRetencao): number {
  return somaRetencoes(retencoes(n))
}

/** O texto do resultado da emissão, também usado na emissão em lote. */
export function textoEmissao(r: {
  numero: string
  envio: { enviada: true; para: string[] } | { enviada: false; motivo: string } | null
}): string {
  if (!r.envio)
    return `NF ${r.numero} emitida. Anexe o boleto e clique em Enviar para mandar ao cliente.`
  return r.envio.enviada
    ? `NF ${r.numero} emitida e enviada para ${r.envio.para.join(', ')}.`
    : `NF ${r.numero} emitida. ${r.envio.motivo} Ficou o aviso de envio pendente.`
}

/** CST do PIS/COFINS com alíquota (tributável); vazio = o padrão da empresa (01). */
const CST_TRIBUTAVEL = ['', '01', '02']

/**
 * Valores de PIS, COFINS e CSLL a partir do valor do serviço. O fisco confere a conta
 * (valor = base × alíquota, E0694), então ela é sempre esta. A CSLL só existe quando o
 * tipo de retenção a retém (3, 7, 8 e 9).
 */
export function calcularPisCofins(d: {
  valor: number
  aliquotaPis: number | null
  aliquotaCofins: number | null
  tipoRetencao: number
  cst: string
  aliquotaCsll: number | null
}): { pis: number | null; cofins: number | null; csll: number | null } {
  const tributavel = CST_TRIBUTAVEL.includes(d.cst)
  const conta = (aliquota: number | null) =>
    tributavel && aliquota != null && d.valor > 0 ? Math.round(d.valor * aliquota) / 100 : null
  return {
    pis: conta(d.aliquotaPis),
    cofins: conta(d.aliquotaCofins),
    csll: RETENCOES_PISCOFINS[d.tipoRetencao]?.retidos[2]
      ? valorPorAliquota(d.valor, d.aliquotaCsll)
      : null,
  }
}
