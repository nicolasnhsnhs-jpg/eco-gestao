/*
 * Valor em reais por extenso, como vai nas propostas:
 *   2680     → "dois mil, seiscentos e oitenta reais"
 *   806.45   → "oitocentos e seis reais e quarenta e cinco centavos"
 */

const UNIDADES = [
  '',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
]
const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
]
const CENTENAS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
]

/** 0 a 999 por extenso ("" para zero). */
function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []
  if (c) partes.push(CENTENAS[c])
  if (resto < 20) {
    if (resto) partes.push(UNIDADES[resto])
  } else {
    const d = Math.floor(resto / 10)
    const u = resto % 10
    partes.push(u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d])
  }
  return partes.join(' e ')
}

const GRUPOS: [string, string][] = [
  ['', ''],
  ['mil', 'mil'],
  ['milhão', 'milhões'],
  ['bilhão', 'bilhões'],
]

/** Número inteiro por extenso ("zero" para 0). */
export function inteiroPorExtenso(n: number): string {
  n = Math.floor(Math.abs(n))
  if (n === 0) return 'zero'
  const grupos: number[] = []
  while (n > 0) {
    grupos.push(n % 1000)
    n = Math.floor(n / 1000)
  }
  const partes: { texto: string; valor: number }[] = []
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i]
    if (!g) continue
    const [singular, plural] = GRUPOS[i] ?? ['', '']
    let texto: string
    if (i === 1) texto = g === 1 ? 'mil' : `${ate999(g)} mil`
    else if (i > 1) texto = `${ate999(g)} ${g === 1 ? singular : plural}`
    else texto = ate999(g)
    partes.push({ texto, valor: g })
  }
  // Liga o último grupo com "e" quando ele é "redondo" ou menor que 100
  // (mil e cem, mil e oitenta); senão, com vírgula (mil, seiscentos e oitenta).
  return partes
    .map((p, i) => {
      if (i === 0) return p.texto
      const ultimo = i === partes.length - 1
      const liga = ultimo && (p.valor < 100 || p.valor % 100 === 0) ? ' e ' : ', '
      return liga + p.texto
    })
    .join('')
}

/** Valor em reais por extenso. */
export function reaisPorExtenso(valor: number): string {
  const centavosTotais = Math.round(Math.abs(valor) * 100)
  const reais = Math.floor(centavosTotais / 100)
  const centavos = centavosTotais % 100
  const partes: string[] = []
  if (reais) {
    const grande = reais % 1_000_000 === 0
    partes.push(
      `${inteiroPorExtenso(reais)}${grande ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}`,
    )
  }
  if (centavos)
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  return partes.length ? partes.join(' e ') : 'zero reais'
}
