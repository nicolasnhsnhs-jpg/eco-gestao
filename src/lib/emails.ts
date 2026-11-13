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
