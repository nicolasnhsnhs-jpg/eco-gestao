import { paraCentavos } from '@/lib/dinheiro'

/**
 * Contas da tela de antecipação (o banco refaz tudo ao gravar; aqui é só para mostrar).
 * Tudo em centavos, para não errar arredondamento.
 */
export type ModoDesconto = 'reais' | 'porcentagem'

/** Desconto em reais a partir do que a pessoa digitou (R$ ou %). */
export function descontoEmReais(bruto: number, modo: ModoDesconto, valor: number): number {
  if (modo === 'reais') return paraCentavos(valor) / 100
  return Math.round((paraCentavos(bruto) * valor) / 100) / 100
}

/** Quanto do total o desconto representa, em %, com duas casas. */
export function porcentagemDoDesconto(bruto: number, desconto: number): number {
  if (bruto <= 0) return 0
  return Math.round((desconto / bruto) * 10000) / 100
}

export function totalBruto(valores: (number | string)[]): number {
  return valores.reduce<number>((s, v) => s + paraCentavos(Number(v)), 0) / 100
}
