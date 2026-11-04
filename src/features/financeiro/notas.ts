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
