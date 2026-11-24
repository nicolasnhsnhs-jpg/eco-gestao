/**
 * Lista de e-mails no padrão do Outlook: ponto e vírgula e um espaço
 * ("a@x.com; b@y.com"). A vírgula só funciona no Outlook com uma opção ligada,
 * então nunca usamos vírgula para juntar e-mails.
 */
export const SEPARADOR_EMAILS = '; '

export function juntarEmails(lista: readonly (string | null | undefined)[]): string {
  return lista
    .map((e) => e?.trim())
    .filter(Boolean)
    .join(SEPARADOR_EMAILS)
}

/** Um e-mail no formato nome@dominio.ext. */
export const EMAIL_VALIDO = /^[^@\s;,]+@[^@\s;,]+\.[^@\s;,]+$/

/** Separa uma lista de e-mails (aceita "; ", vírgula ou espaço), sem repetidos. */
export function separarEmails(texto: string | null | undefined): string[] {
  const vistos = new Set<string>()
  for (const e of (texto ?? '').split(/[;,\s]+/)) {
    const x = e.trim().toLowerCase()
    if (EMAIL_VALIDO.test(x)) vistos.add(x)
  }
  return [...vistos]
}
