/**
 * Valores em reais.
 * Contas com dinheiro são feitas em centavos (números inteiros), porque números
 * com vírgula no computador geram erros de arredondamento (0,1 + 0,2 = 0,30000000000000004).
 */

const formatoReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** 1234.5 → "R$ 1.234,50" */
export function formatarReais(valor: number | string | null | undefined): string {
  // O Intl separa "R$" do número com um espaço especial (não separável); trocamos por um comum.
  return formatoReais.format(Number(valor ?? 0)).replace(/\s/g, ' ')
}

/**
 * Lê o que a pessoa digitou ("1.234,56", "1234,5", "R$ 80") e devolve o número (1234.56).
 * Retorna null se não for um valor válido.
 */
export function lerValor(texto: string): number | null {
  const limpo = texto
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null
  return Number(limpo)
}

/** Formata enquanto digita: "123456" → "1.234,56" (os dois últimos números são os centavos). */
export function mascaraValor(texto: string): string {
  const numeros = texto.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (!numeros) return ''
  const centavos = numeros.padStart(3, '0')
  const reais = centavos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${reais},${centavos.slice(-2)}`
}

/** 1234.5 → "1.234,50" (para preencher o campo ao editar). */
export function valorParaCampo(valor: number | null | undefined): string {
  if (valor == null) return ''
  return mascaraValor(Math.round(valor * 100).toString())
}

export function paraCentavos(valor: number): number {
  return Math.round(valor * 100)
}
