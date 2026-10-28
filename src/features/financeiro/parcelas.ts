import { somarMeses } from '@/lib/datas'
import { paraCentavos } from '@/lib/dinheiro'

export type Parcela = {
  numero: number
  valor: number
  vencimento: string
  /** Mês de competência: o mês do vencimento da parcela (ex.: "2026-11-01"). */
  competencia: string
}

/**
 * Divide um valor em parcelas mensais.
 * Os centavos que sobram da divisão vão na primeira parcela:
 * R$ 1.000,00 em 3x = 333,34 + 333,33 + 333,33.
 */
export function gerarParcelas(valorTotal: number, quantidade: number, primeiroVencimento: string) {
  if (quantidade < 1 || !Number.isInteger(quantidade)) {
    throw new Error('A quantidade de parcelas precisa ser um número inteiro maior que zero.')
  }
  const total = paraCentavos(valorTotal)
  const base = Math.floor(total / quantidade)
  const sobra = total - base * quantidade

  return Array.from({ length: quantidade }, (_, i): Parcela => {
    const vencimento = somarMeses(primeiroVencimento, i)
    return {
      numero: i + 1,
      valor: (base + (i === 0 ? sobra : 0)) / 100,
      vencimento,
      competencia: `${vencimento.slice(0, 7)}-01`,
    }
  })
}
