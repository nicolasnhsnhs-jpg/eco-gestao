const FUSO = 'America/Sao_Paulo'

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: FUSO,
})

const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: FUSO })

export function formatarDataHora(valor: string | Date | null | undefined): string {
  return valor ? dataHora.format(new Date(valor)) : ''
}

export function formatarData(valor: string | Date | null | undefined): string {
  return valor ? data.format(new Date(valor)) : ''
}

/** Valor para um campo <input type="datetime-local"> no horário local. */
export function paraCampoDataHora(valor: Date = new Date()): string {
  const local = new Date(valor.getTime() - valor.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}
