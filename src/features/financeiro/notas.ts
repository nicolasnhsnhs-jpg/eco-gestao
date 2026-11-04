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

/** Total retido pelo tomador (o que sai do valor do serviço). */
export function totalRetido(n: {
  iss_retido: boolean
  aliquota_iss: number | null
  valor_servico: number
  pis_cofins_retidos: boolean
  valor_pis: number | null
  valor_cofins: number | null
  valor_csll: number | null
  valor_irrf: number | null
  valor_inss: number | null
}): number {
  const iss = n.iss_retido ? (Number(n.valor_servico) * Number(n.aliquota_iss ?? 0)) / 100 : 0
  const pisCofins = n.pis_cofins_retidos
    ? Number(n.valor_pis ?? 0) + Number(n.valor_cofins ?? 0) + Number(n.valor_csll ?? 0)
    : 0
  const total = iss + pisCofins + Number(n.valor_irrf ?? 0) + Number(n.valor_inss ?? 0)
  return Math.round(total * 100) / 100
}

/** O texto do resultado da emissão, também usado na emissão em lote. */
export function textoEmissao(r: {
  numero: string
  envio: { enviada: true; para: string[] } | { enviada: false; motivo: string }
}): string {
  return r.envio.enviada
    ? `NF ${r.numero} emitida e enviada para ${r.envio.para.join(', ')}.`
    : `NF ${r.numero} emitida. ${r.envio.motivo} Ficou o aviso de envio pendente.`
}

/** CST do PIS/COFINS com alíquota (tributável); vazio = o padrão da empresa (01). */
const CST_TRIBUTAVEL = ['', '01', '02']

/**
 * Valores de PIS, COFINS e CSLL a partir do valor do serviço. O fisco confere a conta
 * (valor = base × alíquota, E0694), então ela é sempre esta. A CSLL só existe quando o
 * tomador retém (PIS/COFINS/CSLL retidos).
 */
export function calcularPisCofins(d: {
  valor: number
  aliquotaPis: number | null
  aliquotaCofins: number | null
  retidos: boolean
  cst: string
  aliquotaCsll: number
}): { pis: number | null; cofins: number | null; csll: number | null } {
  const tributavel = CST_TRIBUTAVEL.includes(d.cst)
  const conta = (aliquota: number | null) =>
    tributavel && aliquota != null && d.valor > 0 ? Math.round(d.valor * aliquota) / 100 : null
  return {
    pis: conta(d.aliquotaPis),
    cofins: conta(d.aliquotaCofins),
    csll: d.retidos && d.valor > 0 ? Math.round(d.valor * d.aliquotaCsll) / 100 : null,
  }
}
