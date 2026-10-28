const FUSO = 'America/Sao_Paulo'

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: FUSO,
})

const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })

/** Data e hora de um momento (ex.: quando um atendimento aconteceu). */
export function formatarDataHora(valor: string | Date | null | undefined): string {
  return valor ? dataHora.format(new Date(valor)) : ''
}

/*
 * Datas sem hora (vencimento, competência…) chegam do banco como "2026-10-28".
 * Elas são tratadas como texto, sem passar pelo fuso horário: new Date("2026-10-28")
 * seria meia-noite em Londres, que no Brasil ainda é dia 27.
 */

/** "2026-10-28" → "28/10/2026" */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return ''
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

/** "2026-10-01" → "out/2026" (como na planilha antiga) */
export function formatarMes(iso: string | null | undefined): string {
  if (!iso) return ''
  const mes = nomeMes.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)).replace('.', '')
  return `${mes}/${iso.slice(0, 4)}`
}

/** Hoje, no horário de Brasília, no formato "2026-10-28". */
export function hojeISO(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora)
}

/**
 * Soma meses mantendo o dia; se o mês não tiver o dia (ex.: 31 de fevereiro),
 * usa o último dia do mês.
 */
export function somarMeses(iso: string, meses: number): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1))
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate()
  alvo.setUTCDate(Math.min(dia, ultimoDia))
  return alvo.toISOString().slice(0, 10)
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** "2026-10-28" → "2026-10" (valor do campo <input type="month">). */
export function mesDe(iso: string): string {
  return iso.slice(0, 7)
}

/** Valor para um campo <input type="datetime-local"> no horário local. */
export function paraCampoDataHora(valor: Date = new Date()): string {
  const local = new Date(valor.getTime() - valor.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
