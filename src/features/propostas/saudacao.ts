/** Sr./Sra. no começo do nome (aceita "Sr", "sra.", "Senhor", "Senhora", "Srta."). */
const TRATAMENTO = /^\s*(senhora|senhor|srta\.?|sra\.?|sr\.?)\s+/i

export type Tratamento = 'Sr.' | 'Sra.'

/** Qual tratamento o nome já tem, se tiver. */
export function tratamentoDe(nome: string): Tratamento | null {
  const m = TRATAMENTO.exec(nome)
  if (!m) return null
  return /^(sr\.?|senhor)$/i.test(m[1]) ? 'Sr.' : 'Sra.'
}

/** Troca (ou coloca, ou tira com null) o Sr./Sra. do começo do nome. */
export function trocarTratamento(nome: string, t: Tratamento | null) {
  const semTratamento = nome.replace(TRATAMENTO, '').trim()
  if (!t) return semTratamento
  return semTratamento ? `${t} ${semTratamento}` : `${t} `
}
