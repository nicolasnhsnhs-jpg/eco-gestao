/** Dia `dia` do mês (ano, mes 1–12), ou o último dia se o mês for mais curto. */
function diaDoMes(ano: number, mes: number, dia: number): string {
  const alvo = new Date(Date.UTC(ano, mes - 1, 1))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(dia, ultimo))
  return alvo.toISOString().slice(0, 10)
}

export type DiasDoCartao = { dia_fechamento: number; dia_vencimento: number }

/**
 * Em que dia vence a fatura onde entra uma compra no cartão.
 * A fatura fecha no dia do fechamento: compras a partir desse dia já vão para a seguinte.
 * O vencimento é o primeiro "dia do vencimento" depois do fechamento.
 * `mesesDepois` empurra para as faturas seguintes (parcela 2 = 1, parcela 3 = 2…).
 *
 * Ex.: fecha dia 5, vence dia 12 → compra em 03/11 vence 12/11; em 05/11, vence 12/12.
 *      fecha dia 25, vence dia 5  → compra em 10/11 vence 05/12.
 */
export function vencimentoDaFatura(dataCompra: string, cartao: DiasDoCartao, mesesDepois = 0) {
  const [ano, mes, dia] = dataCompra.split('-').map(Number)
  const fechamentoNoMes = Number(diaDoMes(ano, mes, cartao.dia_fechamento).slice(8))
  // Mês (contado a partir do mês da compra) em que a fatura fecha.
  const mesFechamento = dia < fechamentoNoMes ? 0 : 1
  // Vencimento depois do fechamento: no mesmo mês se o dia for maior, senão no seguinte.
  const mesVencimento =
    mesFechamento + (cartao.dia_vencimento > cartao.dia_fechamento ? 0 : 1) + mesesDepois
  return diaDoMes(ano, mes + mesVencimento, cartao.dia_vencimento)
}

/** Dia em que fecha a fatura que vence em `vencimento`. */
export function fechamentoDaFatura(vencimento: string, cartao: DiasDoCartao) {
  const [ano, mes] = vencimento.split('-').map(Number)
  const mesesAntes = cartao.dia_vencimento > cartao.dia_fechamento ? 0 : 1
  return diaDoMes(ano, mes - mesesAntes, cartao.dia_fechamento)
}
